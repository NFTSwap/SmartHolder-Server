/**
 * @copyright © 2022 Smart Holder Server
 * @date 2022-07-21
 */

import somes from 'somes';
import {ContractScaner,ContractUnknown} from './scaner';
import {ContractType, ChainType, ContractInfo } from '../models/define';
import {DAO} from './scaner/dao';
import {AssetERC721,AssetERC1155} from './scaner/asset';
import {Ledger} from './scaner/ledger';
import {Member} from './scaner/member';
import {VotePool} from './scaner/vote_pool';
import {DAOs} from './scaner/daos';
import {DatabaseCRUD} from 'somes/db';
import {Share} from './scaner/share';

export * from './scaner';

export function makeFrom(info: ContractInfo, chain: ChainType, db?: DatabaseCRUD) {
	return make(info.address, info.type, chain, db);
}

export default function make(address: string, type: ContractType, chain: ChainType, db?: DatabaseCRUD): ContractScaner {
	var cs: ContractScaner;
	somes.assert(chain, '#mk_scaner.make chain Invalid');

	switch (type) {
		case ContractType.DAO:
			cs = new DAO(address, type, chain, db); break;
		case ContractType.ERC721:
			cs = new AssetERC721(address, type, chain, db); break;
		case ContractType.Asset:
			cs = new AssetERC1155(address, type, chain, db); break;
		case ContractType.AssetShell:
			cs = new AssetERC1155(address, type, chain, db); break;
		case ContractType.Ledger:
			cs = new Ledger(address, type, chain, db); break;
		case ContractType.Member:
			cs = new Member(address, type, chain, db); break;
		case ContractType.VotePool:
			cs = new VotePool(address, type, chain, db); break;
		case ContractType.DAOs:
			cs = new DAOs(address, type, chain, db);
		case ContractType.Share:
			cs = new Share(address, type, chain, db); break;
		default:
			cs = new ContractUnknown(address, ContractType.Invalid, chain, db); break;
	}
	return cs;
}