/**
 * @copyright © 2022 Copyright ccl
 * @date 2022-07-21
 */

import somes from 'somes';
import db, {DAO, ChainType, Member, Asset, State, AssetOrder, 
	Ledger, LedgerType, Votes, VoteProposal, EventsItem, Selling
} from '../db';
import {escape} from 'somes/db';
import sync from '../sync';
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
	asset_id: number,
	asset: Asset;
}

export interface EventsItemExt extends EventsItem {
	member?: Member;
}

async function tryBeautifulAsset(asset: Asset, chain: ChainType) {
	if (!asset.uri || !asset.mediaOrigin) {
		await somes.scopeLock(`asset_${asset.id}`, async ()=>{
			var [it] = await db.select<Asset>(`asset_${chain}`, {id:asset.id});
			if (!it.uri || !asset.mediaOrigin) {
				await sync.assetMetaDataSync.sync(asset, chain);
			} else {
				Object.assign(asset, it);
			}
		});
	}
	return asset;
}

export async function beautifulAsset(asset: Asset[], chain: ChainType) {
	var timeout = false;
	try {
		await somes.timeout(async () =>{
			for (var a of asset) {
				if (timeout) {
					break;
				} else {
					await tryBeautifulAsset(a, chain);
				}
			}
		}, 1e4);
	} catch(err) {}
	timeout = true;
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
	limit?: number | number[], noBeautiful?: boolean
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
		sql += `limit ${getLimit(limit).join(',')} `;
	let assets = await db.query<Asset>(sql);
	if (!noBeautiful)
		await beautifulAsset(assets, chain);
	return assets;
}

export function setAssetState(chain: ChainType, token: string, tokenId: string, state: State) {
	return db.update(`asset_${chain}`, {state}, { token, tokenId });
}

// 作品名称,开始时间/结束时间,作品所属,购买用户
export async function getAssetOrderFrom(
	chain: ChainType, host: string, fromAddres?: string, toAddress?: string, tokenId?: string,
	name?: string, time?: [number,number], limit?: number | number[]
) {
	let dao = await getDAONoEmpty(chain, host);
	let sql = `
		select * from asset_order_${chain} as ao 
		left join 
			asset_${chain} as a on ao.token=a.token and ao.tokenId=a.tokenId
		where
			ao.token=${escape(dao.assetGlobal)} 
	`;
	if (tokenId)
		sql += `and ao.tokenId=${escape(tokenId)} `;
	if (fromAddres)
		sql += `and ao.fromAddres=${escape(fromAddres)} `;
	if (toAddress)
		sql += `and ao.toAddress=${escape(toAddress)} `;
	if (name)
		sql += `and a.name like ${escape(name+'%')} `;
	if (time)
		sql += `and ao.time>=${escape(time[0])} and ao.time<=${escape(time[1])} `;
	if (limit)
		sql += `limit ${getLimit(limit).join(',')} `;

	let order_1 = await db.query<AssetOrderExt>(sql);

	async function getAssetCache(chain: ChainType, id: number) {
		let key = `getAssetCache_${chain}_${id}`;
		let asset = await redis.get<Asset>(key);
		if (asset === null) {
			let asset = await db.selectOne<Asset>(`asset_${chain}`, { id }) as Asset;
			somes.assert(asset, errno.ERR_ASSET_NOT_EXIST);
			await redis.set(key, asset, 1e4);
		}
		return asset as Asset;
	}

	for (let it of order_1)
		it.asset = await getAssetCache(chain, it.asset_id);
	await beautifulAsset(order_1.map(e=>e.asset), chain);
	return order_1;
}

export async function getLedgerItemsFromHost(chain: ChainType, host: string,
	type?: LedgerType, time?: [number,number], state = State.Enable, limit?: number | number[]
) {
	let dao = await getDAONoEmpty(chain, host);
	let sql = `select * from ledger_${chain} where address=${escape(dao.ledger)} state=${escape(state)} `
	if (type !== undefined)
		sql += `type=${escape(type)} `;
	if (time)
		sql += `and time>=${escape(time[0])} and time<=${escape(time[1])} `;
	if (limit)
		sql += `limit ${getLimit(limit)} `;
	return await db.query<Ledger>(sql);
}

