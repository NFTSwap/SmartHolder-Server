/**
 * @copyright © 2021 Copyright ccl
 * @date 2022-07-21
 */

import somes from 'somes';
import '../uncaught';
import errno from '../errno';
import * as env from '../env';
import * as cfg from '../../config';
import {WatchCat} from 'bclib/watch';
import { ChainType } from '../db';
import {web3s} from '../web3+';
import msg, {EventIndexerNextBlock} from '../message';
import {WatchBlock} from './block';
import {QiniuSync} from './qiniu';
import {AssetMetaDataSync,AssetMetaDataUpdate} from './asset_meta';
import {RunIndexer,Indexer} from './indexer';

interface WaitPromiseCallback {
	timeout: number;
	blockNumber: number;
	resolve:()=>void;
	reject:(err:any)=>void;
}

interface Wait {
	chain: ChainType;
	dao: string;
	callback: WaitPromiseCallback[];
}

export class Sync {

	private _waits: Dict<Wait> = {};

	readonly qiniuSync = new QiniuSync();
	readonly assetMetaDataSync = new AssetMetaDataSync();
	readonly assetMetaDataUpdate = new AssetMetaDataUpdate();
	readonly watchBlocks: Dict<WatchBlock> = {};   // chain => WatchBlock
	readonly watchIndexers: Dict<RunIndexer> = {}; // chain => RunIndexer

	getIndexer(chain: ChainType, indexer_id: number) {
		return this.watchIndexers[chain].indexers[indexer_id];
	}

	getIndexerFromHash(chain: ChainType, hash: string) {
		hash = hash.toLowerCase();
		let run = this.watchIndexers[chain];
		let indexer = Object.values(run.indexers).find(e=>e.data.hash.toLowerCase() == hash)!;
		return indexer;
	}

	async initialize(addWatch: (watch: WatchCat)=>void) {
		let isMainWorker = !env.workers || env.workers.id === 0;

		await this.assetMetaDataSync.initialize();

		for (var [k,v] of Object.entries(web3s)) {
			let useRpc = cfg.useRpc && !env.watch_main;
			_sync.watchBlocks[k] = env.workers ?
				new WatchBlock(v, env.workers.id, env.workers.workers, useRpc):
				new WatchBlock(v, 0, 1, useRpc);
			if (env.watch_main)
				addWatch(_sync.watchBlocks[k]);
			await _sync.watchBlocks[k].initialize();
		}

		if (env.watch_main) {
			if (isMainWorker) {
				addWatch(this.qiniuSync);
				addWatch(this.assetMetaDataUpdate);
			}
			addWatch(this.assetMetaDataSync);
		}

		if (env.watch_indexer) {
			for (var [k,v] of Object.entries(web3s)) {
				let run = env.workers ?
					new RunIndexer(v.chain, env.workers.id, env.workers.workers): new RunIndexer(v.chain, 0, 1);
				addWatch(_sync.watchIndexers[k] = run);
				await run.initialize();
			}
		}

		msg.addEventListener(EventIndexerNextBlock, async (e)=>{
			let {hash, blockNumber, chain} = 
				e.data as {hash: string, blockNumber: number, chain: ChainType};
			let wait = this._waits[`${chain}_${hash.toLowerCase()}`];
			if (!wait) return;

			for (let i = 0; i < wait.callback.length;) {
				let w = wait.callback[i];
				if (blockNumber >= w.blockNumber) { // ok
					w.resolve();
					wait.callback.splice(i, 1); // delete
				} else if (Date.now() > w.timeout) { // timeout
					w.reject(errno.ERR_SYNC_WAIT_BLOCK_TIMEOUT);
					wait.callback.splice(i, 1); // delete
				} else { // wait
					i++;
				}
			}
		});
	}

	async waitBlockNumber(chain: ChainType, dao: string, blockNumber: number, timeout?: number) {
		somes.assert(web3s[chain], `Not supported ${ChainType[chain]}`);
		somes.assert(dao, `Bad argument. dao param not empty`);
		dao = dao.toLowerCase();

		let height = await Indexer.getWatchHeightFromHash(chain, dao);
		if (height >= blockNumber) {
			return;
		}

		return await somes.promise<void>((resolve, reject)=>{
			let wait = this._waits[`${chain}_${dao}`] || (this._waits[`${chain}_${dao}`] = {
				chain, dao, callback: []
			});
			wait.callback.push({ timeout: (timeout || 18e4/*180 second*/) + Date.now(), blockNumber, resolve, reject });
		});
	}
}

const _sync = new Sync();

export default _sync;