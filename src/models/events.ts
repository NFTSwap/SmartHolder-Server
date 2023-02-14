/**
 * @copyright © 2022 Copyright ccl
 * @date 2022-07-21
 */

import db, {ChainType, Member, State,EventsItem} from '../db';
import {escape} from 'somes/db';
import redis from 'bclib/redis';
import * as dao_fn from './dao';
import {getLimit} from './utils';

export interface EventsItemExt extends EventsItem {
	member?: Member;
}

export async function addEventsItem(chain: ChainType, host: string, title: string, description: string, created_member_id: string) {
	await db.insert(`events`, { chain, host, title, description, created_member_id, time: Date.now(), modify: Date.now() });
}

export async function setEventsItem(id: number, title?: string, description?: string, state?: State) {
	await db.update(`events`, { title, description, modify: Date.now(), state }, {id});
}

export async function getEventsItems(chain: ChainType, host: string, title?: string,
	created_member_id?: string, member?: string, time?: [number, number],
	state = State.Enable, limit?: number | number[], noMember?: boolean
) {
	let dao = await dao_fn.getDAONoEmpty(chain, host);
	let sql = `select * from events where chain=${escape(chain)} and host=${escape(host)} `;
	if (title)
		sql += `and title like ${escape(title+'%')} `;
	if (created_member_id)
		sql += `and created_member_id=${escape(created_member_id)} `;
	else if (member) {
		let m = await db.query<{id:number}>(`select id from member_${chain} where name like ${escape(member+'%')}`);
		if (m.length)
			sql += `and created_member_id in (${escape(m.map(e=>e.id))}) `;
		else return [];
	}
	if (time)
		sql += `and time>=${escape(time[0])} and time<=${escape(time[1])} `;
	if (state != undefined)
		sql += `and state=${escape(state)} `;
	if (limit)
		sql += `limit ${getLimit(limit).join(',')} `;
	let items = await db.query<EventsItemExt>(sql);

	if (!noMember) {
		for (let it of items) {
			if (it.created_member_id) {
				it.member = await db.selectOne<Member>(`member_${chain}`, { token: dao.member, tokenId: it.created_member_id }) || undefined;
			}
		}
	}
	return items;
}

export async function getEventsItemsTotal(chain: ChainType, host: string, title?: string,
	created_member_id?: string, member?: string, time?: [number, number], state = State.Enable
) {
	let key = `getEventsItemsTotal_${chain}_${host}_${title}_${created_member_id}_${member}_${time}_${state}`;
	let total = await redis.get<number>(key);
	if (total === null) {
		let ls = await getEventsItems(chain, host, title, created_member_id,member, time, state, undefined,true);
		await redis.set(key, total = ls.length, 1e4);
	}
	return total;
}
