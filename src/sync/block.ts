/**
 * @copyright © 2021 Copyright ccl
 * @date 2022-07-21
 */

import '../uncaught';
import somes from 'somes';
import * as cfg from '../../config';
import {WatchCat} from 'bclib/watch';
import { storage, ChainType, ContractInfo, ContractType } from '../db';
import {MvpWeb3,isRpcLimitRequestAccount} from '../web3+';
import mk_scaner from './mk_scaner';
import {Transaction, TransactionReceipt, Log} from 'web3-core';
import * as cryptoTx from 'crypto-tx';
import {getContractInfo} from '../models/contract';
import {broadcastWatchBlock} from '../message';

export class WatchBlock implements WatchCat {
	private _web3: MvpWeb3;
	private _name: string;
	readonly workers: number;// = 1;
	readonly worker: number;// = 0;

	// @arg onlyTest only test asset type
	constructor(web3: MvpWeb3, worker = 0, workers = 1, name = '') {
		this._web3 = web3;
		this._name = name;
		this.worker = worker;
		this.workers = workers;
	}

	private printLog(ac: ContractInfo, log: Log) {
		if (cfg.logs.block_no_resolve) 
			console.warn('Not resolved TransactionReceipt',
				ContractType[ac.type], ChainType[this._web3.chain],
				'address:', ac.address,
				'block:', log.blockNumber,
				'tx:', log.transactionHash, 'topics:', log.topics, 'data:', log.data
			);
	}

	private async _Test() {
		if (cfg.env == 'dev') {// test
			if (this._web3.chain == ChainType.MUMBAI) { // matic test
				// New contract  0x36763175b209853D022F2BAfd64eef71D5DF8dCF 0xf23128ed1c9cb13c02e0b500cc3a788f0e4abd6f24f603129e953e56d6d78830
				//await this._Watch(0x1630ee0);
				// mint Asset    0x36763175b209853D022F2BAfd64eef71D5DF8dCF 0xaf82f84eb432ae2455796744b870b77195d9b85fb640fc7766dccf56d3dec1ed
				await this._solveBlock(0x1630f98);
			}
		}
	}

	private async _solveReceipt(blockNumber: number, lastBlockNumber: number, receipt: TransactionReceipt, getTx: ()=>Promise<Transaction>) {
		let chain = this._web3.chain;
		somes.assert(receipt, `#WatchBlock#_watchReceipt, receipt: TransactionReceipt Can not be empty, blockNumber=${blockNumber}`);

		if ('status' in receipt)
			if (!receipt.status) return;

		if (receipt.contractAddress) { // New contract
			let address = cryptoTx.checksumAddress(receipt.contractAddress) as string;
			console.log(`Discover contract:`, ChainType[chain], blockNumber, address);
		}
		else if (receipt.to) { // Contract call
			for (let log of receipt.logs) { // event logs
				let address = log.address;
				// if (blockNumber == 11084609) {
				// 	console.log('------------------------', blockNumber, address, '0x283703CC092EC7621F286dE09De5Ca9279AE4F98');
				// 	if (address.toLowerCase() == '0x283703CC092EC7621F286dE09De5Ca9279AE4F98'.toLowerCase()) {
				// 		debugger;
				// 	}
				// }
				let info = await getContractInfo(address, chain);
				if (info && info.type) {
					let scaner = mk_scaner(address, info.type, chain);
					scaner.lastBlockNumber = lastBlockNumber;
					await scaner.solveReceiptLog(log, await getTx());
				}
			}
		} // else if (receipt.to) {
	}

	private async _solveBlock(blockNumber: number) {
		let web3 = this._web3;
		let chain = web3.chain;

		//if (blockNumber % 100 === this._worker)

		let txs: Transaction[] | null = null;

		async function getTransaction(idx: number) {
			if (!txs)
				txs = (await web3.eth.getBlock(blockNumber, true)).transactions;
			return txs[idx];
		}

		let lastBlockNumber = await web3.getBlockNumber();
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
					await this._solveReceipt(blockNumber, lastBlockNumber, item, ()=>getTransaction(_idx));
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
			await this._solveReceipt(blockNumber, lastBlockNumber, receipt, ()=>getTransaction(_idx));
		}
	}

	async cat() {
		// await this._Test();

		let key = (worker: number)=> `WatchBlock_Cat_${worker}_${ChainType[this._web3.chain]}_${this._name}`;

		let blockNumber = await storage.get<number>(key(this.worker)) || 0;
		if (!blockNumber) {
			for (let i = 0; i < this.workers; i++) {
				let num = await storage.get<number>(key(i));
				if (num)
					blockNumber = Math.min(blockNumber, num);
			}
		}

		let delay = this._web3.chain == ChainType.BSN || this._web3.chain == ChainType.MATIC ? 2: 0;
		let blockNumberCur = await this._web3.getBlockNumber() - delay; // 延迟查询块

		try {
			while (++blockNumber <= blockNumberCur) {
				if (blockNumber % this.workers === this.worker) {
					await this._solveBlock(blockNumber);
					await storage.set(key(this.worker), blockNumber); // complete save
					broadcastWatchBlock(this.worker, blockNumber, this._web3.chain);
				}
			}
		} catch (err: any) {
			if (isRpcLimitRequestAccount(this._web3, err)) {
				this._web3.swatchRpc();
				throw err;
			}
			console.error('#WatchBlock#cat', ...err.filter(['message', 'description', 'stack']));
		}

		return true;
	}
}
