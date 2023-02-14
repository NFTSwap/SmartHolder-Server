/**
 * @copyright © 2022 Copyright ccl
 * @date 2022-07-21
 */

import db, {ChainType, Member} from '../db';
import redis from 'bclib/redis';
import * as dao_fn from './dao';
import {getLimit} from './utils';

export async function getMembersFrom(chain: ChainType, host: string, owner?: string, limit?: number | number[]) {
	let dao = await dao_fn.getDAONoEmpty(chain, host);
	return await db.select<Member>(`member_${chain}`, {token: dao.member, owner}, {limit: getLimit(limit)});
}

export async function getMembersTotalFrom(chain: ChainType, host: string, owner?: string) {
	let key = `getMembersTotalFrom_${chain}_${owner}`;
	let total = await redis.get<number>(key);
	if (total === null) {
		let ls = await getMembersFrom(chain, host);
		await redis.set(key, total = ls.length, 1e4);
	}
	return total;
}
