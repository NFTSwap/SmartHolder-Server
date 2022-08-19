/**
 * @copyright © 2022 Copyright ccl
 * @date 2022-07-21
 */

import somes from 'somes';
import db, {DAO, ChainType, Member, Asset, State, AssetOrder, Ledger, Votes, VoteProposal, EventsItem, Selling} from '../db';
import {escape} from 'somes/db';
import {beautifulAsset} from '../sync/asset_meta';
import errno from '../errno';
import {web3s} from '../web3+';
import * as cfg from '../../config';
import * as redis from 'bclib/redis';
import * as utils from '../utils';

export interface TokenURIInfo {
	name: string;
	description: string;
	image: string;
	animation_url?: string;
	external_link?: string;
	attributes?: {trait_type: string; value: string}[]
}

export interface AssetOrderExt extends AssetOrder {
	asset: Asset;
}

export interface EventsItemExt extends EventsItem {
	member?: Member;
}

function getLimit(limit?: number|number[]) {
	limit = limit ? limit: [0, 100];
	if (!Array.isArray(limit))
		limit = [0,limit];
	somes.assert(limit[0] < 10000, 'Limit offset must be less than 10000');
	somes.assert(limit[1] <= 100, 'Limit quantity can only be within 100');
	// limit[0] = Math.min(10000, limit[0]);
	// limit[1] = Math.min(100, limit[1]);
	return limit;
}

export async function getAssetFrom_0(
	chain: ChainType, host: string, owner?: string, 
	state = State.Enable,
	name?: string,
	time?: [number,number],
	selling?: Selling,
	limit?: number | number[]
) {
	let dao = await getDAONoEmpty(chain, host);
	let sql = `select * from asset_${chain} where token=${escape(dao.assetGlobal)} and owner=${escape(owner)} and state=${escape(state)} `;
	if (name)
		sql += `and title like ${escape(name+'%')} `;
	if (time)
		sql += `and time>=${escape(time[0])} and time<=${escape(time[1])} `;
	if (selling != undefined)
		sql += `and selling=${escape(selling)} `;
	if (limit)
		sql += `limit ${escape(getLimit(limit).join(','))} `;
	let assets = await db.query<Asset>(sql);
	return assets;
}

async function getAssetCache(chain: ChainType, token: string, tokenId: string) {
	let key = `getAssetCache_${chain}_${token}_${tokenId}`;
	let asset = await redis.get<Asset>(key);
	if (asset === null) {
		let asset = await db.selectOne<Asset>(`asset_${chain}`, { token, tokenId }) as Asset;
		somes.assert(asset, errno.ERR_ASSET_NOT_EXIST);
		await redis.set(key, asset, 1e4);
	}
	return asset as Asset;
}

async function getEventsItems_0(chain: ChainType, host: string, title?: string, created_member_id?: string, limit?: number | number[]) {
	let sql = `select * from events where chain=${escape(chain)} and host=${escape(host)} `;
	if (title)
		sql += `and title like ${escape(title+'%')} `;
	if (created_member_id)
		sql += `and created_member_id=${escape(created_member_id)} `;
	if (limit)
		sql += `limit ${escape(getLimit(limit).join(','))} `;
	let items = await db.query<EventsItemExt>(sql);
	return items;
}

export function getDAO(chain: ChainType, address: string) {
	somes.assert(address, '#utils#getDAO Bad argument. address');
	return db.selectOne<DAO>(`dao_${chain}`, {address});
}

export async function getDAONoEmpty(chain: ChainType, address: string) {
	somes.assert(address, '#utils#getDAONoEmpty Bad argument. address');
	let dao = await db.selectOne<DAO>(`dao_${chain}`, {address});
	somes.assert(dao, errno.ERR_DAO_ADDRESS_NOT_EXISTS);
	return dao!;
}

export async function getDAOsFromOwner(chain: ChainType, owner: string) {
	somes.assert(chain, '#utils#getDAOsFromOwner Bad argument. chain');
	somes.assert(owner, '#utils#getDAOsFromOwner Bad argument. owner');

	let ms = await db.select<Member>(`member_${chain}`, {owner}, {group: 'host'});
	let hosts = ms.map(e=>`'${e.host}'`);
	let DAOs: DAO[] = [];

	if (hosts.length) {
		DAOs = await db.query<DAO>(`select * from dao_${chain} where address in (${hosts.join(',')})`);
	}
	return DAOs;
}

