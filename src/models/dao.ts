/**
 * @copyright © 2022 Copyright ccl
 * @date 2022-07-21
 */

import somes from 'somes';
import db, { DAO, ChainType, Member, UserLikeDAO,LedgerType } from '../db';
import errno from '../errno';
import redis from 'bclib/redis';
import {escape} from 'somes/db';
import {getLimit} from './utils';
import { DAOExtend, DAOSummarys } from './define_ext';
import {getVoteProposalFrom} from './vote_pool';
import {getAssetAmountTotal,getOrderTotalAmount} from './asset';
import {getLedgerTotalAmount} from './ledger';
import * as deployInfo from '../../deps/SmartHolder/deployInfo.json';

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

export async function getAllDAOs(chain: ChainType,
	name?: string, user_id?: number, owner?: string, order?: string, limit?: number | number[]
) {
	somes.assert(chain, '#dao#getAllDAOs Bad argument. chain');

	let sql = `select * from dao_${chain} `;
	if (name)
		sql += `where name like ${escape(name+'%')} `;
	if (order)
		sql += `order by ${order} `;
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

export async function getDAOSummarys(chain: ChainType, host: string) {
	let key = `getSummarys${chain}_${host}`;
	let summarys = await redis.get<DAOSummarys>(key);

	if (summarys === null) {
		let dao = await getDAONoEmpty(chain, host);
		let voteProposalTotal = 0;
		let voteProposalPendingTotal = 0;
		let voteProposalExecutedTotal = 0;
		let voteProposalResolveTotal = 0;
		let voteProposalRejectTotal = 0;

		for (let p of await getVoteProposalFrom(chain, dao.root)) {
			voteProposalTotal++;
			if (p.isClose) {
				if (p.isAgree)
					voteProposalResolveTotal++;
				else 
					voteProposalRejectTotal++;
				if (p.isExecuted)
					voteProposalExecutedTotal++;
			} else {
				voteProposalPendingTotal++;
			}
		}

		let {assetTotal,assetAmountTotal} = await getAssetAmountTotal(chain, host);
		let {total,amount} = await getOrderTotalAmount(chain, host);
		let assetLedgerIncomeTotal = await getLedgerTotalAmount(chain, host,LedgerType.AssetIncome);

		summarys = {
			membersTotal: dao.members,
			voteProposalTotal,
			voteProposalPendingTotal,
			voteProposalExecutedTotal,
			voteProposalResolveTotal,
			voteProposalRejectTotal,
			assetTotal,
			assetAmountTotal,
			assetOrderTotal: total,
			assetOrderAmountTotal: amount,
			assetLedgerIncomeTotal: assetLedgerIncomeTotal.amount,
		};
		await redis.set(key, summarys, 2e4); // 20s
	}

	return summarys;
}

export async function getDAOsFromCreatedBy(chain: ChainType, createdBy: string) {
	somes.assert(chain, '#dao#getDAOsFromCreatedBy Bad argument. chain');
	somes.assert(createdBy, '#dao#getDAOsFromCreatedBy Bad argument. createdBy');
	let DAOs = await db.select<DAO>(`dao_${chain}`, {createdBy});
	return DAOs;
}

export async function getDAOsTotalFromCreatedBy(chain: ChainType, createdBy: string) {
	let key = `getDAOsTotalFromCreatedBy_${chain}_${createdBy}`;
	let total = await redis.get<number>(key);
	if (total === null) {
		let DAOs = await getDAOsFromCreatedBy(chain, createdBy);
		await redis.set(key, total = DAOs.length, 1e4);
	}
	return total;
}

export function getDAOsAddress(chain: ChainType) {
	let chainName = ChainType[chain];
	let info = deployInfo[chainName.toLowerCase() as 'goerli'];
	somes.assert(info, `#dao.getDAOsAddress Deployment information not found by ${chainName}`);
	return info.DAOsProxy.address;
}