/**
 * @copyright © 2022 Copyright ccl
 * @date 2022-07-21
 */

import db, {ChainType,State,Ledger,LedgerType,
	LedgerAssetIncome,SaleType,LedgerBalance} from '../db';
import {escape} from 'somes/db';
import {getLimit,newCache,newQuery,joinTable} from './utils';
import {getAssetFrom} from './asset';

export const getLedgerFrom = newQuery(async ({
	chain,host,type,time,state=State.Enable,ids,target,target_not,ref
}: {
	chain: ChainType,
	host: string,
	type?: LedgerType,
	time?: [number,number],
	ids?: number[],
	state?: State,
	target?: string, target_not?: string,
	ref?: string,
}, {orderBy,limit,out,total}, {noJoin}: {noJoin?: boolean}={})=>{
	let sql = `select ${out} from ledger_${chain} where state=${escape(state)} `;
	if (host)
		sql += `and host=${escape(host)} `;
	if (type !== undefined)
		sql += `and type=${escape(type)} `;
	if (time)
		sql += `and time>=${escape(time[0])} and time<=${escape(time[1])} `;
	if (ids && ids.length)
		sql += `and id in (${ids.map(e=>escape(e)).join()}) `;
	if (target)
		sql += `and target=${escape(target)} `;
	if (target_not)
		sql += `and target!=${escape(target_not)} `;
	if (ref)
		sql += `and ref=${escape(ref)} `;
	if (orderBy)
		sql += `order by ${orderBy} `;
	if (limit)
		sql += `limit ${getLimit(limit)} `;

		let ls = await db.query<Ledger>(sql);

	if (total)
		return ls;

	if (!noJoin && ls.length) {
		joinTable(ls, 'assetIncome', 'id', 'id',
			await getLedgerAssetIncomeFrom.query({chain,host,ids:ls.map(e=>e.id)},{noJoin:true},3e4)
		);
	}
	return ls;
}, 'getLedgerFrom');

export const getLedgerAssetIncomeFrom = newQuery(async ({
	chain,host,fromAddress,fromAddress_not,toAddress,toAddress_not,type,time,ids
}: {
	chain: ChainType, host: string,
	fromAddress?: string, toAddress?: string,
	fromAddress_not?: string, toAddress_not?: string,
	type?: SaleType,time?: [number,number],
	ids?: number[],
}, { orderBy,limit,out,total }, {noJoin}: {noJoin?: boolean}={})=>{
	let sql = `select ${out} from ledger_asset_income_${chain} `;

	sql += host? `where host=${escape(host)} `: `where 1 `;

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
	if (ids && ids.length)
		sql += `and id in (${ids.map(e=>escape(e)).join()}) `;
	if (orderBy)
		sql += `order by ${orderBy} `;
	if (limit)
		sql += `limit ${getLimit(limit)} `;

	let ls = await db.query<LedgerAssetIncome>(sql);
	if (total)
		return ls;

	if (ls.length) {
		if (!noJoin)
			joinTable(ls, 'ledger', 'id', 'id',
				await getLedgerFrom.query({chain,host,ids:ls.map(e=>e.id)},{noJoin:true},3e4)
			);
		joinTable(ls, 'asset', 'asset_id', 'id',
			await getAssetFrom.query({chain,ids:ls.map(e=>e.asset_id)},{noDAO:true,noBeautiful:true},3e4)
		);
	}
	return ls;
});

export const getLedgerSummarys = newCache(getLedgerFrom.query, {
	after: async (e, [opts])=>{
		const zero = BigInt(0);
		// const addressZero = '0x0000000000000000000000000000000000000000';
		let balance = await getLedgerBalance.query(opts);
		let summarys: Dict<{
			items: number,
			income: bigint,
			expenditure: bigint,
			balance: LedgerBalance,
			assetSaleAmount: bigint,
		}> = {};

		for (let l of e) {
			let b = summarys[l.erc20] || (summarys[l.erc20] = {
				items: 0, income: zero, expenditure: zero,
				assetSaleAmount: zero,
				balance: balance.find(e=>e.erc20==l.erc20)!
			});

			switch(l.type) {
				case LedgerType.Receive: // income
				case LedgerType.Deposit:// income
				case LedgerType.AssetIncome:// income
					b.income += BigInt(l.amount);
					break;
				case LedgerType.Withdraw: // expenditure
				case LedgerType.Release: // expenditure
					b.expenditure += BigInt(l.amount); break;
				default: break; // Reserved
			}

			if (l.type == LedgerType.AssetIncome) {
				b.assetSaleAmount += BigInt(l.assetIncome!.price);
			}

			b.items++;
		}

		return Object.values(summarys).map(e=>{
			return {
				items: e.items,
				value: e.income - e.expenditure + '', // 当前金额
				income: e.income + '',
				expenditure: e.expenditure + '', // 
				amount: e.income + e.expenditure + '', // 流水金额
				assetSaleAmount: e.assetSaleAmount + '',
				balance: e.balance,
			};
		});
	},
	name: 'getLedgerSummarys',
});

export const setLedgerState = async (chain: ChainType, id: number, state: State)=>{
	await db.update(`ledger_${chain}`, {state}, {id});
};

export const getLedgerBalance = newQuery(({ chain,host }: {
	chain: ChainType, host?: string,
}, { limit,out })=>{
	return db.select<LedgerBalance>(`ledger_balance_${chain}`, {host}, {limit,out});
});