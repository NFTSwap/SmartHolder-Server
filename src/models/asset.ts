/**
 * @copyright © 2022 Copyright ccl
 * @date 2023-01-03
 */

import somes from 'somes';
import db, {ChainType, Asset, State,AssetType,Selling} from '../db';
import {AssetOrderExt,AssetExt} from './define_ext';
import {escape} from 'somes/db';
import sync from '../sync';
import * as dao_fn from './dao';
import {getLimit,newQuery,useCache,joinTable} from './utils';

export const tryFetchAssetMetadata = async (asset: Asset, chain: ChainType)=>{
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

export const tryFetchAssetMetadatas = async (asset: Asset[], chain: ChainType)=>{
	var timeout = false;
	try {
		await somes.timeout((async () =>{
			for (var a of asset) {
				if (timeout) {
					break;
				} else {
					await tryFetchAssetMetadata(a, chain);
				}
			}
		})(), 1e4);
	} catch(err) {
		console.warn(err);
	}
	timeout = true;
};

export const getAssetFrom = newQuery(async ({
	chain,host, owner,author, owner_not,author_not, state,name,time,selling,selling_not,assetType,tokens,ids
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
	selling?: Selling, selling_not?: Selling,
	assetType?: AssetType,
	tokens?: string[],
	ids?: number[],
}, {out,total,limit,orderBy}, {noBeautiful,noDAO}: {noBeautiful?: boolean,noDAO?:boolean}={})=>{
	let sql = `select `;

	if (owner /*|| owner_not*/) {
		sql += total ? out:
			`a.*, ao.id as ao_id, ao.owner as ao_owner, ao.count as ao_count `;
		sql += `\
						from asset_${chain} as a right join asset_owner_${chain} as ao on a.id = ao.asset_id \
						where a.state=${escape(state)} and a.totalSupply!=0 `;
		if (owner)
			sql += `and ao.owner=${escape(owner)} and ao.count!=0 `;
		// if (owner_not)
		// 	sql += `and ao.owner!=${escape(owner_not)} and ao.count!=0 `;
	} else {
		sql += `${out} from asset_${chain} as a where a.state=${escape(state)} and a.totalSupply!=0 `;
	}

	if (host) {
		sql += `and a.host=${escape(host)} `;
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
	if (tokens && tokens.length)
		sql += `and a.tokenId in (${tokens.map(e=>escape(e)).join()}) `;
	if (ids && ids.length)
		sql += `and a.id in (${ids.map(e=>escape(e)).join()}) `;
	if (selling != undefined)
		sql += `and a.selling=${escape(selling)} `;
	if (selling_not != undefined)
		sql += `and a.selling!=${escape(selling_not)} `;

	if (orderBy)
		sql += `order by ${orderBy} `;
	if (limit)
		sql += `limit ${getLimit(limit).join(',')} `;

	let assets = await db.query<AssetExt>(sql);

	if (total) // return total
		return assets;

	assets = assets.map((e:any)=>({
		...e,
		properties: e.properties || [],
		asset_owner: owner /*|| owner_not*/ ? {
			id: e.ao_id,
			asset_id: e.id,
			token: e.token,
			tokenId: e.tokenId,
			owner: e.ao_owner,
			count: e.ao_count,
		}: undefined,
	}));

	if (!noDAO && assets.length) {
		joinTable(assets,'dao','host','address',
			await dao_fn.getAllDAOs.query({chain,ids:assets.map(e=>e.id)}, {}, 3e4)
		);
	}

	if (!noBeautiful)
		await tryFetchAssetMetadatas(assets, chain);

	return assets;
}, 'getAssetFrom');

export const setAssetState = async (chain: ChainType, token: string, tokenId: string, state: State)=>{
	return db.update(`asset_${chain}`, {state}, { token, tokenId });
};

// 作品名称,开始时间/结束时间,作品所属,购买用户
export const getAssetOrderFrom = newQuery(async ({
	chain, host,
	fromAddres, toAddress,
	fromAddres_not, toAddress_not, tokenId, name, time
}: {
	chain: ChainType, host: string,
	fromAddres?: string, toAddress?: string,
	fromAddres_not?: string, toAddress_not?: string, tokenId?: string,
	name?: string, time?: [number,number]
}, {out,total,orderBy,limit})=>{
	let sql = total ? `select ${out} `: `select ao.* `;
	sql += `
		from asset_order_${chain} as ao 
		left join 
			asset_${chain} as a on ao.asset_id=a.id 
		where 
			ao.host=${escape(host)} 
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

	let order = await db.query<AssetOrderExt>(sql);
	if (total)
		return order;
	order = order.filter(e=>e.asset_id);

	if (order.length) {
		joinTable(order, 'asset', 'asset_id', 'id',
			await getAssetFrom.query({chain, ids:order.map(e=>e.asset_id)},{noDAO:true}, 3e4)
		);
	}
	await tryFetchAssetMetadatas(order.map(e=>e.asset!), chain);

	return order;
}, 'getAssetOrderFrom');

export const getOrderTotalAmount = useCache(getAssetOrderFrom.query, {
	after: (ls)=>{
		let amount = BigInt(0);
		for (let it of ls)
			amount += BigInt(it.value);
		return { total: ls.length, amount: amount.toString() };
	},
	name: 'getOrderTotalAmount',
});

export const getAssetAmountTotal = useCache(getAssetFrom.query, {
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
	},
	name: 'getAssetAmountTotal',
});
