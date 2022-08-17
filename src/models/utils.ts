/**
 * @copyright © 2022 Copyright ccl
 * @date 2022-07-21
 */

import somes from 'somes';
import db, {DAO, ChainType, Member, Asset, State, AssetOrder, AssetExt, Ledger, Votes, VoteProposal} from '../db';
import mvpApi from '../request';
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
	return await db.select<Member>(`member_${chain}`, {token: dao.member, owner}, {limit});
}

export async function getAssetFrom(chain: ChainType, host: string, owner?: string, state = State.Enable, limit?: number | number[]) {
	let dao = await getDAONoEmpty(chain, host);
	return db.select<Asset>(`asset_${chain}`, { token: dao.assetGlobal, owner, state }, {limit});
}

export function setAssetState(chain: ChainType, token: string, tokenId: string, state: State) {
	return db.update(`asset_${chain}`, {state}, { token, tokenId });
}

export async function getAssetExt(chain: ChainType, token: string, tokenId: string) {
	let asset = await db.selectOne<Asset>(`asset_${chain}`, { token, tokenId });
	if (asset) {
		let {data: assets} = await mvpApi.post<AssetExt[]>('nft/getNFT', {token, tokenId, owner: asset.owner});
		return assets.length ? Object.assign(asset, assets[0]): asset as AssetExt;
	}
	return null;
}

export async function getAssetOrderFrom(chain: ChainType, host: string, fromAddres?: string, limit?: number | number[]) {
	let dao = await getDAONoEmpty(chain, host);
	return await db.select<AssetOrder>(`asset_order_${chain}`, {token: dao.assetGlobal, fromAddres}, {limit});
}

export async function getLedgerItemsFromHost(chain: ChainType, host: string, limit?: number | number[]) {
	let dao = await getDAONoEmpty(chain, host);
	return await db.select<Ledger>(`ledger_${chain}`, {address: dao.ledger}, {limit});
}

export function getVoteProposalFrom(chain: ChainType, address: string, proposal_id?: string, limit?: number | number[]) {
	somes.assert(address, '#utils#getVoteProposalFrom Bad argument. address');
	return db.select<VoteProposal>(`vote_proposal_${chain}`, {address, proposal_id}, {limit});
}

export function getVotesFrom(chain: ChainType, address: string, proposal_id: string, member_id?: string, limit?: number | number[]) {
	somes.assert(address, '#utils#getVotesFrom Bad argument. address');
	return db.select<Votes>(`votes_${chain}`, {address, proposal_id, member_id}, {limit});
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

export async function getAssetTotalFrom(chain: ChainType, host: string, owner?: string, state = State.Enable) {
	let key = `getAssetTotalFrom_${chain}_${owner}`;
	let total = await redis.get<number>(key);
	if (total === null) {
		let ls = await getAssetFrom(chain, host, owner, state);
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
