/**
 * @copyright © 2021 Copyright ccl
 * @date 2021-07-06
 */

import db, { AssetContract, Asset, AssetType, ChainType, SyncMetaFirst } from '../db';
import somes from 'somes';
import _hash from 'somes/hash';
import {WatchCat} from 'bclib/watch';
import paths from 'bclib/paths';
// import * as cfg from '../../config';
import * as env from '../env';
import errno from '../errno';

// const platform = ({ darwin:'mac', win32: 'win', } as any)[process.platform] || process.platform;
const disk = require(`../../build/Release/hc`).disk;

export interface QueueData {
	id: number;
	asset_id: number;
	asset_contract_id: number;
	canRetry: number;
	state: number;
	active: number;
}

export interface SyncRuning {
	asset_id: number;
	token: string;
	tokenId: string;
	uri: string;
	type: AssetType;
	chain: ChainType;
}

// const tableName = 'asset_queue';

export abstract class SyncQueue implements WatchCat<any> {
	cattime =  2 * 10; // 2 minute

	protected _runing = 0; // 当前运行的数量
	protected _runingLimit = env.workers ? parseInt(String(30/env.workers.workers)): 20; // 可同时运行的数量
	protected _runingObj: Map<string, SyncRuning> = new Map();
	private _firstTimeout = 0;
	private _first_AssetContract?: number[];
	private _name = '';

	constructor(name: string) {
		this._name = name;
	}

	async initialize() {
		var name = this._name;
		await db.load(`
			create table if not exists ${name} ( -- nft 同步队列
				id                 int    primary key auto_increment not null,
				asset_id           int                         not null,  -- 资产id
				asset_contract_id  int                         not null,  -- 协约地址id
				canRetry           int            default (0)  not null,  -- 在队列中可重试的次数
				state              int            default (0)  not null,  -- 0 待处理，1 正在处理中
				active             bigint         default (0)  not null   -- 处理这条数据的活跃时间,超过不活跃会重新加入处理
			);
		`,
		[],
		[
			`create unique  index ${name}_idx0         on ${name}             (asset_id)`,
			`create         index ${name}_idx1         on ${name}             (asset_contract_id)`,
		], 'mvp-ser' + name);
	}

	async diskSpace() {
		if (process.platform == 'win32')
			return true;
		var info = disk.diskInfo(paths.var);
		if (info) {
			if (info.f_bsize * info.f_bavail > 2048 * 1024 * 1024) { // > 2Gb
				return true;
			}
		}
		return false;
	}

	async cat() {
		for (var i = this._runing; i < this._runingLimit; i++) {
			this.dequeue();
		}
		for (var [k,{asset_id}] of this._runingObj) {
			await db.update(this._name, { active: Date.now() }, { asset_id }); // update active
		}

		return true;
	}

	get runing() {
		return this._runingObj;
	}

	private async _First_AssetContract() {
		if (!this._first_AssetContract || this._firstTimeout < Date.now()) {
			var first = await db.select<SyncMetaFirst>('sync_meta_first', {status: 0});
			first = first.filter(e=>e.info.indexOf('meta')!=-1);
			if (first.length) {
				var ins = first.map(e=>`'${e.address}'`).join(',');
				this._first_AssetContract = (await db.query<AssetContract>(
					`select * from asset_contract where address in (${ins})`)).map(e=>e.id);
			} else {
				this._first_AssetContract = [];
			}
			this._firstTimeout = Date.now() + 6e4; // 60s
		}
		return this._first_AssetContract;
	}

