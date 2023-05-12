/**
 * @copyright © 2021 Copyright ccl
 * @date 2022-07-21
 */

import '../uncaught';
import somes from 'somes';
import {WatchCat} from 'bclib/watch';
import db_, { storage as storage_, ChainType,
	Transaction as ITransaction,TransactionLog } from '../db';
import {MvpWeb3,isRpcLimitRequestAccount} from '../web3+';
import mk_scaner from './mk_scaner';
import {Transaction, TransactionReceipt} from 'web3-core';
import * as cryptoTx from 'crypto-tx';
import * as contract from '../models/contract';
import {postWatchBlock} from '../message';
import redis_, {Redis} from 'bclib/redis';
import pool from 'somes/mysql/pool';
import {Charsets} from 'somes/mysql/constants';
import * as cfg from '../../config';
import {MysqlTools} from 'somes/mysql';
import {escape} from 'somes/db';
import {Storage} from 'bclib/storage';
import * as env from '../env';
import api from '../request';
import * as deployInfo from '../../deps/SmartHolder/deployInfo.json';

export async function testDB() {
	await somes.sleep(1e3);
	pool.CHAREST_NUMBER = Charsets.UTF8MB4_UNICODE_CI;
	let cfg_ = cfg.watchBlock;
	let db = new MysqlTools(cfg_.mysql);
	await db.load('', [], []);
}

export class WatchBlock implements WatchCat {
	readonly web3: MvpWeb3;
	readonly db: typeof db_;
	readonly redis: Redis;
	readonly storage: Storage;
	readonly useRpc: boolean;

	private readonly workers: number;// = 1;
	private readonly worker: number;// = 0;

	private _watchBlockWorkersCaches = {} as Dict<{ value:number, timeout: number }>;

	constructor(web3: MvpWeb3, worker = 0, workers = 1, useRpc = false) {
		this.web3 = web3;
		this.worker = worker;
		this.workers = workers;
		this.useRpc = useRpc;

		pool.MAX_CONNECT_COUNT = 10; // max 50

		let cfg_ = cfg.watchBlock;
		this.db = cfg_.mysql.host ? new MysqlTools(cfg_.mysql): db_;
		this.redis = cfg_.redis ? new Redis(cfg_.redis): redis_;
		this.storage = this.db === db_ ? storage_: new Storage();
	}

	async initialize() {
		if (this.db !== db_)
			await this.db.load('', [], []);
		if (redis_ !== this.redis)
			await this.redis.initialize();
		else {
			if (this.db !== db_)
				// reset Block_Sync_Height data for redis
				this.redis.del(`Block_Sync_Height_${ChainType[this.web3.chain]}`);
		}
		if (storage_ !== this.storage)
			this.storage.initialize(this.db);
	}

	private async _solveReceipt(blockNumber: number, receipt: TransactionReceipt, getTx: ()=>Promise<Transaction>) {
		let chain = this.web3.chain;
		somes.assert(receipt, `#WatchBlock._watchReceipt, receipt: TransactionReceipt Can not be empty, blockNumber=${blockNumber}`);

		if ('status' in receipt)
			if (!receipt.status) return;

		if (receipt.contractAddress) { // New contract
			let address = cryptoTx.checksumAddress(receipt.contractAddress);
			console.log(`Discover contract:`, ChainType[chain], blockNumber, address);
		}
		else if (receipt.to) { // Contract call
			for (let log of receipt.logs) { // event logs
				let address = log.address;
				let info = await contract.select(address, chain);
				if (info && info.type) {
					await mk_scaner(address, info.type, chain).solveReceiptLog(log, await getTx());
				}
			}
		} // else if (receipt.to) {
	}

