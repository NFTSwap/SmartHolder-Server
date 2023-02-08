/**
 * @copyright © 2022 Copyright ccl
 * @date 2023-01-03
 */

import somes from 'somes';
import db, {ChainType, Asset, State, AssetOrder,Selling} from '../db';
import {escape} from 'somes/db';
import sync from '../sync';
import * as dao_fn from './dao';
import {getLimit} from './utils';
import * as redis from 'bclib/redis';
import errno from '../errno';

export interface AssetOrderExt extends AssetOrder {
	asset_id: number,
	asset: Asset;
}

async function tryBeautifulAsset(asset: Asset, chain: ChainType) {
	if (!asset.name || !asset.uri || !asset.mediaOrigin) {
		await somes.scopeLock(`asset_${asset.id}`, async ()=>{
			var [it] = await db.select<Asset>(`asset_${chain}`, {id:asset.id});
			if (!it.name || !it.uri || !it.mediaOrigin) {
				await sync.assetMetaDataSync.sync(asset, chain);
			} else {
				Object.assign(asset, it);
			}
		});
	}
	return asset;
}

export async function beautifulAsset(asset: Asset[], chain: ChainType) {
	var timeout = false;
	try {
		await somes.timeout((async () =>{
			for (var a of asset) {
				if (timeout) {
					break;
				} else {
					await tryBeautifulAsset(a, chain);
				}
			}
		})(), 1e4);
	} catch(err) {
		console.warn(err);
	}
	timeout = true;
}

export async function getAssetFrom(
	chain: ChainType, host: string, owner?: string,
	state = State.Enable,
	name?: string,
	time?: [number,number],
	selling?: Selling,
	limit?: number | number[], noBeautiful?: boolean
) {
	let dao = await dao_fn.getDAONoEmpty(chain, host);
	let sql = `select * from asset_${chain} where 
		token in (${escape(dao.first)},${escape(dao.second)}) \
		and owner=${escape(owner)} and state=${escape(state)} `;
	if (name)
		sql += `and name like ${escape(name+'%')} `;
	if (time)
		sql += `and time>=${escape(time[0])} and time<=${escape(time[1])} `;
	if (selling != undefined)
		sql += `and selling=${escape(selling)} `;
	if (limit)
		sql += `limit ${getLimit(limit).join(',')} `;
	let assets = await db.query<Asset>(sql);
	if (!noBeautiful) {
		await beautifulAsset(assets, chain);
	}
	return assets;
}

export function setAssetState(chain: ChainType, token: string, tokenId: string, state: State) {
	return db.update(`asset_${chain}`, {state}, { token, tokenId });
}

// 作品名称,开始时间/结束时间,作品所属,购买用户
export async function getAssetOrderFrom(
	chain: ChainType, host: string, fromAddres?: string, toAddress?: string, tokenId?: string,
	name?: string, time?: [number,number], limit?: number | number[]
) {
	let dao = await dao_fn.getDAONoEmpty(chain, host);
	let sql = `
		select ao.*, a.id as asset_id from asset_order_${chain} as ao 
		left join 
			asset_${chain} as a on ao.token=a.token and ao.tokenId=a.tokenId
		where
			ao.token in (${escape(dao.first)},${escape(dao.second)}) 
	`;
	if (tokenId)
		sql += `and ao.tokenId=${escape(tokenId)} `;
	if (fromAddres)
		sql += `and ao.fromAddres=${escape(fromAddres)} `;
	if (toAddress)
		sql += `and ao.toAddress=${escape(toAddress)} `;
	if (name)
		sql += `and a.name like ${escape(name+'%')} `;
	if (time)
		sql += `and ao.time>=${escape(time[0])} and ao.time<=${escape(time[1])} `;
	if (limit)
		sql += `limit ${getLimit(limit).join(',')} `;

	let order_1 = await db.query<AssetOrderExt>(sql);

	async function getAssetCache(chain: ChainType, id: number) {
		let key = `getAssetCache_${chain}_${id}`;
		let asset = await redis.get<Asset>(key);
		if (asset === null) {
			asset = await db.selectOne<Asset>(`asset_${chain}`, { id }) as Asset;
			somes.assert(asset, errno.ERR_ASSET_NOT_EXIST);
			await redis.set(key, asset, 1e4);
		}
		return asset as Asset;
	}

	for (let it of order_1)
		it.asset = await getAssetCache(chain, it.asset_id);
	await beautifulAsset(order_1.map(e=>e.asset), chain);
	return order_1;
}

export async function getAssetOrderTotalFrom(chain: ChainType, host: string, 
	fromAddres?: string, toAddress?: string, tokenId?: string, name?: string, time?: [number,number]
) {
	let total = await getOrderTotalAmount(chain, host, fromAddres, toAddress, tokenId, name, time);
	return total.total;
}

export async function getOrderTotalAmount(chain: ChainType, host: string,
	fromAddres?: string, toAddress?: string, tokenId?: string, name?: string, time?: [number,number]) {
	let key = `getOrderTotalAmount_${chain}_${host}_${fromAddres}_${toAddress}_${tokenId}_${name}_${time}`;
	let total = await redis.get<{total: number; amount:string}>(key);
	if (total === null) {
		let ls = await getAssetOrderFrom(chain, host, fromAddres, toAddress, tokenId, name, time);
		let amount = BigInt(0);
		for (let it of ls) {
			amount += BigInt(it.value);
		}
		await redis.set(key, total = { total: ls.length, amount: amount.toString() }, 1e4);
	}
	return total;
}

export async function getAssetTotalFrom(chain: ChainType, host: string, owner?: string, state = State.Enable, name?: string, time?: [number, number], selling?: Selling) {
	let key = `getAssetTotalFrom_${chain}_${owner}_${state}_${name}_${time?.join()}_${selling}`;
	let total = await redis.get<number>(key);
	if (total === null) {
		let ls = await getAssetFrom(chain, host, owner, state, name, time, selling, undefined, true);
		await redis.set(key, total = ls.length, 1e4);
	}
	return total;
}

export async function getAssetAmountTotal(chain: ChainType, host: string, owner?: string, state = State.Enable, name?: string) {
	let key = `getAssetAmountTotal_${chain}_${owner}_${state}_${name}`;
	let total = await redis.get<{assetTotal: number, assetAmountTotal: string}>(key);
	if (total === null) {
		let ls = await getAssetFrom(chain, host, owner, state, name, undefined, undefined, undefined, true);
		let assetTotal = 0;
		let assetAmountTotal = BigInt(0);

		for (let it of ls) {
			if (it.owner != '0x0000000000000000000000000000000000000000') {
				assetTotal++;
				if (it.selling) {
					assetAmountTotal += BigInt(it.sellPrice);
				} else {
					assetAmountTotal += BigInt(it.minimumPrice || 0);
				}
			}
		}

		await redis.set(key, total = {
			assetTotal, assetAmountTotal: '0x' + assetAmountTotal.toString(16),
		}, 1e4);
	}
	return total;
}