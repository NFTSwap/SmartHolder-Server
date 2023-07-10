/**
 * @copyright © 2022 Copyright smart holder
 * @date 2023-05-11
 */

import db, { ChainType, Selling } from "../db";
import {formatHex} from '../sync/scaner';
import {DatabaseCRUD} from 'somes/db';
import {AssetOrderExt} from './define_ext';
import {escape} from 'somes/db';
import {getLimit,newQuery,newCache,joinTable} from './utils';
import * as asset from './asset';

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
			await asset.getAssetFrom.query({chain, ids:order.map(e=>e.asset_id)},{noDAO:true}, 3e4)
		);
	}
	await asset.tryFetchAssetMetadatas(order.map(e=>e.asset!), chain);

	return order;
}, 'getAssetOrderFrom');

export const getOrderSummarys = newCache(getAssetOrderFrom.query, {
	after: (ls)=>{
		let amount = BigInt(0);
		for (let it of ls)
			amount += BigInt(it.value);
		return {
			total: ls.length, // @Deprecated
			totalItems: ls.length,
			amount: amount.toString(),
		};
	},
	name: 'getOrderSummarys',
});

// db selling order
export async function maskSellOrder(
	chain: ChainType,
	token: string, tokenId: string,
	count: bigint, seller: string, // TODO ...
	selling: Selling, sellPrice = '', db_?: DatabaseCRUD
) {
	let id = formatHex(tokenId, 32);
	let row: Dict = {selling};
	if (selling !== Selling.Unsell) {
		if (sellPrice)
		row.sellPrice = sellPrice;
		row.sellingTime = Date.now();
	}
	else if (selling === Selling.Unsell) {
		row.soldTime = Date.now();
	}
	await (db_||db).update(`asset_${chain}`, row, { token, tokenId: id });
	// console.log('maskOrderSelling', num, token, id);
}

export async function maskSellOrderClose(chain: ChainType,
	token: string, tokenId: string, count: bigint, seller: string, db_?: DatabaseCRUD) {
	await maskSellOrder(chain, token, tokenId, count, seller, Selling.Unsell, '', db_);
}

export async function maskSellOrderSold(chain: ChainType,
	token: string, tokenId: string, count: bigint, seller: string,db_?: DatabaseCRUD) {
	await maskSellOrder(chain, token, tokenId, count, seller, Selling.Unsell, '', db_);
}
