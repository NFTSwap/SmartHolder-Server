/**
 * @copyright © 2022 Copyright ccl
 * @date 2022-07-21
 */

import db, {ChainType, State,Ledger, LedgerType, LedgerAssetIncome} from '../db';
import {escape} from 'somes/db';
import * as dao_fn from './dao';
import {getLimit,newCacheHandle, newQueryHandle} from './utils';

export const getLedgerFrom = newQueryHandle(async ({
	chain, host,type,time,state=State.Enable,asset
}: {
	chain: ChainType,
	host: string,
	type?: LedgerType,
	time?: [number,number],
	state?: State,
	asset?: boolean,
}, {orderBy,limit,total,out})=>{
	let dao = await dao_fn.getDAONoEmpty(chain, host);
	let sql = `select ${out} from ledger_${chain} \
		where address=${escape(dao.ledger)} and state=${escape(state)} `;
	if (type !== undefined)
		sql += `and type=${escape(type)} `;
	if (time)
		sql += `and time>=${escape(time[0])} and time<=${escape(time[1])} `;
	if (orderBy)
		sql += `order by ${orderBy} `;
	if (limit)
		sql += `limit ${getLimit(limit)} `;

	let ls = await db.query<Ledger>(sql);
	if (total)
		return ls;

	let IDs = ls.filter(e=>e.assetIncome_id).map(e=>e.assetIncome_id);

	if (asset && IDs.length) {
		let assetIncomes: Dict<LedgerAssetIncome> = {};
		let sql = `select * from ledger_asset_income_${chain} where id in (${IDs.join(',')})`;
		for (let it of await db.query<LedgerAssetIncome>(sql))
			assetIncomes[it.id] = it;
		for (let it of ls) {
			it.assetIncome = assetIncomes[it.assetIncome_id];
		}
	}
	return ls;
});

export const getLedgerTotalAmount = newCacheHandle(getLedgerFrom.query, {
	after: (e)=>{
		let amount = BigInt(0);
		for (let it of e)
			amount += BigInt(it.balance);
		return {total: e.length, amount: amount.toString()}
	}
});

export const setLedgerState = async (chain: ChainType, id: number, state: State)=>{
	await db.update(`ledger_${chain}`, {state}, {id});
};
