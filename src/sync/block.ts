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
import make from './mk_scaner';
import {Transaction, TransactionReceipt, Log} from 'web3-core';
import * as cryptoTx from 'crypto-tx';
import {getContractInfo} from '../models/contract';
import {broadcastWatchBlock} from '../message';

export class WatchBlock implements WatchCat {
	private _web3: MvpWeb3;
	private _blockNumber = Infinity;
	private _name: string;
	private _workers = 1;
	private _worker = 0;

	// watch height
	get blockNumber() {
		return this._blockNumber;
	}

	// @arg onlyTest only test asset type
	constructor(web3: MvpWeb3, worker = 0, workers = 1, name = '') {
		this._web3 = web3;
		this._name = name;
		this._worker = worker;
		this._workers = workers;
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

	private async _watchReceipt(blockNumber: number, receipt: TransactionReceipt, getTx: ()=>Promise<Transaction>) {
		var chain = this._web3.chain;
		somes.assert(receipt, `WatchBlock#_watchReceipt, receipt: TransactionReceipt Can not be empty, blockNumber=${blockNumber}`);

		if ('status' in receipt)
			if (!receipt.status) return;

		if (receipt.contractAddress) { // New contract
			var address = cryptoTx.checksumAddress(receipt.contractAddress) as string;
			console.log(`Discover contract:`, ChainType[chain], blockNumber, address);
		}
		else if (receipt.to) { // Contract call
			for (var log of receipt.logs) { // event logs
				var address = log.address;
				// if (blockNumber == 11084609) {
				// 	console.log('------------------------', blockNumber, address, '0x283703CC092EC7621F286dE09De5Ca9279AE4F98');
				// 	if (address.toLowerCase() == '0x283703CC092EC7621F286dE09De5Ca9279AE4F98'.toLowerCase()) {
				// 		debugger;
				// 	}
				// }
				var info = await getContractInfo(address, chain);
				if (info && info.type) {
					var scaner = make(address, info.type, chain);
					await scaner.solveReceiptLog(log, await getTx());
				}
			}
		} // else if (receipt.to) {
	}

	private async _watch(blockNumber: number) {
		var web3 = this._web3;
		var chain = web3.chain;

		//if (blockNumber % 100 === this._worker)

		var txs: Transaction[] | null = null;

		async function getTransaction(idx: number) {
			if (!txs)
				txs = (await web3.eth.getBlock(blockNumber, true)).transactions;
			return txs[idx];
		}

		var idx = 0;

		if (await web3.hasSupportGetTransactionReceiptsByBlock()) {
			var receipts: TransactionReceipt[] | undefined;
			try {
				receipts = await web3.getTransactionReceiptsByBlock(blockNumber);
			} catch(err: any) {
				console.warn(`WatchBlock#_watchReceipt`, err);
			}

			if (receipts) {
				console.log(`Watch Block:`, ChainType[chain], 'blockNumber', blockNumber, 'receipts', receipts.length);
				for (var item of receipts) {
					let _idx = idx++;
					await this._watchReceipt(blockNumber, item, ()=>getTransaction(_idx));
				}
				return;
			}
		}

		var block = await web3.eth.getBlock(blockNumber);

		console.log(`Watch Block:`, ChainType[chain], 'blockNumber', blockNumber, 'receipts', block.transactions.length);

		for (var txHash of block.transactions) {
			let _idx = idx++;
			var receipt = await web3.eth.getTransactionReceipt(txHash);
			await this._watchReceipt(blockNumber, receipt, ()=>getTransaction(_idx));
		}
	}

	private async _Test() {
		if (cfg.env == 'dev') {// test
			if (this._web3.chain == ChainType.MUMBAI) { // matic test
				// New contract  0x36763175b209853D022F2BAfd64eef71D5DF8dCF 0xf23128ed1c9cb13c02e0b500cc3a788f0e4abd6f24f603129e953e56d6d78830
				//await this._Watch(0x1630ee0);
				// mint Asset    0x36763175b209853D022F2BAfd64eef71D5DF8dCF 0xaf82f84eb432ae2455796744b870b77195d9b85fb640fc7766dccf56d3dec1ed
				await this._watch(0x1630f98);
			}
		}
	}

	async cat() {
		// await this._Test();

		var key0 = `WatchBlock_Cat_0_${ChainType[this._web3.chain]}_${this._name}`;
		var key = `WatchBlock_Cat_${this._worker}_${ChainType[this._web3.chain]}_${this._name}`;

		var key0_height = await storage.get<number>(key0) || await this._web3.getBlockNumber();

		var blockNumber = await storage.get(key, Math.max(0, key0_height - this._workers));

		this._blockNumber = blockNumber;
		var delay = this._web3.chain == ChainType.BSN || this._web3.chain == ChainType.MATIC ? 4: 1;
		var blockNumberCur = await this._web3.getBlockNumber() - delay; // 延迟查询块

		try {
			while (this._blockNumber <= blockNumberCur) {
				if (this._blockNumber % this._workers === this._worker) {
					await this._watch(this._blockNumber);
					await storage.set(key, this._blockNumber + 1);
					broadcastWatchBlock(this._worker, this._blockNumber + 1, this._web3.chain);
				}
				this._blockNumber++;
			}
		} catch (err: any) {
			await storage.set(key, this._blockNumber - 1);
			if (isRpcLimitRequestAccount(this._web3, err)) {
				this._web3.swatchRpc();
				throw err;
			}
			console.error('WatchBlock#cat', ...err.filter(['message', 'description', 'stack']));
		}

		return true;
	}
}