	private async solveReceipt(blockNumber: number, receipt: TransactionReceipt, transactionIndex: number, getTx: ()=>Promise<Transaction>) {
		let chain = this.web3.chain;
		somes.assert(receipt, `#WatchBlock._watchReceipt, receipt: TransactionReceipt Can not be empty, blockNumber=${blockNumber}`);

		let tx = await getTx();
		let transactionHash = receipt.transactionHash;
		let tx_id = 0;
		let tx_ = (await this.db.selectOne<ITransaction>(`transaction_${chain}`, {transactionHash}))!;
		if ( !tx_ ) {
			tx_id = await this.db.insert(`transaction_${chain}`, {
				nonce: tx.nonce,
				blockNumber: receipt.blockNumber,
				fromAddress: receipt.from,
				toAddress: receipt.to || '0x0000000000000000000000000000000000000000',
				value: '0x' + Number(tx.value).toString(16),
				gasPrice: '0x' + Number(tx.gasPrice).toString(16),
				gas: '0x' + Number(tx.gas).toString(16),
				// data: tx.input,
				blockHash: receipt.blockHash,
				transactionHash: receipt.transactionHash,
				transactionIndex: receipt.transactionIndex,
				gasUsed: '0x' + Number(receipt.gasUsed).toString(16),
				cumulativeGasUsed: '0x' + Number(receipt.cumulativeGasUsed).toString(16),
				effectiveGasPrice: '0x' + Number(receipt.effectiveGasPrice).toString(16),
				// logsBloom: receipt.logsBloom,
				contractAddress: receipt.contractAddress,
				status: receipt.status,
				logsCount: receipt.logs.length,
				time: Date.now(),
			});
		} else {
			tx_id = tx_.id;
		}

		if (receipt.contractAddress) { // New contract
			let address = cryptoTx.checksumAddress(receipt.contractAddress);
			console.log(`Discover contract:`, ChainType[chain], blockNumber, address);
		}

		for (let log of receipt.logs) { // event logs
			let address = log.address;
			let logIndex = Number(log.logIndex);
			somes.assert(!isNaN(logIndex), '#WatchBlock.solveReceipt() logIndex type no match');
			if ( !await this.db.selectOne<ITransaction>(`transaction_log_${chain}`, {transactionHash, logIndex}) ) {
				if (log.data.length > 65535) {
					//log.data = await utils.storage(buffer.from(log.data.slice(2), 'hex'), '.data');
					log.data = 'rpc:fetch';
				}
				await this.db.insert(`transaction_log_${chain}`, {
					tx_id,
					address,
					topic0: log.topics[0] || '',
					topic1: log.topics[1],
					topic2: log.topics[2],
					topic3: log.topics[3],
					data: log.data,
					logIndex,
					transactionIndex,
					transactionHash,
					blockHash: receipt.blockHash,
					blockNumber,
				});
			}
		}
	}

	private async solveBlock(blockNumber: number) {
		let web3 = this.web3;
		let chain = web3.chain;

		//if (blockNumber % 100 === this._worker)

		let txs: Transaction[] | null = null;

		async function getTransaction(idx: number) {
			if (!txs)
				txs = (await web3.eth.getBlock(blockNumber, true)).transactions;
			return txs[idx];
		}

		// let lastBlockNumber = await web3.getBlockNumber();
		let idx = 0;

		if (await web3.hasSupportGetTransactionReceiptsByBlock()) {
			let receipts: TransactionReceipt[] | undefined;
			try {
				receipts = await web3.getTransactionReceiptsByBlock(blockNumber);
			} catch(err: any) {
				console.warn(`#WatchBlock._watchReceipt`, err);
			}

			if (receipts) {
				console.log(`Watch Block:`, ChainType[chain], 'blockNumber', blockNumber, 'receipts', receipts.length);
				for (let item of receipts) {
					let _idx = idx++;
					await this.solveReceipt(blockNumber, item, _idx, ()=>getTransaction(_idx));
				}
				return;
			}
		}

		// ----------------------- Compatibility Mode -----------------------

		let block = await web3.eth.getBlock(blockNumber);

		console.log(`Watch Block:`, ChainType[chain], 'blockNumber', blockNumber, 'receipts', block.transactions.length);

		for (let txHash of block.transactions) {
			let _idx = idx++;
			let receipt = await web3.eth.getTransactionReceipt(txHash);
			await this.solveReceipt(blockNumber, receipt, _idx, ()=>getTransaction(_idx));
		}
	}

	async getBlockSyncHeight(worker = 0) {
		if (this.useRpc)
			return (await api.get('chain/getBlockSyncHeight', {chain: this.web3.chain,worker})).data;

		let key = `Block_Sync_Height_${ChainType[this.web3.chain]}`;
		let num = await this.redis.client.hGet(key, `worker_${worker}`);
		if (!num)
			num = await this.storage.get(`${key}_${worker}`);
		return (num || 0) as number;
	}

	async getValidBlockSyncHeight() {
		let chain = this.web3.chain;
		if (this.useRpc) {
			let data = await api.get<number>('chain/getValidBlockSyncHeight', {chain});
			return data.data;
		}

		let workers = await this.getWatchBlockWorkers();
		let key = `Block_Sync_Height_${ChainType[chain]}`;
		let heightAll = await this.redis.client.hGetAll(key);

		if (!heightAll || !Array.from({length:workers}).every((_,j)=>heightAll[`worker_${j}`])) {
			// read block height for mysql db
			heightAll = {};
			let key = `Block_Sync_Height_${ChainType[chain]}`;
			let ls = await this.db.query<{kkey:string, value: any}>(
				`select * from storage where kkey like '${key}%'`);
			for (let it of ls) {
				heightAll['worker' + it.kkey.substring(key.length)] = it.value;
			}
		}

		let [height, ...heights] = Array.from({length:workers})
				.map((_,i)=>(Number(heightAll[`worker_${i}`]) || 0))
				.sort((a,b)=>a-b);

		for (let i = 0; i < heights.length; i++) {
			if (height + 1 != heights[i])
				break;
			height++;
		}
		return height;
	}

