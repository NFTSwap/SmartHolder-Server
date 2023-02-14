/**
 * @copyright © 2022 Copyright ccl
 * @date 2022-07-21
 */

import db, {ChainType, State,Ledger, LedgerType, LedgerAssetIncome} from '../db';
import {escape} from 'somes/db';
import redis from 'bclib/redis';
import * as dao_fn from './dao';
import {getLimit} from './utils';

export async function getLedgerItemsFromHost(chain: ChainType, host: string,
	type?: LedgerType, time?: [number,number], state = State.Enable, limit?: number | number[]
) {
	let dao = await dao_fn.getDAONoEmpty(chain, host);
	let sql = `select * from ledger_${chain} where address=${escape(dao.ledger)} and state=${escape(state)} `
	if (type !== undefined)
		sql += `and type=${escape(type)} `;
	if (time)
		sql += `and time>=${escape(time[0])} and time<=${escape(time[1])} `;
	if (limit)
		sql += `limit ${getLimit(limit)} `;

	let ls = await db.query<Ledger>(sql);
	let IDs = ls.filter(e=>e.assetIncome_id).map(e=>e.assetIncome_id);

	if (IDs.length) {
		let assetIncomes: Dict<LedgerAssetIncome> = {};
		let sql = `select * from ledger_asset_income_${chain} where id in (${IDs.join(',')})`;
		for (let it of await db.query<LedgerAssetIncome>(sql))
			assetIncomes[it.id] = it;
		for (let it of ls) {
			it.assetIncome = assetIncomes[it.assetIncome_id];
		}
	}

	return ls;
}

export async function getLedgerItemsTotalFromHost(chain: ChainType, host: string, type?: LedgerType, time?: [number,number], state = State.Enable) {
	let total = await getLedgerTotalAmount(chain, host, type, time, state);
	return total.total;
}

export async function getLedgerTotalAmount(chain: ChainType, host: string, type?: LedgerType, time?: [number,number], state = State.Enable) {
	let key = `getLedgerTotalAmount_${chain}_${host}_${type}_${time}_${state}`;
	let total = await redis.get<{total: number; amount:string}>(key);
	if (total === null) {
		let ls = await getLedgerItemsFromHost(chain, host, type, time, state);
		let amount = BigInt(0);
		for (let it of ls)
			amount += BigInt(it.balance);
		await redis.set(key, total = { total: ls.length, amount: amount.toString()}, 1e4);
	}
	return total;
}

export async function setLedgerState(chain: ChainType, id: number, state: State) {
	return await db.update(`ledger_${chain}`, {state}, {id});
}
