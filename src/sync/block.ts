/**
 * @copyright © 2021 Copyright ccl
 * @date 2022-07-21
 */

import '../uncaught';
import somes from 'somes';
import buffer, {IBuffer} from 'somes/buffer';
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
import {toBuffer} from 'crypto-tx';

export async function testDB() {
	await somes.sleep(1e3);
	pool.CHAREST_NUMBER = Charsets.UTF8MB4_UNICODE_CI;
	let cfg_ = cfg.watchBlock;
	let db = new MysqlTools(cfg_.mysql);
	await db.load('', [], []);
}

function formatTransaction(tx: any): ITransaction {
	tx.fromAddress = '0x' + tx.fromAddress.toString('hex');
	tx.toAddress = '0x' + tx.toAddress.toString('hex');
	tx.value = '0x' + tx.value.toString('hex');
	tx.gasPrice = '0x' + tx.gasPrice.toString('hex');
	tx.gas = '0x' + tx.gas.toString('hex');
	tx.gasUsed = '0x' + tx.gasUsed.toString('hex');
	tx.cumulativeGasUsed = '0x' + tx.cumulativeGasUsed.toString('hex');
	tx.blockHash = '0x' + tx.blockHash.toString('hex');
	tx.transactionHash = '0x' + tx.transactionHash.toString('hex');
	tx.contractAddress = tx.contractAddress ? '0x' + tx.contractAddress.toString('hex'): undefined;
	return tx as any;
}

function formatTransactionLog(log: any, tx: ITransaction): TransactionLog {
	let topic = log.topic as IBuffer;
	log.address = '0x' + log.address.toString('hex');
	log.topic = [
		topic.slice(0, 32),
		topic.slice(32, 64),
		topic.slice(64, 96),
		topic.slice(96, 128),
	].filter(e=>e.length).map(e=>'0x'+e.toString('hex'));
	log.data = log.data ? '0x' + log.data.toString('hex'): '0x';
	log.transactionIndex = tx.transactionIndex;
	log.transactionHash = tx.transactionHash;
	log.blockHash = tx.blockHash;
	return log;
}