export async function getMembersFrom(chain: ChainType, host: string, owner?: string, limit?: number | number[]) {
	let dao = await getDAONoEmpty(chain, host);
	return await db.select<Member>(`member_${chain}`, {token: dao.member, owner}, {limit: getLimit(limit)});
}

export async function getAssetFrom(
	chain: ChainType, host: string, owner?: string, 
	state = State.Enable,
	name?: string,
	time?: [number,number],
	selling?: Selling,
	limit?: number | number[]
) {
	let assets = await getAssetFrom_0(chain, host, owner, state, name, time, selling, limit);
	await beautifulAsset(assets, chain);
	return assets;
}

export function setAssetState(chain: ChainType, token: string, tokenId: string, state: State) {
	return db.update(`asset_${chain}`, {state}, { token, tokenId });
}

export async function getAssetOrderFrom(chain: ChainType, host: string, fromAddres?: string, limit?: number | number[]) {
	let dao = await getDAONoEmpty(chain, host);
	let order = await db.select<AssetOrderExt>(`asset_order_${chain}`, {token: dao.assetGlobal, fromAddres}, {limit: getLimit(limit)});
	for (let it of order)
		it.asset = await getAssetCache(chain, it.token, it.tokenId);
	await beautifulAsset(order.map(e=>e.asset), chain);
	return order;
}

export async function getLedgerItemsFromHost(chain: ChainType, host: string, limit?: number | number[]) {
	let dao = await getDAONoEmpty(chain, host);
	return await db.select<Ledger>(`ledger_${chain}`, {address: dao.ledger}, {limit: getLimit(limit)});
}

export function getVoteProposalFrom(chain: ChainType, address: string, proposal_id?: string, limit?: number | number[]) {
	somes.assert(address, '#utils#getVoteProposalFrom Bad argument. address');
	return db.select<VoteProposal>(`vote_proposal_${chain}`, {address, proposal_id}, {limit: getLimit(limit)});
}

export function getVotesFrom(chain: ChainType, address: string, proposal_id: string, member_id?: string, limit?: number | number[]) {
	somes.assert(address, '#utils#getVotesFrom Bad argument. address');
	return db.select<Votes>(`votes_${chain}`, {address, proposal_id, member_id}, {limit: getLimit(limit)});
}

export async function getOpenseaContractJSON(host: string, chain?: ChainType) {
	let dao: DAO | null = null;
	if (chain) {
		dao = await db.selectOne<DAO>(`dao_${chain}`, { address: host });
	} else {
		for (let chain of Object.keys(web3s)) {
			dao = await db.selectOne<DAO>(`dao_${chain}`, { address: host });
			if (dao) break;
		}
	}

	if (dao) {
		return {
			name: dao.name, // "OpenSea Creatures",
			description: dao.description, // desc
			image: `${cfg.publicURL}/image.png`, //"external-link-url/image.png",
			external_link: cfg.publicURL, // "external-link-url",
			seller_fee_basis_points: Number(dao.assetCirculationTax) || 100,// 100 # Indicates a 1% seller fee.
			fee_recipient: dao.ledger, // "0xA97F337c39cccE66adfeCB2BF99C1DdC54C2D721" // # Where seller fees will be paid to.
		};
	} else {
		return null;
	}
}

export async function addEventsItem(chain: ChainType, title: string, description: string, created_member_id: string) {
	await db.insert(`events`, { chain, title, description, created_member_id, time: Date.now(), modify: Date.now() });
}

export async function getEventsItems(chain: ChainType, host: string, title?: string, created_member_id?: string, limit?: number | number[]) {
	let dao = await getDAONoEmpty(chain, host);
	let items = await getEventsItems_0(chain, host, title, created_member_id, limit);
	for (let it of items) {
		if (it.created_member_id) {
			it.member = await db.selectOne<Member>(`member_${chain}`, { token: dao.member, tokenId: it.created_member_id }) || undefined;
		}
	}
	return items;
}

