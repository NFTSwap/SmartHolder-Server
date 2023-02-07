/**
 * @copyright © 2021 Copyright ccl
 * @date 2022-07-21
 */

import '../uncaught';
import somes from 'somes';
import buffer from 'somes/buffer';
import {WatchCat} from 'bclib/watch';
import db, { storage, ChainType, Transaction as ITransaction } from '../db';
import {MvpWeb3,isRpcLimitRequestAccount} from '../web3+';
import mk_scaner from './mk_scaner';
import {Transaction, TransactionReceipt} from 'web3-core';
import * as cryptoTx from 'crypto-tx';
import * as contract from '../models/contract';
import {postWatchBlock} from '../message';
import * as redis from 'bclib/redis';
import * as utils from '../utils';
import pool from 'somes/mysql/pool';

export class WatchBlock implements WatchCat {
	readonly web3: MvpWeb3;
	readonly workers: number;// = 1;
	readonly worker: number;// = 0;

	constructor(web3: MvpWeb3, worker = 0, workers = 1) {
		this.web3 = web3;
		this.worker = worker;
		this.workers = workers;
		pool.MAX_CONNECT_COUNT = 10; // max 50
	}

	private async _solveReceipt(blockNumber: number, receipt: TransactionReceipt, getTx: ()=>Promise<Transaction>) {
		let chain = this.web3.chain;
		somes.assert(receipt, `#WatchBlock#_watchReceipt, receipt: TransactionReceipt Can not be empty, blockNumber=${blockNumber}`);

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
					let scaner = mk_scaner(address, info.type, chain);
					await scaner.solveReceiptLog(log, await getTx());
				}
			}
		} // else if (receipt.to) {
	}

	private async solveReceipt(blockNumber: number, receipt: TransactionReceipt, transactionIndex: number, getTx: ()=>Promise<Transaction>) {
		let chain = this.web3.chain;
		somes.assert(receipt, `#WatchBlock#_watchReceipt, receipt: TransactionReceipt Can not be empty, blockNumber=${blockNumber}`);

		let tx = await getTx();
		let transactionHash = receipt.transactionHash;
		let tx_id = 0;
		let tx_ = (await db.selectOne<ITransaction>(`transaction_${chain}`, {transactionHash}))!;
		if ( !tx_ ) {
			tx_id = await db.insert(`transaction_${chain}`, {
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
		// else if (receipt.to) { // Contract call

		let logIndex = 0;
		for (let log of receipt.logs) { // event logs
			let address = log.address;
			if ( !await db.selectOne<ITransaction>(`transaction_log_${chain}`, {transactionHash, logIndex}) ) {
				if (log.data.length > 65535) {
					//log.data = await utils.storage(buffer.from(log.data.slice(2), 'hex'), '.data');
					log.data = 'rpc:fetch';
				}
				await db.insert(`transaction_log_${chain}`, {
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
			logIndex++;
		}
		// } // else if (receipt.to) {
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
				console.warn(`#WatchBlock#_watchReceipt`, err);
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

	static async getBlockSyncHeight(chain: ChainType, worker = 0) {
		let key = `Block_Sync_Height_${ChainType[chain]}`;
		let num = await redis.client.hGet(key, `worker_${worker}`);
		if (!num)
			num = await storage.get(`${key}_${worker}`);
		return (num || 0) as number;
	}

	static async getValidBlockSyncHeight(chain: ChainType) {
		let workers = await this.getWatchBlockWorkers(chain);
		let key = `Block_Sync_Height_${ChainType[chain]}`;
		let heightAll = await redis.client.hGetAll(key);

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

	private static _WatchBlockWorkersCaches = {} as Dict<{ value:number, timeout: number }>;

	private static async getWatchBlockWorkers(chain: ChainType) {
		let key = `Block_Sync_Workers_${ChainType[chain]}`;
		let cache = this._WatchBlockWorkersCaches[chain] || {value:0,timeout: 0};

		if (cache.timeout < Date.now()) {
			let workers = (await redis.get<number>(key))!;
			if (!workers)
				workers = await storage.get(key) || 1;
			this._WatchBlockWorkersCaches[chain] = {
				value: workers, timeout: Date.now() + 1e4, // 10 second
			};
			return workers;
		} else {
			return cache.value;
		}
	}

	private async saveBlockSyncHeight(blockNumber: number, worker = 0) {
		let key = `Block_Sync_Height_${ChainType[this.web3.chain]}`;
		await storage.set(`${key}_${worker}`, blockNumber);
		await redis.client.hSet(key, `worker_${worker}`, blockNumber);
	}
	
	private async saveBlockSyncWorkers() {
		let key = `Block_Sync_Workers_${ChainType[this.web3.chain]}`;
		await storage.set(key, this.workers);
		await redis.set(key, this.workers);
	}

	async cat() {
		// await this._Test();
		await this.saveBlockSyncWorkers();

		let web3 = this.web3;
		let chain = web3.chain;
		let key = (worker: number)=> `Block_Sync_Height_${ChainType[chain]}_${worker}`;

		let blockNumber = await storage.get<number>(key(this.worker)) || 0;
		if (!blockNumber) {
			for (let i = 0; i < this.workers; i++) {
				let num = await storage.get<number>(key(i));
				if (num) {
					blockNumber = blockNumber ? Math.min(blockNumber, num): num;
				}
			}
		}

		try {
			// let delay = chain == ChainType.BSN || chain == ChainType.MATIC ? 2: 0;
			let blockNumberCur = await web3.getBlockNumber();// - delay; // 延迟查询块

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
			console.error('#WatchBlock#cat', ...err.filter(['message', 'description', 'stack']));
		}

		return true;
	}
}
