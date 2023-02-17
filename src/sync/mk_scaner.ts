/**
 * @copyright © 2022 Smart Holder Server
 * @date 2022-07-21
 */

import somes from 'somes';
import {ContractScaner,ContractUnknown} from './scaner';
import {ContractType, ChainType, ContractInfo } from '../models/define';
import {DAO} from './dao';
import {AssetERC721} from './asset';
import {Ledger} from './ledger';
import {Member} from './member';
import {VotePool} from './vote_pool';
import {DAOs} from './daos';
import {DatabaseCRUD} from 'somes/db';

export * from './scaner';

export function makeFrom(info: ContractInfo, chain: ChainType, db?: DatabaseCRUD) {
	return make(info.address, info.type, chain, db);
}

export default function make(address: string, type: ContractType, chain: ChainType, db?: DatabaseCRUD): ContractScaner {
	var cs: ContractScaner;
	somes.assert(chain, 'scaner#make chain Invalid');

	if (type == ContractType.DAO) {
		cs = new DAO(address, type, chain, db);
	}
	else if (type == ContractType.ERC721) { // 721
		cs = new AssetERC721(address, type, chain, db);
	}
	else if (type == ContractType.Asset) { // 721
		cs = new AssetERC721(address, type, chain, db);
	}
	else if (type == ContractType.AssetShell) { // 721
		cs = new AssetERC721(address, type, chain, db);
	}
	else if (type == ContractType.Ledger) {
		cs = new Ledger(address, type, chain, db);
	}
	else if (type == ContractType.Member) {
		cs = new Member(address, type, chain, db);
	}
	else if (type == ContractType.VotePool) {
		cs = new VotePool(address, type, chain, db);
	}
	else if (type == ContractType.DAOs) {
		cs = new DAOs(address, type, chain, db);
	}
	else {
		cs = new ContractUnknown(address, ContractType.Invalid, chain, db);
	}
	return cs;
}