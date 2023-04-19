/**
 * @copyright © 2022 Copyright ccl
 * @date 2023-01-03
 */

import somes from 'somes';
import db, {ChainType, Asset, State,Selling,ContractType,DAO} from '../db';
import {AssetOrderExt,AssetExt} from './define_ext';
import {escape} from 'somes/db';
import sync from '../sync';
import * as dao_fn from './dao';
import {getLimit} from './utils';
import redis from 'bclib/redis';
import errno from '../errno';

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
	chain: ChainType,
	host?: string,
	owner?: string,
	author?: string,
	owner_not?: string,
	author_not?: string,
	state = State.Enable,
	name?: string,
	time?: number | [number,number],
	selling?: Selling,
	selling_not?: Selling,
	orderBy?: string,
	limit?: number | number[],
	noBeautiful?: boolean
) {
	let sql = `select * from asset_${chain} where state=${escape(state)} `;
	let dao: DAO | null = null;
	if (host) {
		dao = await dao_fn.getDAONoEmpty(chain, host);
		sql += `and token in (${escape(dao.first)},${escape(dao.second)}) `;
	} else {
		sql += `and type=${ContractType.AssetShell} `;
	}
	if (owner)
		sql += `and owner=${escape(owner)} `;
	if (owner_not)
		sql += `and owner!=${escape(owner_not)} `;
	if (!owner && !owner_not)
		sql += `and owner!='0x0000000000000000000000000000000000000000' `;
	if (author)
		sql += `and author=${escape(author)} `;
	if (author_not)
		sql += `and author!=${escape(author_not)} `;
	if (name)
		sql += `and name like ${escape(name+'%')} `;
	if (time) {
		let [s,e] = Array.isArray(time) ? time: [time];
		sql += `and time>=${escape(s)} `;
		if(e)
			sql += `and time<=${escape(e)} `;
	}
	if (selling != undefined)
		sql += `and selling=${escape(selling)} `;
	if (selling_not != undefined)
		sql += `and selling!=${escape(selling_not)} `;
	if (orderBy)
		sql += `order by ${orderBy} `;
	if (limit)
		sql += `limit ${getLimit(limit).join(',')} `;

	let assets = await db.query<AssetExt>(sql);

	if (dao) {
		assets.forEach(e=>(e.dao = dao!));
	} else if (assets.length) {
		let DAO_IDs: Dict<AssetExt[]> = {};

		for (let e of assets) {
			if (e.host) {
				let arr = DAO_IDs[e.host];
				if (arr)
					arr.push(e);
				else
					DAO_IDs[e.host] = [e];
			}
		}

		let DAOs = Object.keys(DAO_IDs);
		if (DAOs.length) {
			let sql = `
				select * from dao_${chain} where state=0 and 
				address in (${DAOs.map(e=>escape(e)).join(',')})
			`;
			for (let dao of await db.query<DAO>(sql)) {
				for (let a of DAO_IDs[dao.address])
					a.dao = dao;
			}
		}
	}

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
	chain: ChainType, host: string,
	fromAddres?: string, toAddress?: string,
	fromAddres_not?: string, toAddress_not?: string, tokenId?: string,
	name?: string, time?: [number,number], order?: string, limit?: number | number[]
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
	if (fromAddres_not)
		sql += `and ao.fromAddres!=${escape(fromAddres_not)} `;
	if (toAddress_not)
		sql += `and ao.toAddress!=${escape(toAddress_not)} `;
	if (name)
		sql += `and a.name like ${escape(name+'%')} `;
	if (time)
		sql += `and ao.time>=${escape(time[0])} and ao.time<=${escape(time[1])} `;
	if (order)
		sql += `order by ${order} `;
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

	order_1 = order_1.filter(e=>e.asset_id);

	for (let it of order_1)
		it.asset = await getAssetCache(chain, it.asset_id!);
	await beautifulAsset(order_1.map(e=>e.asset!), chain);
	return order_1;
}

export async function getAssetOrderTotalFrom(chain: ChainType, host: string, 
	fromAddres?: string, toAddress?: string, 
	fromAddres_not?: string, toAddress_not?: string,
	tokenId?: string, name?: string, time?: [number,number]
) {
	let total = await getOrderTotalAmount(chain, host, fromAddres, toAddress,
		fromAddres_not,toAddress_not,tokenId, name, time);
	return total.total;
}

export async function getOrderTotalAmount(chain: ChainType, host: string,
	fromAddres?: string, toAddress?: string,
	fromAddres_not?: string, toAddress_not?: string,
	tokenId?: string, name?: string, time?: [number,number]) {
	let key = `getOrderTotalAmount_${chain}_${host}_${fromAddres}_${toAddress}_\
${fromAddres_not}_${toAddress_not}_${tokenId}_${name}_${time}`;

	let total = await redis.get<{total: number; amount:string}>(key);
	if (total === null) {
		let ls = await getAssetOrderFrom(chain, host, fromAddres, toAddress, 
			fromAddres_not, toAddress_not, tokenId, name, time);
		let amount = BigInt(0);
		for (let it of ls) {
			amount += BigInt(it.value);
		}
		await redis.set(key, total = { total: ls.length, amount: amount.toString() }, 1e4);
	}
	return total;
}

export async function getAssetTotalFrom(
	chain: ChainType, host?: string,
	owner?: string, author?: string,
	owner_not?: string, author_not?: string,
	state = State.Enable, name?: string, time?: [number, number], selling?: Selling, selling_not?: Selling
) {
	let key = `getAssetTotalFrom_${chain}_${owner}_${author}_${owner_not}\
_${author_not}_${state}_${name}_${time?.join()}_${selling}_${selling_not}`;
	let total = await redis.get<number>(key);
	if (total === null) {
		let ls = await getAssetFrom(chain, host, owner, author, owner_not,
				author_not, state, name, time, selling, selling_not, '', undefined, true);
		await redis.set(key, total = ls.length, 1e4);
	}
	return total;
}

export async function getAssetAmountTotal(
	chain: ChainType, host: string,
	owner?: string, author?: string,
	owner_not?: string, author_not?: string,
	state = State.Enable, name?: string
) {
	let key = `getAssetAmountTotal_${chain}_${owner}_${author}_${owner_not}_${author_not}_${state}_${name}`;
	let total = await redis.get<{assetTotal: number, assetAmountTotal: string}>(key);
	if (total === null) {
		let ls = await getAssetFrom(chain, host, owner, author,
			owner_not, author_not, state, name, undefined, undefined, undefined, '', undefined, true
		);
		let assetTotal = 0;
		let assetAmountTotal = BigInt(0);

		for (let it of ls) {
			if (it.owner != '0x0000000000000000000000000000000000000000') {
				assetTotal++;
				if (it.selling) {
					assetAmountTotal += BigInt(it.sellPrice || 0);
				} else {
					assetAmountTotal += BigInt(it.minimumPrice || 0);
				}
			}
		}

		await redis.set(key, total = {
			assetTotal, assetAmountTotal: assetAmountTotal.toString(),
		}, 1e4);
	}
	return total;
}