export async function getLedgerItemsTotalFromHost(chain: ChainType, host: string, type?: LedgerType, time?: [number,number], state = State.Enable) {
	let key = `getLedgerItemsTotalFromHost_${chain}_${host}_${type}_${time}_${state}`;
	let total = await redis.get<number>(key);
	if (total === null) {
		let ls = await getLedgerItemsFromHost(chain, host, type, time, state);
		await redis.set(key, total = ls.length, 1e4);
	}
	return total;
}

export async function getLedgerTotalAmount(chain: ChainType, host: string, time?: [number,number], state = State.Enable) {
	let dao = await getDAONoEmpty(chain, host);
	let sql = `select balance from ledger_${chain} where address=${escape(dao.ledger)} state=${escape(state)} `;
	if (time)
		sql += `and time>=${escape(time[0])} and time<=${escape(time[1])} `;
	let ls = await db.query<{balance: string}>(sql);
	let total = BigInt(0);
	for (let it of ls) {
		total += BigInt(it.balance);
	}
	return {
		total: ls.length,
		amount: total.toString(),
	};
}

export async function setLedgerState(chain: ChainType, id: number, state: State) {
	return await db.update(`ledger_${chain}`, {state}, {id});
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

export async function addEventsItem(chain: ChainType, host: string, title: string, description: string, created_member_id: string) {
	await db.insert(`events`, { chain, host, title, description, created_member_id, time: Date.now(), modify: Date.now() });
}

export async function setEventsItem(id: number, title?: string, description?: string, state?: State) {
	await db.update(`events`, { title, description, modify: Date.now(), state }, {id});
}

export async function getEventsItems(chain: ChainType, host: string, title?: string,
	created_member_id?: string, member?: string, state = State.Enable, limit?: number | number[], noMember?: boolean
) {
	let dao = await getDAONoEmpty(chain, host);
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

export async function getEventsItemsTotal(chain: ChainType, host: string, title?: string, created_member_id?: string, member?: string, state = State.Enable) {
	let key = `getEventsItemsTotal_${chain}_${host}_${title}_${created_member_id}_${member}_${state}`;
	let total = await redis.get<number>(key);
	if (total === null) {
		let ls = await getEventsItems(chain, host, title, created_member_id,member, state, undefined,true);
		await redis.set(key, total = ls.length, 1e4);
	}
	return total;
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
		let ls = await getAssetFrom(chain, host, owner, state, name, time, selling, undefined, true);
		await redis.set(key, total = ls.length, 1e4);
	}
	return total;
}

export async function getAssetOrderTotalFrom(chain: ChainType, host: string, 
	fromAddres?: string, toAddress?: string, tokenId?: string, name?: string, time?: [number,number]
) {
	let key = `getAssetOrderTotalFrom_${chain}_${host}_${fromAddres}_${toAddress}_${tokenId}_${name}_${time}`;
	let total = await redis.get<number>(key);
	if (total === null) {
		let ls = await getAssetOrderFrom(chain, host, fromAddres, toAddress, tokenId, name, time);
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

export async function getOrderTotalAmount(chain: ChainType, host: string, time?: [number,number]) {
	let dao = await getDAONoEmpty(chain, host);
	let sql = `select value from asset_order_${chain} where token=${escape(dao.assetGlobal)} `;
	if (time)
		sql += `and time>=${escape(time[0])} and time<=${escape(time[1])} `;
	let ls = await db.query<{value: string}>(sql);
	let total = BigInt(0);
	for (let it of ls) {
		total += BigInt(it.value);
	}
	return {
		total: ls.length,
		amount: total.toString(),
	};
}