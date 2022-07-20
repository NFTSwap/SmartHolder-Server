/**
 * @copyright © 2021 Copyright ccl
 * @date 2021-09-29
 */

import db, {storage, AssetContract, AssetType, ChainType,SyncMetaFirst} from '../db';
import {WatchCat} from 'bclib/watch';
import * as asset from '../scaner';
import {isRpcLimitDataSize, web3s, isRpcLimitRequestAccount} from '../web3+';
import _sync from '.';
import {update as updateAc} from '../models/contract';

async function sync(ac: AssetContract, force?: boolean) {
	if (ac.state || !ac.sync_height) return;
	if (ac.type == AssetType.INVALID) return;

	if (!web3s[ac.chain]) {
		// console.warn(`${ChainType[ac.chain]} Web3 is not configured`);
		return;
	}

	var watch = asset.makeFrom(ac);
	try {
		if (!watch.isValid || !watch.enableWatch) return; // chain is valid
		if (watch.type == AssetType.INVALID || watch.type == AssetType.ERC20) return;

		if (!force) {
			if (ac.sync_height < _sync.watchBlocks[watch.web3.chain].blockNumber) {
				return;
			}
		}

		//var isMaticvigil = (watch.web3.getProvider() as string).indexOf('maticvigil.com') != -1;
		var blockNumber = await watch.web3.getBlockNumber() - 5; // 延迟查询5个块
		var end = ac.sync_height;
		var start = end - 5/*向后延伸5个块*/, limit = 990; //isMaticvigil ? 990: 1e4;
		var count = 0;

		while (start && start <= blockNumber) {
			end = Math.min(start + limit, blockNumber);
			try {
				if (!force) {
					if (start < _sync.watchBlocks[watch.web3.chain].blockNumber) {
						return; // exit, use main watch
					}
				}

				await watch.sync(start, end);

				ac.sync_height = end + 1;

				await updateAc({ sync_height: ac.sync_height }, ac.address, ac.chain);

				limit = 990;//isMaticvigil ? 990: 1e4;
				start = ac.sync_height;

				if (++count > 20) {
					return true; // 限制只sync 20次，腾出时间给其它协约，以避免worker在一个协约上消耗太多时间
				}
			} catch(err: any) {
				if (isRpcLimitDataSize(watch.web3, err)) {
						limit = Math.max(1, Math.floor(limit / 2));
				} else {
					throw err;
				}
			}
		}
	} catch(err:any) {
		if (isRpcLimitRequestAccount(watch.web3, err)) {
			watch.web3.swatchRpc();
			throw err;
		} else {
			console.warn('sync/asset#sync', ac.address, AssetType[ac.type], ChainType[ac.chain], err.message);
		}
	}
}

export class FirstAssetSync implements WatchCat {
	readonly cattime = 5;

	private _firstTimeout = 0;
	private _first?: Set<string>;

	private async first_() {
		if (!this._first || this._firstTimeout < Date.now()) {
			var first = await db.select<SyncMetaFirst>('sync_meta_first', {status: 0});
			this._first = new Set();
			for (var i of first) {
				if (i.info.indexOf('block') != -1)
					this._first.add(i.address);
			}
			this._firstTimeout = Date.now() + 6e4; // 60s
		}
		return this._first;
	}

	private async first() {
		var _firstIn = [];
		for (var addr of await this.first_())
			_firstIn.push(addr);
		return _firstIn;
	}

	async exists(address: string) {
		return (await this.first_()).has(address);
	}

	async cat() {
		var first = await this.first();
		do {
			var continue_ = false;
			for (var address of first) {
				var ac = await db.selectOne<AssetContract>('asset_contract', {address, state: 0});
				if (ac)
					continue_ = await sync(ac, true) || continue_;
			}
		} while (continue_);
		return true;
	}
}

export class AssetSync implements WatchCat {
	readonly cattime = 5;
	private _workId: number;
	private _workerCount: number;
	private _first: FirstAssetSync;

	constructor(first: FirstAssetSync, workId: number, workerCount: number = 10) {
		this._first = first;
		this._workId = workId;
		this._workerCount = workerCount;
	}

	async _Sync(ac: AssetContract) {
		if (ac.id % this._workerCount === this._workId) {
			if (await this._first.exists(ac.address)) {
				console.log('ignore first Asset sync', this._workId, ac.address);
			} else {
				return await sync(ac);
			}
		}
	}

	async cat() {
		var offset = await storage.get(`AssetSync_${this._workId}`, 0);
		var continue_ = false;
		do {
			var list = await db.query<AssetContract>(
				`select * from asset_contract where state = 0 and id>${offset} and id<${offset+1e2+1}`);
			for (var ac of list) {
				continue_ = await this._Sync(ac) || continue_;
			}
			offset += 1e2;
			await storage.set(`AssetSync_${this._workId}`, offset);
		} while(list.length || (continue_ ? (continue_ = false, offset = 0, true): false));

		if (offset)
			await storage.set(`AssetSync_${this._workId}`, 0);

		return true;
	}
}