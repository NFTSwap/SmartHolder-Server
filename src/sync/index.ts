/**
 * @copyright © 2021 Copyright ccl
 * @date 2022-07-21
 */

import '../uncaught';
import somes from 'somes';
import errno from '../errno';
import * as env from '../env';
import {WatchCat} from 'bclib/watch';
import { storage, ChainType } from '../db';
import {web3s} from '../web3+';
import msg, {Events} from '../message';
import {WatchBlock} from './block';
import {QiniuSync} from './qiniu';
import {AssetMetaDataSync,AssetMetaDataUpdate} from './asset_meta';

interface WaitPromiseCallback {
	timeout: number;
	blockNumber: number;
	resolve:()=>void;
	reject:(err:any)=>void;
}

interface Wait {
	chain: ChainType;
	worker: number;
	callback: WaitPromiseCallback[];
}

export class Sync {

	private _waits: Dict<Wait> = {};

	readonly qiniuSync = new QiniuSync();
	readonly assetMetaDataSync = new AssetMetaDataSync();
	readonly assetMetaDataUpdate = new AssetMetaDataUpdate();
	readonly watchBlocks: Dict<WatchBlock> = {};

	async initialize(addWatch: (watch: WatchCat)=>void) {
		let isMainWorker = !env.workers || env.workers.id === 0;

		await this.assetMetaDataSync.initialize();

		if (env.sync_main) {
			for (var [k,v] of Object.entries(web3s)) {
				_sync.watchBlocks[k] = env.workers ?
					new WatchBlock(v, env.workers.id, env.workers.workers): new WatchBlock(v, 0, 1);
				addWatch(_sync.watchBlocks[k]);
				await storage.set(`WatchBlock_Workers_${v.chain}`, env.workers ? env.workers.workers: 1);
			}
			if (isMainWorker) {
				addWatch(this.qiniuSync);
				addWatch(this.assetMetaDataUpdate);
			}
			addWatch(this.assetMetaDataSync);
		}

		msg.addEventListener(Events.WatchBlock, async (e)=>{
			let {worker, blockNumber, chain} = e.data;
			let wait = this._waits[`${chain}_${worker}`];
			let now = Date.now();
			if (!wait) return;

			for (let i = 0; i < wait.callback.length;) {
				let it = wait.callback[i];
				if (blockNumber > it.blockNumber) { // ok
					it.resolve();
					wait.callback.splice(i, 1); // delete
				} else if (now > it.timeout) { // timeout
					it.reject(errno.ERR_SYNC_WAIT_BLOCK_TIMEOUT);
					wait.callback.splice(i, 1); // delete
				} else { // wait
					i++;
				}
			}
		});
	}

	async waitBlockNumber(chain: ChainType, blockNumber: number, timeout?: number) {
		somes.assert(web3s[chain], `Not supported ${ChainType[chain]}`);

		let woekers = await storage.get(`WatchBlock_Workers_${chain}`);
		let worker = blockNumber % woekers;
		let cur = await storage.get(`WatchBlock_Cat_${worker}_${ChainType[chain]}_`);
		if (cur > blockNumber) return; // ok

		return await somes.promise<void>((resolve, reject)=>{
			let wait = this._waits[`${chain}_${worker}`] || (this._waits[`${chain}_${worker}`] = {
				chain, worker, callback: []
			});
			wait.callback.push({ timeout: timeout ? timeout + Date.now(): Infinity, blockNumber, resolve, reject });
		});
	}
}

const _sync = new Sync();

export default _sync;