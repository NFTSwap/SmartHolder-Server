/**
 * @copyright © 2021 Copyright ccl
 * @date 2021-09-17
 */

import somes from 'somes';
import {WatchCat} from 'bclib/watch';
import { storage, ChainType, AssetType, AssetContract } from '../db';
import {MvpWeb3,isRpcLimitRequestAccount} from '../web3+';
import * as asset from '../scaner';
import {Transaction, TransactionReceipt, Log} from 'web3-core';
import * as cfg from '../../config';
import {insert as insertAc, update as updateAc, getAssetContract} from '../models/contract';
import uncaught from '../uncaught';

const cryptoTx = require('crypto-tx');

export class WatchBlock implements WatchCat {
	private _web3: MvpWeb3;
	private _blockNumber = Infinity;
	private _name: string;
	private _workers = 1;
	private _worker = 0;

	readonly onlyTest: boolean;

	// watch height
	get blockNumber() {
		return this._blockNumber;
	}

	// @arg onlyTest only test asset type
	constructor(web3: MvpWeb3, worker = 0, workers = 1, onlyTest: boolean = false, name = '') {
		this._web3 = web3;
		this._name = name;
		this._worker = worker;
		this._workers = workers;
		this.onlyTest = onlyTest;
	}

	private printLog(ac: AssetContract, log: Log) {
		if (cfg.logs.block_no_resolve) 
			console.warn('Not resolved TransactionReceipt',
				AssetType[ac.type], ChainType[ac.chain],
				'address:', ac.address,
				'block:', log.blockNumber,
				'tx:', log.transactionHash, 'topics:', log.topics, 'data:', log.data);
	}

	private async _watchReceipt(blockNumber: number,
		receipt: TransactionReceipt, getTx: ()=>Promise<Transaction>
	) {
		var chain = this._web3.chain;
		var self: WatchBlock = this;
		// if (!receipt) return;
		somes.assert(receipt, `WatchBlock#_watchReceipt, receipt: TransactionReceipt Can not be empty, blockNumber=${blockNumber}`);

		if ('status' in receipt)
			if (!receipt.status) return;

		if (receipt.contractAddress) { // New contract
			if (self.onlyTest) return; // only test asset type

			var address = cryptoTx.checksumAddress(receipt.contractAddress) as string;
			console.log(`Discover contract:`, ChainType[chain], blockNumber, address);

			var ac = await getAssetContract(address, chain);
			if (ac) { // update
				await updateAc({
					sync_height: ac.sync_height || blockNumber,
					init_height: ac.init_height || blockNumber, type: ac.type || AssetType.INVALID,
				}, address, chain);
			} else { // new contract
				await insertAc({
					address,
					chain: chain,
					sync_height: blockNumber,
					init_height: blockNumber, type: AssetType.INVALID,
					createdDate: Date.now(),
				});
			}
		} else if (receipt.to) { // Contract call
			for (var log of receipt.logs) { // event logs
				var address = log.address;
				var ac = await getAssetContract(address, chain);
				if (ac) {

					if (!ac.type) { // == INVALID
						if ((ac.type = await asset.test(chain, address, log))) {
							await updateAc({type: ac.type}, ac.address, ac.chain);
						}
					}
					if (self.onlyTest) continue;// only test asset type

					if (ac.type && blockNumber >= ac.sync_height) {
						var f = asset.make(address, ac.type, chain);
						if (!f.enableWatch) continue;

						if (! await f.solveReceiptLog(log, await getTx()) ) {
							var type = await asset.test(chain, address, log);
							if (type && type != ac.type) {
								await updateAc({ type }, address, chain);
								if (await asset.make(address, type, chain).solveReceiptLog(log, await getTx())) {
									// await updateAc({ sync_height }, address, chain);
									continue; // ok
								}
								this.printLog(ac, log);
							}
						} else {
						// var sync_height = Math.max(ac.sync_height, blockNumber - 64);
							//if (blockNumber % 64 == 0) { // 保持`sync_height`与主监控同步
							//	await updateAc({ sync_height }, address, chain);
							//}
						}

					}
					//
				}
			}
		}
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
			} catch(err) {}

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

		var key0 = `InitContracts_Worker_0_${ChainType[this._web3.chain]}${this._name}`;
		var key = `InitContracts_Worker_${this._worker}_${ChainType[this._web3.chain]}${this._name}`;

		var key0_height = await storage.get(key0) || 0;

		var blockNumber = await storage.get(key, Math.max(0, key0_height - this._workers));

		this._blockNumber = blockNumber;
		var delay = this._web3.chain == ChainType.BSN || this._web3.chain == ChainType.MATIC ? 4: 1;
		var blockNumberCur = await this._web3.getBlockNumber() - delay; // 延迟查询块

		try {
			while (this._blockNumber <= blockNumberCur) {
				if (this._blockNumber % this._workers === this._worker) {
					await this._watch(this._blockNumber);
				}
				this._blockNumber++;
				if (this._blockNumber % 1e2 === this._worker)
					await storage.set(key, this._blockNumber);
			}
			await storage.set(key, this._blockNumber);
		} catch(err: any) {
			await storage.set(key, this._blockNumber - 1);
			if (isRpcLimitRequestAccount(this._web3, err)) {
				this._web3.swatchRpc();
				throw err;
			}
			console.warn('WatchBlock#cat', ...err.filter(['message', 'description'], ['stack', 'message', 'description']));
		}

		return true;
	}
}