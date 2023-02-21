/**
 * @copyright © 2022 Copyright Smart Holder
 * @date 2022-08-19
 */

import db, { Asset, ChainType, ContractInfo } from '../db';
import somes from 'somes';
import _hash from 'somes/hash';
import {WatchCat} from 'bclib/watch';
import * as env from '../env';
import errno from '../errno';

export interface QueueData {
	id: number;
	asset_id: number;
	contract_info_id: number;
	canRetry: number;
	state: number;
	active: number;
	chain: ChainType;
}

export interface SyncRuning {
	asset_id: number;
	token: string;
	tokenId: string;
	uri: string;
	chain: ChainType;
}

export abstract class AssetSyncQueue implements WatchCat<any> {
	cattime =  2 * 10; // 2 minute

	protected _runing = 0; // 当前运行的数量
	protected _runingLimit = env.workers ? parseInt(String(30/env.workers.workers)): 20; // 可同时运行的数量
	protected _runingObj: Map<string, SyncRuning> = new Map();
	private _name = '';

	constructor(name: string) {
		this._name = name;
	}

	async cat() {
		for (var i = this._runing; i < this._runingLimit; i++) {
			this.dequeue();
		}
		for (var [_,{asset_id}] of this._runingObj) {
			await db.update(this._name, { active: Date.now() }, { asset_id }); // update active
		}
		return true;
	}

	async initialize() {
		var name = this._name;
		await db.load(`
			create table if not exists ${name} ( -- nft 同步队列
				id                 int    primary key auto_increment not null,
				asset_id           int                         not null,  -- 资产id
				contract_info_id   int                         not null,  -- 协约地址id
				chain              int                         not null,  -- chain id
				canRetry           int            default (0)  not null,  -- 在队列中可重试的次数
				state              int            default (0)  not null,  -- 0 待处理,1 正在处理中
				active             bigint         default (0)  not null   -- 处理这条数据的活跃时间,超过不活跃会重新加入处理
			);
		`,
		[], [
			`create unique  index ${name}_idx0         on ${name}             (chain,asset_id)`,
			`create         index ${name}_idx1         on ${name}             (chain,contract_info_id)`,
		], `shs_${name}`);
	}

	get runing() {
		return this._runingObj;
	}

	private async _Dequeue() {
		// 超过10分钟不活跃会重新加入处理
		var [it] = await db.query<QueueData>(
			`select * from ${this._name} where state = 0 or active < ${Date.now() - (10 * 60 * 1e3)} limit 1 \
		`);

		if (!it)
			return;

		let {asset_id,chain} = it;
		let idStr = `${asset_id}_${chain}`;

		let asset = await db.selectOne<Asset>(`asset_${chain}`, { id: asset_id });
		if (!asset) {
			await db.delete(this._name, {id: it.id}); // delete data
			if (it.canRetry-- > 0) { // re enqueue
				await db.insert(this._name, {
					asset_id,
					contract_info_id: it.contract_info_id,
					canRetry: it.canRetry,
					chain: it.chain
				});
				return;
			} else {
				throw Error.new(`#AssetSyncQueue#_Dequeue Asset data not found`,  {asset_id});
			}
		}

		let contract = await db.selectOne<ContractInfo>(`contract_info_${chain}`, { id: it.contract_info_id });
		if (!contract) {
			await db.delete(this._name, {id: it.id}); // delete data
			throw Error.new(`#AssetSyncQueue#_Dequeue Asset and ContractInfo data not found`,  asset);
		}

		let {token, tokenId} = asset;

		do {
			if (this._runingObj.has(idStr)) {
				await somes.sleep(somes.random(1e2, 1e3));
				// console.log(`this._runingObj.has()==${this._runingObj.has(idStr)}`, idStr);
				break;
			}

			try {
				this._runingObj.set(idStr, { asset_id, token, tokenId, uri: asset.uri, chain });
				// dequeue
				let state = somes.random(0, 0x7fffffff);
				let active = Date.now();
				await db.update(this._name, { state, active }, { id: it.id, state: it.state, active: it.active });
				// await somes.sleep(somes.random(1e2, 1e3));
				var [it] = await db.select<QueueData>(this._name, {id: it.id});
				if (!it || it.state != state || it.active != active) break;

				await this.sync(asset, chain, false, it); // sync
			} catch (err: any) {
				console.warn('#AssetSyncQueue#_Dequeue', ...err.filter(['message', 'description', 'stack']));
				await this._onErr(err, chain);
			} finally {
				this._runingObj.delete(idStr);
			}
		} while(0);

		somes.nextTick(()=>this.dequeue());
	}

	async sync(asset: Asset, chain: ChainType, force?: boolean, qd?: QueueData) {
		if (asset.retry < 10 || force) {
			try {
				await this.onSync(asset, chain);
				somes.assert(asset.mediaOrigin, errno.ERR_SYNC_META_IMAGE_NONE);
				await this.onSyncComplete(asset, chain);
				await db.delete(this._name, { asset_id: asset.id, chain }); // delete data
			} catch(err: any) {
				await this._onErr(asset, chain, qd);
			}
		}
	}

	private async _onErr(asset: Asset, chain: ChainType, qd?: QueueData) {
		let {id: asset_id} = asset;
		if (!qd) {
			qd = await db.selectOne<QueueData>(this._name, { asset_id, chain }) || undefined;
		}
		if (qd) {
			await db.delete(this._name, { asset_id }); // delete data
			if (qd.canRetry-- > 0) { // re enqueue
				await db.insert(this._name, { asset_id, contract_info_id: qd.contract_info_id, canRetry: qd.canRetry, chain: qd.chain });
			}
		}
		await this.onError(asset, chain);
	}

	protected abstract onSync(asset: Asset, chain: ChainType): Promise<void>;
	protected async onSyncComplete(asset: Asset, chain: ChainType) {}
	protected async onError(asset: Asset, chain: ChainType) {}

	isCanDequeue() {
		return true;
	}

	async isQueue(asset_id: number, chain: ChainType) {
		return !!await db.selectOne(this._name, { asset_id, chain });
	}

	async dequeue() {
		if (this._runing >= this._runingLimit) return;
		try {
			this._runing++;
			if (this.isCanDequeue()) { // disk space ok
				await this._Dequeue();
			} else {
				console.error('#AssetSyncQueue#dequeue ******** Insufficient disk space ********');
			}
		} finally {
			this._runing--;
		}
	}

	async enqueue(asset_id: number, address: string, chain: ChainType, canRetry = 1) { //  asset_contract_id: number
		if (!await this.isQueue(asset_id, chain)) {
			let ac = await db.selectOne<ContractInfo>(`contract_info_${chain}`, { address });
			if (ac) {
				await db.insert(this._name, { asset_id, contract_info_id: ac.id, canRetry, chain });
				this.dequeue();
			}
		}
	}

}
