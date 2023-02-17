/**
 * @copyright © 2022 Copyright ccl
 * @date 2022-07-21
 */

import somes from 'somes';
import db, {ChainType, Votes, VoteProposal } from '../db';
import redis from 'bclib/redis';
import {getLimit,LIMIT_MAX} from './utils';

export function getVoteProposalFrom(chain: ChainType, address: string, proposal_id?: string, order?: string, limit?: number | number[]) {
	somes.assert(address, '#utils#getVoteProposalFrom Bad argument. address');
	return db.select<VoteProposal>(`vote_proposal_${chain}`, {address, proposal_id}, {limit: getLimit(limit), order});
}

export function getVotesFrom(chain: ChainType, address: string, proposal_id: string, member_id?: string, order?: string, limit?: number | number[]) {
	somes.assert(address, '#utils#getVotesFrom Bad argument. address');
	return db.select<Votes>(`votes_${chain}`, {address, proposal_id, member_id}, {limit: getLimit(limit), order});
}

export async function getVoteProposalTotalFrom(chain: ChainType, address: string, proposal_id?: string) {
	let key = `getVoteProposalTotalFrom_${chain}_${address}_${proposal_id}`;
	let total = await redis.get<number>(key);
	if (total === null) {
		let ls = await getVoteProposalFrom(chain, address, proposal_id, undefined,LIMIT_MAX);
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
