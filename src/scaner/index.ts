/**
 * @copyright © 2022 Smart Holder Server
 * @date 2022-07-21
 */

import somes from 'somes';
import {ContractScaner,ContractUnknown} from './scaner';
import {ContractType, ChainType, ContractInfo } from '../models/def';
import {DAO} from './dao';
import {AssetERC721} from './erc721';
import {Ledger} from './ledger';
import {Member} from './member';
import {VotePool} from './vote_pool';

export * from './scaner';

export function makeFrom(info: ContractInfo, chain: ChainType) {
	return make(info.address, info.type, chain);
}

export function make(address: string, type: ContractType, chain: ChainType): ContractScaner {
	var cs: ContractScaner;
	somes.assert(chain, 'scaner#make chain Invalid');

	if (type == ContractType.DAO) {
		cs = new DAO(address, type, chain);
	}
	else if (type == ContractType.ERC721) {
		cs = new AssetERC721(address, type, chain);
	}
	else if (type == ContractType.Asset) {
		cs = new AssetERC721(address, type, chain);
	}
	else if (type == ContractType.AssetGlobal) {
		cs = new AssetERC721(address, type, chain);
	}
	else if (type == ContractType.Ledger) {
		cs = new Ledger(address, type, chain);
	}
	else if (type == ContractType.Member) {
		cs = new Member(address, type, chain);
	}
	else if (type == ContractType.VotePool) {
		cs = new VotePool(address, type, chain);
	}
	else {
		cs = new ContractUnknown(address, ContractType.Invalid, chain);
	}
	return cs;
}