/**
 * @copyright © 2022 Copyright ccl
 * @date 2022-07-21
 */

import somes from 'somes';
import db, {ChainType, Votes, VoteProposal } from '../db';
import redis from 'bclib/redis';
import {getLimit,LIMIT_MAX} from './utils';
import {escape} from 'somes/db';

export function getVoteProposalFrom(
	chain: ChainType, address: string, proposal_id?: string,
	name?: string, isAgree?: boolean,isClose?: boolean, isExecuted?: boolean, target?: string,
	order?: string, limit?: number | number[]
) {
	somes.assert(address, '#utils#getVoteProposalFrom Bad argument. address');

	let sql = `select * from vote_proposal_${chain} where address=${escape(address)} `;
	if (proposal_id)
		sql += `and proposal_id=${escape(proposal_id)} `;
	if (isAgree!==undefined)
		sql += `and isAgree=${escape(isAgree)} `;
	if (isClose!==undefined)
		sql += `and isClose=${escape(isClose)} `;
	if (isExecuted!==undefined)
		sql += `and isExecuted=${escape(isExecuted)} `;
	if (target)
		sql += `and isExecuted=${escape(target)} `;
	if (name)
		sql += `and name like ${escape(name+'%')} `;
	if (order)
		sql += `order by ${order} `;

	sql += `limit ${getLimit(limit).join(',')} `;

	return db.query<VoteProposal>(sql);
}

export function getVotesFrom(
	chain: ChainType, address: string, proposal_id: string,
	member_id?: string, order?: string, limit?: number | number[]
) {
	somes.assert(address, '#utils#getVotesFrom Bad argument. address');
	return db.select<Votes>(`votes_${chain}`, {address, proposal_id, member_id}, {limit: getLimit(limit), order});
}

export async function getVoteProposalTotalFrom(
	chain: ChainType, address: string, proposal_id?: string,
	name?: string, isAgree?: boolean, isClose?: boolean, isExecuted?: boolean, target?: string
) {
	let key = `getVoteProposalTotalFrom_${chain}_${address}_\
${proposal_id}_${name}${isAgree}${isClose}${isExecuted}${target}`;
	let total = await redis.get<number>(key);
	if (total === null) {
		let ls = await getVoteProposalFrom(chain, address,
			proposal_id, name,isAgree,isClose,isExecuted,target,undefined,LIMIT_MAX);
		await redis.set(key, total = ls.length, 1e4);
	}
	return total;
}

export async function getVotesTotalFrom(chain: ChainType, address: string, proposal_id: string, member_id?: string) {
	let key = `getVotesTotalFrom_${chain}_${address}_${proposal_id}`;
	let total = await redis.get<number>(key);
	if (total === null) {
		let ls = await getVotesFrom(chain, address, proposal_id, member_id, undefined,LIMIT_MAX);
		await redis.set(key, total = ls.length, 1e4);
	}
	return total;
}