export async function getEventsItemsTotal(chain: ChainType, host: string, title?: string, created_member_id?: string) {
	let key = `getEventsItemsTotal_${chain}_${host}_${title}_${created_member_id}`;
	let total = await redis.get<number>(key);
	if (total === null) {
		let ls = await getEventsItems_0(chain, host, title, created_member_id);
		await redis.set(key, total = ls.length, 1e4);
	}
	return total;
}

// ----------------------------- Total ------------------------------

export async function getDAOsTotalFromOwner(chain: ChainType, owner: string) {
	let key = `getDAOsTotalFromOwner_${chain}_${owner}`;
	let total = await redis.get<number>(key);
	if (total === null) {
		let DAOs = await getDAOsFromOwner(chain, owner);
		await redis.set(key, total = DAOs.length, 1e4);
	}
	return total;
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

export async function getAssetTotalFrom(chain: ChainType, host: string, owner?: string, state = State.Enable, name?: string, time?: [number, number], selling?: Selling) {
	let key = `getAssetTotalFrom_${chain}_${owner}_${state}_${name}_${time?.join()}_${selling}`;
	let total = await redis.get<number>(key);
	if (total === null) {
		let ls = await getAssetFrom_0(chain, host, owner, state, name, time, selling);
		await redis.set(key, total = ls.length, 1e4);
	}
	return total;
}

export async function getAssetOrderTotalFrom(chain: ChainType, host: string, fromAddres?: string) {
	let key = `getAssetOrderTotalFrom_${chain}_${host}_${fromAddres}`;
	let total = await redis.get<number>(key);
	if (total === null) {
		let ls = await getAssetOrderFrom(chain, host, fromAddres);
		await redis.set(key, total = ls.length, 1e4);
	}
	return total;
}

export async function getLedgerItemsTotalFromHost(chain: ChainType, host: string) {
	let key = `getLedgerItemsTotalFromHost_${chain}_${host}`;
	let total = await redis.get<number>(key);
	if (total === null) {
		let ls = await getLedgerItemsFromHost(chain, host);
		await redis.set(key, total = ls.length, 1e4);
	}
	return total;
}

export async function getVoteProposalTotalFrom(chain: ChainType, address: string, proposal_id?: string) {
	let key = `getVoteProposalTotalFrom_${chain}_${address}_${proposal_id}`;
	let total = await redis.get<number>(key);
	if (total === null) {
		let ls = await getVoteProposalFrom(chain, address, proposal_id);
		await redis.set(key, total = ls.length, 1e4);
	}
	return total;
}

export async function getVotesTotalFrom(chain: ChainType, address: string, proposal_id: string, member_id?: string) {
	let key = `getVotesTotalFrom_${chain}_${address}_${proposal_id}`;
	let total = await redis.get<number>(key);
	if (total === null) {
		let ls = await getVotesFrom(chain, address, proposal_id, member_id);
		await redis.set(key, total = ls.length, 1e4);
	}
	return total;
}

export async function saveTokenURIInfo(info: TokenURIInfo) {
	/*
	// {
	// 	"name": "Diva 007",
	// 	"description": "#007\nElement: air",
	// 	"external_link": "https://opensea.io/collection/naturedivas/",
	// 	"image": "https://lh3.googleusercontent.com/U61KH6g_g2sO7ZOz92ILJm-hAYzWdpQScWD9Kk3O78pJh4_39QV0qvzLlG_CmkC0N18r6brELJuvrrlarlu-LAAgDwAVxkwXYGux",
	// 	"animation_url": null
	// 	"images": [],
	// attributes: [
	// {
	// trait_type: "Bones",
	// value: "Emerald"
	// },
	// {
	// trait_type: "Clothes",
	// value: "None"
	// },
	// {
	// trait_type: "Mouth",
	// value: "None"
	// },
	// {
	// trait_type: "Eyes",
	// value: "None"
	// },
	// {
	// trait_type: "Hat",
	// value: "Confetti Party Hat"
	// },
	// {
	// trait_type: "Super Power",
	// value: "None"
	// }
	// ]
	// }
*/
	return await utils.storage(JSON.stringify(info), '.json');
}
