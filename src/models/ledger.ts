/**
 * @copyright © 2022 Copyright ccl
 * @date 2022-07-21
 */

import db, {ChainType, State,Ledger, LedgerType, LedgerAssetIncome,SaleType} from '../db';
import {escape} from 'somes/db';
import {getLimit,useCache,newQuery,joinTable} from './utils';
import {getAssetFrom} from './asset';

export const getLedgerFrom = newQuery(async ({
	chain, host,type,time,state=State.Enable,ids
}: {
	chain: ChainType,
	host?: string,
	type?: LedgerType,
	time?: [number,number],
	ids?: number[],
	state?: State,
}, {orderBy,limit,out})=>{
	let sql = `select ${out} from ledger_${chain} where state=${escape(state)} `;
	if (host)
		sql += `and host=${escape(host)} `;
	if (type !== undefined)
		sql += `and type=${escape(type)} `;
	if (time)
		sql += `and time>=${escape(time[0])} and time<=${escape(time[1])} `;
	if (ids && ids.length)
		sql += `and id in (${ids.map(e=>escape(e)).join()}) `;
	if (orderBy)
		sql += `order by ${orderBy} `;
	if (limit)
		sql += `limit ${getLimit(limit)} `;

	return await db.query<Ledger>(sql);

}, 'getLedgerFrom');

export const getLedgerAssetIncomeFrom = newQuery(async ({
	chain,host,fromAddress,fromAddress_not,toAddress,toAddress_not,type,time
}:{
	chain: ChainType, host: string,
	fromAddress?: string, toAddress?: string,
	fromAddress_not?: string, toAddress_not?: string,
	type?: SaleType,time?: [number,number],
}, {orderBy,limit,out,total})=>{
	let sql = `select ${out} from ledger_asset_income_${chain} where host=${escape(host)} `;
	if (fromAddress)
		sql += `and fromAddress=${escape(fromAddress)} `;
	if (toAddress)
		sql += `and toAddress=${escape(toAddress)} `;
	if (fromAddress_not)
		sql += `and fromAddress!=${escape(fromAddress_not)} `;
	if (toAddress_not)
		sql += `and toAddress!=${escape(fromAddress_not)} `;
	if (type!=undefined)
		sql += `and type!=${escape(type)} `;
	if (time)
		sql += `and time>=${escape(time[0])} and time<=${escape(time[1])} `;
	if (orderBy)
		sql += `order by ${orderBy} `;
	if (limit)
		sql += `limit ${getLimit(limit)} `;

	let ls = await db.query<LedgerAssetIncome>(sql);
	if (total)
		return ls;

	if (ls.length) {
		joinTable(ls, 'ledger', 'ledger_id', 'id',
			await getLedgerFrom.query({chain,ids:ls.map(e=>e.ledger_id)},{},3e4)
		);
		joinTable(ls, 'asset', 'asset_id', 'id',
			await getAssetFrom.query({chain,ids:ls.map(e=>e.asset_id)},{noDAO:true,noBeautiful:true},3e4)
		);
	}
	return ls;
});

export const getLedgerSummarys = useCache(getLedgerFrom.query, {
	after: (e)=>{
		let income = BigInt(0);
		let expenditure = BigInt(0);
		for (let it of e) {
			switch(it.type) {
				case LedgerType.Receive: // income
				case LedgerType.Deposit:// income
				case LedgerType.AssetIncome:// income
					income += BigInt(it.balance); break;
				case LedgerType.Withdraw: // expenditure
				case LedgerType.Release: // expenditure
					expenditure += BigInt(it.balance); break;
				default: break; // Reserved
			}
		}
		return {
			total: e.length,
			totalItems: e.length,
			income: income.toString(),
			expenditure: expenditure.toString(),
			amount: (income + expenditure).toString(),
		};
	},
	name: 'getLedgerSummarys',
});

export const setLedgerState = async (chain: ChainType, id: number, state: State)=>{
	await db.update(`ledger_${chain}`, {state}, {id});
};
