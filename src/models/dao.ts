/**
 * @copyright © 2022 Copyright ccl
 * @date 2022-07-21
 */

import somes from 'somes';
import db, { DAO, ChainType, Member, UserLikeDAO,LedgerType} from '../db';
import errno from '../errno';
import {escape} from 'somes/db';
import {getLimit,newQuery,useCache} from './utils';
import { DAOExtend, DAOSummarys } from './define_ext';
import {getVoteProposalFrom} from './vote_pool';
import {getAssetAmountTotal,getOrderTotalAmount} from './asset';
import {getLedgerTotalAmount} from './ledger';
import * as deployInfo from '../../deps/SmartHolder/deployInfo.json';
import * as member from './member';

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

export const fillMemberObjs = useCache(async (chain: ChainType, daos: DAOExtend[], memberObjs?:number)=>{
	for (let dao of daos) {
		if (memberObjs) {
			dao.memberObjs = await member.getMembersFrom.query({
				chain, host: dao.address, limit: Math.min(memberObjs, 10)
			}, {}, somes.random(8e4, 1e5)/* 80-100 second*/);
		} else {
			dao.memberObjs = [];
		}
	}
}, {name: 'fillMemberObjs'});

export const getDAOsFromOwner = newQuery(async ({
	chain,owner,memberObjs}:{chain: ChainType, owner: string, memberObjs?: number
}, {total,out})=>{
	somes.assert(chain, '#dao#getDAOsFromOwner Bad argument. chain');
	somes.assert(owner, '#dao#getDAOsFromOwner Bad argument. owner');

	let ms = await db.select<Member>(`member_${chain}`, {owner}, {group: 'host'});
	let hosts = ms.map(e=>`'${e.host}'`);
	let DAOs: DAOExtend[] = [];

	if (hosts.length) {
		DAOs = await db.query<DAO>(`select ${out} from dao_${chain} where address in (${hosts.join(',')})`);
	}
	if (total)
		return DAOs;

	await fillMemberObjs(chain, DAOs, memberObjs);

	return DAOs;
}, 'getDAOsFromOwner');

export const getAllDAOs = newQuery(async ({
	chain,name,user_id,owner,memberObjs,ids
}:{
	chain: ChainType, name?: string, user_id?: number,owner?: string, memberObjs?: number,ids?: number[]
},{orderBy,limit,total,out})=>{
	somes.assert(chain, '#dao#getAllDAOs Bad argument. chain');

	let sql = `select ${out} from dao_${chain} where state=0 `;
	if (name)
		sql += `and name like ${escape(name+'%')} `;
	if (ids && ids.length) {
		sql += `and id in (${ids.map(e=>escape(e)).join()}) `;
	}
	if (orderBy)
		sql += `order by ${orderBy} `;
	if (limit)
		sql += `limit ${getLimit(limit).join(',')} `;

	let daos = await db.query<DAOExtend>(sql);
	if (total)
		return daos;

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

	await fillMemberObjs(chain, daos, memberObjs);

	return daos;
}, 'getAllDAOs');

export const getDAOSummarys = useCache(async ({chain,host}: {chain: ChainType, host: string})=>{
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

	let {assetTotal,assetAmountTotal} = await getAssetAmountTotal({chain, host});
	let {total,amount} = await getOrderTotalAmount({chain, host});
	let assetLedgerIncomeTotal = await getLedgerTotalAmount({chain, host,type:LedgerType.AssetIncome});

	let summarys: DAOSummarys =  {
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

	return summarys;
}, {name: 'getDAOSummarys'});

export const getDAOsFromCreatedBy = newQuery(async ({
	chain,createdBy,memberObjs}:{chain: ChainType, createdBy: string, memberObjs?:number
},{total})=>{
	somes.assert(chain, '#dao#getDAOsFromCreatedBy Bad argument. chain');
	somes.assert(createdBy, '#dao#getDAOsFromCreatedBy Bad argument. createdBy');
	if (total)
		return await db.selectCount(`dao_${chain}`, {createdBy}) as any as DAOExtend[];
	let DAOs = await db.select<DAOExtend>(`dao_${chain}`, {createdBy});
	await fillMemberObjs(chain, DAOs, memberObjs);
	return DAOs;
}, 'getDAOsFromCreatedBy');

export function getDAOsAddress(chain: ChainType) {
	let chainName = ChainType[chain];
	let info = deployInfo[chainName.toLowerCase() as 'goerli'];
	somes.assert(info, `#dao.getDAOsAddress Deployment information not found by ${chainName}`);
	return info.DAOsProxy.address;
}