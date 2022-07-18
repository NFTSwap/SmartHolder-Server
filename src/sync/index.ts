/**
 * @copyright © 2021 Copyright ccl
 * @date 2021-07-06
 */

import * as cfg from '../../config';
import * as env from '../env';
import {WatchCat} from 'bclib/watch';
import {AssetSync,FirstAssetSync} from './asset';
import {WatchBlock} from './block';
//
import * as web3 from '../web3+';

export class Sync {
	/*2 worker for assetMetaDataSync*/
	readonly firstAssetSync = new FirstAssetSync();
	readonly assetSyncs: AssetSync[] = [];
	readonly watchBlocks: Dict<WatchBlock> = {};

	async initialize(addWatch: (watch: WatchCat)=>void) {
		var _sync = this;

		if (cfg.env == 'dev') {// test
			// addWatch(new Test); // test
			// addWatch(_sync.staticContractsSync);
		}

		var isMainWorker = !env.workers || env.workers.id === 0;

		// await this.assetMetaDataSync.initialize();
		// await this.assetMetaDataSync.assetMetaSourceDownload.initialize();

		if (env.sync_main) {

		// 	for (var [k,v] of Object.entries(web3.web3s)) {
		// 		_sync.watchBlocks[k] = env.workers ?
		// 			new WatchBlock(v, env.workers.id, env.workers.workers): new WatchBlock(v, 0, 1);
		// 		addWatch(_sync.watchBlocks[k]);
		// 	}

			if (env.workers) {
		// 		this.assetSyncs.push(new AssetSync(_sync.firstAssetSync, env.workers.id, env.workers.workers));
		// 		//addWatch(this.assetSyncs[0]); // disable asset mode watch
		// 	} else {
		// 		for (var i = 0; i < 8; i++) { // 8 workers
		// 			this.assetSyncs.push(new AssetSync(_sync.firstAssetSync, i, 8));
		// 			//addWatch(this.assetSyncs[i]); // disable asset mode watch
		// 		}
			}

			if (isMainWorker) { // only main worker
		// 		addWatch(_sync.firstAssetSync);
		// 		addWatch(_sync.staticContractsSync);
		// 		addWatch(_sync.assetMetaDataUpdate);
			}
		}

		//if (env.sync_meta) {
		// 	addWatch(this.assetMetaDataSync);
		// 	addWatch(this.assetMetaDataSync.assetMetaSourceDownload);
		// 	addWatch(_sync.assetInfoSync);
		// 	if (isMainWorker) { // only main worker
		// 		addWatch(_sync.qiniuSync);
		// 	}
		//}

	}
}

const _sync = new Sync();

export default _sync;