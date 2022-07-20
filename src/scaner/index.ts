/**
 * @copyright © 2021 Copyright ccl
 * @date 2021-09-26
 */

import {ContractScaner,ContractUnknown} from './scaner';
import {ContractType, ChainType, ContractInfo } from '../models/def';
import {AssetERC721} from './erc721';
import somes from 'somes';

export * from './scaner';

// factory method

export function makeFrom(c: ContractInfo, chain: ChainType) {
	return make(c.address, c.type, chain);
}

export function make(address: string, type: ContractType, chain: ChainType): ContractScaner {
	var cs: ContractScaner;
	somes.assert(chain, 'scaner#make chain Invalid');

	if (type == ContractType.ERC721) {
		cs = new AssetERC721(address, type, chain);
	}
	else {
		cs = new ContractUnknown(address, ContractType.Invalid, chain);
	}
	return cs;
}