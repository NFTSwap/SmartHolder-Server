/**
 * @copyright © 2021 Copyright ccl
 * @date 2021-09-26
 */

import {AssetFactory,AssetUnknown} from './asset';
import {AssetContract, AssetType, ChainType } from '../models/def';
import {AssetERC1155} from './erc1155';
import {AssetERC721} from './erc721';
import {AssetProxy} from './proxy';
import {AssetERC20} from './erc20';
import {Log} from 'web3-core';

export * from './asset';

// factory method

export function makeFrom(c: AssetContract) {
	return make(c.address, c.type, c.chain);
}

export function make(address: string, type: AssetType, chain: ChainType = ChainType.UNKNOWN): AssetFactory {
	var ass: AssetFactory;
	chain = chain || ChainType.UNKNOWN;

	if (type == AssetType.ERC721) {
		ass = new AssetERC721(address, type, chain);
	}
	else if (type == AssetType.ERC1155) {
		ass = new AssetERC1155(address, type, chain);
	}
	else if (type == AssetType.ERC20) {
		ass = new AssetERC20(address, type, chain);
	}
	else if (type >= AssetType.ERC721Proxy || type >= AssetType.ERC1155Proxy) { // proxy all
		ass = new AssetProxy(address, type, chain);
	}
	else {
		ass = new AssetUnknown(address, AssetType.INVALID, chain);
	}
	return ass;
}

export async function test(chain: ChainType, token: string, log: Log): Promise<AssetType> {
	if (!chain)
		return AssetType.INVALID;
	return (
		await make(token, AssetType.ERC721, chain).test(log) ||
		await make(token, AssetType.ERC1155, chain).test(log) ||
		await make(token, AssetType.ERC721Proxy, chain).test(log) ||
		await make(token, AssetType.ERC1155Proxy, chain).test(log) ||
		await make(token, AssetType.ERC20, chain).test(log) ||
		AssetType.INVALID
	);
}
export async function testAssetType(chain: ChainType, token: string, tokenId: string): Promise<AssetType> {
	if (!chain)
		return AssetType.INVALID;
	return (
		(await make(token, AssetType.ERC721, chain).uriNoErr(tokenId) && AssetType.ERC721) ||
		(await make(token, AssetType.ERC1155, chain).uriNoErr(tokenId) && AssetType.ERC1155) ||
		AssetType.INVALID
	);
}
