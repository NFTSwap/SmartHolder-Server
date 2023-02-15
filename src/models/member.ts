/**
 * @copyright © 2022 Copyright ccl
 * @date 2022-07-21
 */

import db, {ChainType, Member} from '../db';
import redis from 'bclib/redis';
import * as dao_fn from './dao';
import {getLimit} from './utils';
import {escape} from 'somes/db';

export async function getMembersFrom(
	chain: ChainType, host: string,
	owner?: string, time?: number | number[], orderBy?: string, limit?: number | number[]
) {
	let dao = await dao_fn.getDAONoEmpty(chain, host);
	let sql = `select * from member_${chain} where token=${escape(dao.member)} `;

	if (owner)
		sql += `and owner=${escape(owner)} `;
	if (time) {
		let [s,e] = Array.isArray(time) ? time: [time];
		sql += `and time>=${escape(s)} `;
		if(e)
			sql += `and time<=${escape(e)} `;
	}
	if (orderBy)
		sql += `order by ${orderBy} `;
	// order by time desc
	if (limit)
		sql += `limit ${getLimit(limit).join(',')} `;

	return await db.query<Member>(sql);
}

export async function getMembersTotalFrom(chain: ChainType, host: string, owner?: string, time?: number | number[]) {
	let key = `getMembersTotalFrom_${chain}_${owner}_${time}`;
	let total = await redis.get<number>(key);
	if (total === null) {
		let ls = await getMembersFrom(chain, host, owner, time);
		await redis.set(key, total = ls.length, 1e4);
	}
	return total;
}