function hashCode(buff: IBuffer) {
	return Number((BigInt(buff.hashCode()) & BigInt(0xffffffff)));
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
		somes.assert(receipt, `#WatchBlock.watchReceipt, receipt: TransactionReceipt Can not be empty, blockNumber=${blockNumber}`);
		somes.assert(transactionIndex == receipt.transactionIndex, '#WatchBlock.watchReceipt transaction index no match');

		let transactionHash = toBuffer(receipt.transactionHash);
		let txHash = hashCode(transactionHash);
		let tx_id = 0;
		let [tx_] = (await this.db.query<{id:number}>(
			`select id from transaction_bin_${chain} where txHash=${txHash}`));

		if ( !tx_ ) {
			let tx = await getTx();
			let fromAddress = toBuffer(receipt.from);
			let toAddress = toBuffer(receipt.to || '0x0000000000000000000000000000000000000000');

			tx_id = await this.db.insert(`transaction_bin_${chain}`, {
				nonce: Number(tx.nonce),
				fromAddress,
				toAddress,
				value: toBuffer(tx.value),
				gasPrice: toBuffer(tx.gasPrice),
				gas: toBuffer(tx.gas), // gas limit
				// data: tx.input,
				gasUsed: toBuffer(receipt.gasUsed),
				cumulativeGasUsed: toBuffer(receipt.cumulativeGasUsed),
				// effectiveGasPrice: '0x' + Number(receipt.effectiveGasPrice || tx.gasPrice).toString(16),
				blockNumber: toBuffer(receipt.blockNumber),
				blockHash: toBuffer(receipt.blockHash),
				transactionHash,
				transactionIndex: Number(receipt.transactionIndex),
				// logsBloom: receipt.logsBloom,
				contractAddress: receipt.contractAddress ? toBuffer(receipt.contractAddress): null,
				status: Number(receipt.status),
				logsCount: receipt.logs.length,
				txHash: txHash,
				fromHash: hashCode(fromAddress),
				toHash: hashCode(toAddress),
			});
		} else {
			tx_id = tx_.id;
		}

		if (receipt.contractAddress) { // New contract
			let address = cryptoTx.checksumAddress(receipt.contractAddress);
			console.log(`Discover contract:`, ChainType[chain], blockNumber, address);
		}

		if (receipt.logs.length) { // event logs
			let sql: string[] = [];
			for (let log of receipt.logs) {
				let address = log.address;
				let logIndex = Number(log.logIndex);
				let topic = '0x' + (log.topics.length ? log.topics.map(e=>e.slice(2)).join(''): '0');
				let addressHash = hashCode(buffer.from(address.slice(2), 'hex'));

				//if (log.topics.length == 0)
				//	console.warn('#WatchBlock.solveReceipt topic is empty', log);

				if (log.data.length > 65535*2+2) {
					log.data = '0x' + buffer.from('rpc:fetch').toString('hex');
				}
				let data = log.data && log.data.length > 2 ? log.data: 'NULL';
				sql.push(
					`call insert_transaction_log_${chain}(${tx_id},${address},${topic},${data},${logIndex},${blockNumber},${addressHash});`
				);
			}
			await this.db.exec(sql.join('\n'));
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
				console.warn(`#WatchBlock._watchReceipt`, chain, err);
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
		type Log = TransactionLog & {tx:ITransaction};
		let chain = this.web3.chain;
		let logsAll = {
			info,
			blocks: [] as {
				blockNumber: number,
				logs: {
					idx: number, // index for info
					// address: string, // info address
					logs: Log[],
				}[],
			}[],
		};

		if (this.useRpc) {
			let r = await api.post<typeof logsAll>('chain/getTransactionLogsFrom', {
				chain, startBlockNumber, endBlockNumber, info: info.map(e=>({state: e.state,address:e.address}))
			}, {logs: cfg.moreLog, gzip: true});
			r.data.info = info;
			return r.data;
		}

		let addressSet: Dict = {};
		let addressHash = info.filter(e=>e.state==0).map(e=>{
			let buffer = toBuffer(e.address);
			e.address = '0x' + buffer.toString('hex');
			addressSet[e.address] = 1;
			return hashCode(buffer);
		}).join(',');

		let sql = `select * from transaction_log_bin_${chain} where addressHash in (${addressHash}) 
			and blockNumber>=${escape(startBlockNumber)} and blockNumber<=${escape(endBlockNumber)} 
		`;

		let logs = ((await this.db.query<Log>(sql)));
		let txs: Dict<ITransaction> = {};

		logs = logs.sort((a,b)=>a.blockNumber-b.blockNumber);

		if (logs.length) {
			for (let tx of await this.getTransactions(logs.map(e=>e.tx_id)))
				txs[tx.id] = tx;
		}

		let b_logs = [] as {blockNumber: number, logs: Log[]}[];

		for (let log of logs) {
			let tx = txs[log.tx_id];
			somes.assert(tx, '#WatchBlock.getTransactionLogsFrom() tx is null');
			log.tx = tx;
			log = formatTransactionLog(log, tx) as Log;
			
			if (addressSet[log.address]) {
				let {blockNumber} = log;
				let b_log = b_logs.indexReverse(0);
				if (b_log) {
					if (b_log.blockNumber == blockNumber) {
						b_log.logs.push(log);
					} else {
						somes.assert(b_log.blockNumber < blockNumber,
							'#WatchBlock.getTransactionLogsFrom blockNumber order error');
							b_logs.push({blockNumber, logs: [log]});
					}
				} else {
					b_logs[0] = {blockNumber, logs: [log]};
				}
			}
		} // for (let log of logs)

		for (let {blockNumber,logs} of b_logs) { // each block
			let block = { blockNumber, logs: [] } as typeof logsAll.blocks[0];
			let logsDict: Dict<Log[]> = {}; // address => log[]

			for (let log of logs) {
				let logs = logsDict[log.address];
				if (!logs)
					logsDict[log.address] = logs = [];
				logs.push(log); // address => log[]
			}

			info.forEach((e,idx)=>{
				let logs = logsDict[e.address];
				if (logs) {
					// let logsSet = {} as Dict;
					// logs = logs.filter(e=>logsSet[e.logIndex] ? 0: logsSet[e.logIndex]=1); // exclude duplicates
					logs = logs.sort((a,b)=>a.logIndex-b.logIndex); // sort
					block.logs.push({ idx, logs });
				}
			});

			logsAll.blocks.push(block);
		}

		return logsAll;
	}

	async getTransaction(transactionHash: string): Promise<ITransaction | null> {
		if (this.useRpc) {
			return (await api.get<ITransaction>('chain/getTransaction', {
				chain: this.web3.chain, txHash: transactionHash,
			}, {logs: cfg.moreLog, gzip: true})).data;
		}
		let txHash = hashCode(toBuffer(transactionHash));

		let tx = await this.db.select<ITransaction>(
			`transaction_bin_${this.web3.chain}`, { txHash }, {limit: 3});
		let txOne = tx.map(e=>formatTransaction(e)).find(e=>e.transactionHash==transactionHash);

		return txOne || null;
	}

	async getTransactions(ids: number[]) {
		if (this.useRpc) {
			return (await api.get<ITransaction[]>('chain/getTransactions', {
				chain: this.web3.chain, ids
			}, {logs: cfg.moreLog, gzip: true})).data;
		}

		if (ids.length) {
			let tx = await this.db.select(
				`transaction_bin_${this.web3.chain}`, `id in (${ids.map(e=>escape(e))})`);
			return tx.map(e=>formatTransaction(e));
		} else {
			return [];
		}
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
			console.error(`#WatchBlock.cat chain=${this.web3.chain}`, ...err.filter(['message', 'description', 'stack']));
		}

		return true;
	}
}