	private async _Dequeue() {
		// console.log('_Dequeue() A');

		var fac = await this._First_AssetContract();
		while (fac.length) {
			let idx = somes.random(0, fac.length - 1);
			var [it] = await db.query<QueueData>(
				`select * from ${this._name} where asset_contract_id = ${fac[idx]}
						and (state = 0 or active < ${Date.now() - (10 * 60 * 1e3)}) limit 1 \
			`);
			if (it)
				break;
			fac.splice(idx, 1);
		}

		if (!it) {
			// 超过10分钟不活跃会重新加入处理
			var [it] = await db.query<QueueData>(
				`select * from ${this._name} where state = 0 or active < ${Date.now() - (10 * 60 * 1e3)} limit 1 \
			`);
		}

		// console.log('_Dequeue() B');

		if (!it) {
			// somes.nextTick(()=>this.dequeue());
			return;
		}

		var {asset_id} = it;
		var idStr = `${asset_id}`;

		var asset = await db.selectOne<Asset>('asset', { id: asset_id });
		if (!asset) {
			await db.delete(this._name, {id: it.id}); // delete data
			throw Error.new(`NFT data not found`,  {asset_id});
		}

		var contract = await db.selectOne<AssetContract>('asset_contract', { id: it.asset_contract_id });
		if (!contract) {
			await db.delete(this._name, {id: it.id}); // delete data
			throw Error.new(`NFT and AssetContract data not found`,  asset);
		}

		var {token, tokenId, chain, type} = asset;

		do {
			if (this._runingObj.has(idStr)) {
				await somes.sleep(somes.random(1e2, 1e3));
				// console.log(`this._runingObj.has()==${this._runingObj.has(idStr)}`, idStr);
				break;
			}

			try {
				this._runingObj.set(idStr, { asset_id, token, tokenId, uri: asset.uri, chain, type });
				// dequeue
				var state = somes.random(0, 0x7fffffff);
				var active = Date.now();
				await db.update(this._name, { state, active }, { id: it.id, state: it.state, active: it.active });
				// await somes.sleep(somes.random(1e2, 1e3));
				var [it] = await db.select<QueueData>(this._name, {id: it.id});
				if (!it || it.state != state || it.active != active) break;

				await this.sync(asset, false, it); // sync
			} catch (err: any) {
				console.warn('QueueData#_Dequeue', ...err.filter(['message', 'description'], ['stack', 'message', 'description']));
				await this._onErr(err);
			} finally {
				this._runingObj.delete(idStr);
			}
		} while(0);

		somes.nextTick(()=>this.dequeue());
	}

	async sync(asset: Asset, force?: boolean, qd?: QueueData) {
		if (asset.retry < 10 || force) {
			try {
				await this.onSync(asset);
				somes.assert(asset.image && asset.media, errno.ERR_SYNC_META_IMAGE_NONE);
				await this.onSyncComplete(asset);
				await db.delete(this._name, { asset_id: asset.id }); // delete data
			} catch(err: any) {
				await this._onErr(asset, qd);
			}
		}
	}

	private async _onErr(asset: Asset, qd?: QueueData) {
		var {id: asset_id} = asset;
		if (!qd) {
			var qd = await db.selectOne<QueueData>(this._name, { asset_id }) || undefined;
		}
		if (qd) {
			await db.delete(this._name, { asset_id }); // delete data
			if (qd.canRetry-- > 0) { // re enqueue
				await db.insert(this._name, { asset_id, asset_contract_id: qd.asset_contract_id, canRetry: qd.canRetry });
			}
		}
		await this.onError(asset);
	}

	protected abstract onSync(asset: Asset): Promise<void>;
	protected async onSyncComplete(asset: Asset) {}
	protected async onError(asset: Asset) {}

	isCanDequeue() {
		return this.diskSpace();
	}

	async dequeue() {
		if (!env.sync_meta)
			return;
		if (this._runing >= this._runingLimit)
			return;
		try {
			this._runing++;
			if (await this.isCanDequeue()) { // disk space ok
				await this._Dequeue();
			} else {
				console.error('******** Insufficient disk space ********');
			}
		} finally {
			this._runing--;
		}
	}

	async isQueue(asset_id: number) {
		return !!await db.selectOne(this._name, { asset_id });
	}

	async enqueue(asset_id: number, address: string, chain: ChainType, canRetry = 1) { //  asset_contract_id: number
		if (!await this.isQueue(asset_id)) {
			var ac = await db.selectOne<AssetContract>('asset_contract', { address, chain });
			if (ac) {
				await db.insert(this._name, { asset_id, asset_contract_id: ac.id, canRetry });
				this.dequeue();
			}
		}
	}

}