	async getTransactionLogsFrom<T extends {state: number,address: string}>(
		startBlockNumber: number, endBlockNumber: number, info: T[]
	) {
		let chain = this.web3.chain;
		let logsAll = {
			info,
			blocks: [] as {
				blockNumber: number,
				logs: {
					idx: number, // index for info
					// address: string, // info address
					logs: TransactionLog[],
				}[],
			}[],
		};

		if (this.useRpc) {
			let r = await api.post<typeof logsAll>('chain/getTransactionLogsFrom', {
				chain, startBlockNumber, endBlockNumber, info: info.map(e=>({state: e.state,address:e.address}))
			});
			r.data.info = info;
			return r.data;
		}

		let address = info.filter(e=>e.state==0).map(e=>escape(e.address)).join(',');
		let sql = `select * from transaction_log_${chain} where address in (${address}) 
			and blockNumber>=${escape(startBlockNumber)} and blockNumber<=${escape(endBlockNumber)} 
		`;

		let logs = await this.db.query<TransactionLog>(sql);

		logs = logs.sort((a,b)=>a.blockNumber-b.blockNumber);

		let blogs = [] as {blockNumber: number, logs: TransactionLog[]}[];

		for (let log of logs) {
			let {blockNumber} = log
			let blog = blogs.indexReverse(0);
			if (blog) {
				if (blog.blockNumber == blockNumber) {
					blog.logs.push(log);
				} else {
					somes.assert(blog.blockNumber < blockNumber,
						'#WatchBlock.getTransactionLogsFrom blockNumber order error');
					blogs.push({blockNumber, logs: [log]});
				}
			} else {
				blogs[0] = {blockNumber, logs: [log]};
			}
		}

		for (let {blockNumber,logs} of blogs) { // each block
			let block = { blockNumber, logs: [] } as typeof logsAll.blocks[0];
			let logsDict: Dict<TransactionLog[]> = {};

			for (let log of logs) {
				let logs = logsDict[log.address];
				if (!logs)
					logsDict[log.address] = logs = [];
				logs.push(log);
			}

			info.forEach((e,idx)=>{
				let logs = logsDict[e.address];
				if (logs)
					block.logs.push({ idx, logs: logs.sort((a,b)=>a.logIndex-b.logIndex) });
			});

			logsAll.blocks.push(block);
		}

		return logsAll;
	}

	async getTransaction(txHash: string) {
		if (this.useRpc) {
			return (await api.get<ITransaction>('chain/getTransaction', {
				chain: this.web3.chain, txHash
			})).data;
		}

		let tx = await this.db.selectOne<ITransaction>(
			`transaction_${this.web3.chain}`, { transactionHash: txHash });
		return tx;
	}

	private async getWatchBlockWorkers() {
		let chain: ChainType = this.web3.chain;
		let key = `Block_Sync_Workers_${ChainType[chain]}`;
		let cache = this._watchBlockWorkersCaches[chain] || {value:0,timeout: 0};

		if (cache.timeout < Date.now()) {
			let workers = (await this.redis.get<number>(key))!;
			if (!workers)
				workers = await this.storage.get(key) || 1;
			this._watchBlockWorkersCaches[chain] = {
				value: workers, timeout: Date.now() + 1e4, // 10 second
			};
			return workers;
		} else {
			return cache.value;
		}
	}

	private async saveBlockSyncHeight(blockNumber: number, worker = 0) {
		let key = `Block_Sync_Height_${ChainType[this.web3.chain]}`;
		await this.storage.set(`${key}_${worker}`, blockNumber);
		await this.redis.client.hSet(key, `worker_${worker}`, blockNumber);
	}

	private async saveBlockSyncWorkers() {
		let key = `Block_Sync_Workers_${ChainType[this.web3.chain]}`;
		await this.storage.set(key, this.workers);
		await this.redis.set(key, this.workers);
	}

	async cat() {
		if (!env.watch_main)
			return true;

		// await this._Test();
		await this.saveBlockSyncWorkers();

		let web3 = this.web3;
		let chain = web3.chain;
		let key = (worker: number)=> `Block_Sync_Height_${ChainType[chain]}_${worker}`;

		let blockNumber = await this.storage.get<number>(key(this.worker)) || 0;
		if (!blockNumber) {
			for (let i = 0; i < this.workers; i++) {
				let num = await this.storage.get<number>(key(i));
				if (num) {
					blockNumber = blockNumber ? Math.min(blockNumber, num): num;
				}
			}
		}

		if (!blockNumber) { // blockNumber == 0
			let info = deployInfo[ChainType[chain].toLowerCase() as 'goerli'];
			if (info)
				blockNumber = info.DAOsProxy.blockNumber;
		}

		try {
			let blockNumberCur = await web3.getBlockNumber();

			while (++blockNumber <= blockNumberCur) {
				if (blockNumber % this.workers === this.worker) {
					await this.solveBlock(blockNumber);
					await this.saveBlockSyncHeight(blockNumber, this.worker); // complete save
					postWatchBlock(this.worker, blockNumber, web3.chain);
				}
			}
		} catch (err: any) {
			if (isRpcLimitRequestAccount(web3, err)) {
				web3.swatchRpc();
			}
			console.error('#WatchBlock.cat', ...err.filter(['message', 'description', 'stack']));
		}

		return true;
	}
}
