/**
 * @copyright © 2022 Copyright ccl
 * @date 2022-07-21
 */

import somes from 'somes';
import db, { DAO, ChainType, Member, UserLikeDAO } from '../db';
import errno from '../errno';
import * as redis from 'bclib/redis';
import {escape} from 'somes/db';
import {getLimit} from './utils';

export function getDAO(chain: ChainType, address: string) {
	somes.assert(address, '#dao#getDAO Bad argument. address');
	return db.selectOne<DAO>(`dao_${chain}`, {address});
}

export async function getDAONoEmpty(chain: ChainType, address: string) {
	somes.assert(address, '#dao#getDAONoEmpty Bad argument. address');
	let dao = await db.selectOne<DAO>(`dao_${chain}`, {address});
	somes.assert(dao, errno.ERR_DAO_ADDRESS_NOT_EXISTS);
	return dao!;
}

export async function getDAOsFromOwner(chain: ChainType, owner: string) {
	somes.assert(chain, '#dao#getDAOsFromOwner Bad argument. chain');
	somes.assert(owner, '#dao#getDAOsFromOwner Bad argument. owner');

	let ms = await db.select<Member>(`member_${chain}`, {owner}, {group: 'host'});
	let hosts = ms.map(e=>`'${e.host}'`);
	let DAOs: DAO[] = [];

	if (hosts.length) {
		DAOs = await db.query<DAO>(`select * from dao_${chain} where address in (${hosts.join(',')})`);
	}
	return DAOs;
}

export async function getDAOsTotalFromOwner(chain: ChainType, owner: string) {
	let key = `getDAOsTotalFromOwner_${chain}_${owner}`;
	let total = await redis.get<number>(key);
	if (total === null) {
		let DAOs = await getDAOsFromOwner(chain, owner);
		await redis.set(key, total = DAOs.length, 1e4);
	}
	return total;
}

export interface DAOExtend extends DAO {
	isMember: boolean;
	isLike: boolean;
}

export async function getAllDAOs(chain: ChainType,
	name?: string, limit?: number | number[], user_id?: number, owner?: string
) {
	somes.assert(chain, '#dao#getAllDAOs Bad argument. chain');

	let sql = `select * from dao_${chain}`;
	if (name)
		sql += `where name like ${escape(name+'%')} `;
	if (limit)
		sql += `limit ${getLimit(limit).join(',')} `;

	let daos = await db.query<DAOExtend>(sql);

	daos.forEach(e=>Object.assign(e, {isJoin:false,isLike:false}));

	if (user_id && daos.length) {
		let likes = await db.query<UserLikeDAO>(`
			select * from user_like_dao 
				where user_id = ${escape(user_id)}
				and chain = ${escape(chain)}
				and dao_id in (${daos.map(e=>e.id).join(',')})
		`);
		let likeMap: Dict<boolean> = {};

		for (let like of likes) {
			likeMap[like.dao_id] = like.state == 0;
		}
		for (let dao of daos) {
			dao.isLike = !!likeMap[dao.id];
		}
	}

	if (owner && daos.length) {
		let tokenIDs = daos.map(e=>`'${e.member}'`);
		let members = await db.query<Member>(`
			select * from member_${chain} 
				where owner = ${escape(owner)}
				and token in (${tokenIDs.join(',')})
		`);
		let membersMap: Dict<boolean> = {};

		for (let member of members) {
			membersMap[member.token] = true;
		}
		for (let dao of daos) {
			dao.isMember = !!membersMap[dao.member];
		}
	}

	return daos;
}

export async function getAllDAOsTotal(chain: ChainType, name?: string) {
	let key = `getAllDAOsTotal_${chain}_${name}`;
	let total = await redis.get<number>(key);
	if (total === null) {
		let DAOs = await getAllDAOs(chain, name);
		await redis.set(key, total = DAOs.length, 1e4);
	}
	return total;
}
