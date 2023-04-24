/**
 * @copyright © 2022 Copyright ccl
 * @date 2023-01-03
 */

import somes from 'somes';
import db, {ChainType, Asset, State,DAO,AssetType} from '../db';
import {AssetOrderExt,AssetExt} from './define_ext';
import {escape} from 'somes/db';
import sync from '../sync';
import * as dao_fn from './dao';
import {getLimit,newQueryHandle,newCacheHandle} from './utils';
import redis from 'bclib/redis';
import errno from '../errno';

export const tryBeautifulAsset = async (asset: Asset, chain: ChainType)=>{
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
};

export const beautifulAsset = async (asset: Asset[], chain: ChainType)=>{
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
};

export const getAssetFrom = newQueryHandle(async ({
	chain,host, owner,author, owner_not,author_not, state,name,time,assetType
}: {
	chain: ChainType,
	host?: string,
	owner?: string,
	author?: string,
	owner_not?: string,
	author_not?: string,
	state?: State,
	name?: string,
	time?: number | [number,number],
	assetType?: AssetType,
}, {out,total,limit,orderBy}, {noBeautiful}: {noBeautiful?: boolean}={})=>{
	let sql = `select `;

	if (owner || owner_not) {
		sql += total ? out:
			`a.*, ao.id as ao_id, ao.owner as ao_owner, ao.count as ao_count `;
		sql += `\
						from asset_${chain} as a right join asset_owner_${chain} as ao on a.id = ao.asset_id \
						where a.state=${escape(state)} and a.totalSupply!=0 `;
		if (owner)
			sql += `and ao.owner=${escape(owner)} `;
		if (owner_not)
			sql += `and ao.owner!=${escape(owner_not)} `;
	} else {
		sql += `${out} from asset_${chain} as a where a.state=${escape(state)} and a.totalSupply!=0 `;
	}

	let dao: DAO | null = null;
	if (host) {
		dao = await dao_fn.getDAONoEmpty(chain, host);
		sql += `and a.hose=${escape(host)} `;
	}
	if (assetType)
		sql += `and a.assetType=${assetType} `;
	if (author)
		sql += `and a.author=${escape(author)} `;
	if (author_not)
		sql += `and a.author!=${escape(author_not)} `;
	if (name)
		sql += `and a.name like ${escape(name+'%')} `;
	if (time) {
		let [s,e] = Array.isArray(time) ? time: [time];
		sql += `and a.time>=${escape(s)} `;
		if(e)
			sql += `and a.time<=${escape(e)} `;
	}
	if (orderBy)
		sql += `order by ${orderBy} `;
	if (limit)
		sql += `limit ${getLimit(limit).join(',')} `;

	let assets = await db.query<AssetExt>(sql);

	if (total) // return total
		return assets;

	assets = assets.map((e:any)=>({
		...e,
		asset_owner: {
			id: e.ao_id,
			asset_id: e.id,
			token: e.token,
			tokenId: e.tokenId,
			owner: e.ao_owner,
			count: e.ao_count,
		},
	}));

	if (dao) {
		assets.forEach(e=>(e.dao = dao!));
	}
	else if (assets.length) {
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
});

export const setAssetState = async (chain: ChainType, token: string, tokenId: string, state: State)=>{
	return db.update(`asset_${chain}`, {state}, { token, tokenId });
};

// 作品名称,开始时间/结束时间,作品所属,购买用户
export const getAssetOrderFrom = newQueryHandle(async ({
	chain, host,
	fromAddres, toAddress,
	fromAddres_not, toAddress_not, tokenId,
	name, time
}: {
	chain: ChainType, host: string,
	fromAddres?: string, toAddress?: string,
	fromAddres_not?: string, toAddress_not?: string, tokenId?: string,
	name?: string, time?: [number,number]
}, {out,total,orderBy,limit})=>{
	let dao = await dao_fn.getDAONoEmpty(chain, host);
	let sql = total ? `select ${out} `: `select ao.*, a.id as asset_id `;
	sql = `
		from asset_order_${chain} as ao 
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
	if (orderBy)
		sql += `order by ${orderBy} `;
	if (limit)
		sql += `limit ${getLimit(limit).join(',')} `;

	let order_1 = await db.query<AssetOrderExt>(sql);
	if (total)
		return order_1;

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
});

export const getOrderTotalAmount = newCacheHandle(getAssetOrderFrom.query, {
	after: (ls)=>{
		let amount = BigInt(0);
		for (let it of ls)
			amount += BigInt(it.value);
		return { total: ls.length, amount: amount.toString() };
	}
});

export const getAssetAmountTotal = newCacheHandle(getAssetFrom.query, {
	after: async (ls)=>{
		let assetTotal = 0;
		let assetAmountTotal = BigInt(0);

		for (let it of ls) {
			assetTotal++;
			assetAmountTotal += BigInt(it.minimumPrice || 0);
		}
		return {
			assetTotal, assetAmountTotal: assetAmountTotal.toString(),
		};
	}
});
