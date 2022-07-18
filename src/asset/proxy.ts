/**
 * @copyright © 2021 Copyright ccl
 * @date 2021-09-26
 */

import { AssetOwner, Asset, AssetType } from '../models/def';
import {AssetFactory, formatHex} from './asset';
import {EventData} from 'web3-tx';
import db from '../db';
import * as index from '.';
import {Transaction} from 'web3-core';
import {AbiInterface} from '../web3+';

export class AssetProxy extends AssetFactory {

	uri(id: string): Promise<string> {
		throw Error.new('Not impl');
	}

	balanceOf(owner: string, id: string): Promise<number> {
		throw Error.new('Not impl');
	}

	async balanceOf2(owner: string, id: string, token: string): Promise<number> {
		var c = await this.contract();
		var balance = BigInt(owner) ? await c.methods.balanceOf(token, id, owner).call(): 0;
		return balance;
	}

	asset(): Promise<Asset> {
		throw Error.new('Not impl');
	}

	private async setProxy(token: string, tokenId: string, 
		from: [string, number], // from address/total
		to: [string, number], // to address/total
	) {
		var en = index.make(token, this.type, this.chain);
		var asset = await en.asset(tokenId);
		var owner: string = this.address;
		var chain = this.chain;

		for (var [ownerBase, count_] of [from,to]) {
			if (BigInt(ownerBase)) {
				var asset_o = await db.selectOne<AssetOwner>('asset_proxy', { chain, token, tokenId, ownerBase });
				var count = AssetFactory.Number(count_);
				if (asset_o) {
					if (asset_o.count != count) {
						await db.update('asset_proxy', { owner, count }, { chain, token, tokenId, ownerBase });
					} else {
						continue;
					}
				} else {
					await db.insert('asset_proxy', { chain, owner, ownerBase, count, token, tokenId });
				}
				AssetFactory.postMessage({...asset, owner, ownerBase, count: String(count)});
			}
		}
	}

	events = {
		Transfer: {
			use: async (e: EventData, tx: Transaction)=>{
				var {from, to, fromBalance, toBalance} = e.returnValues;
				var token = e.returnValues.token as string;
				var tokenId = formatHex(e.returnValues.tokenId, 32);
				// owner: string, id: string, token: string
				await this.setProxy(token, tokenId, 
					[from, await this.balanceOf2(from, tokenId, token)],
					[to,   await this.balanceOf2(to,   tokenId, token)]
				);
			},
			test: async (e: EventData, abi: AbiInterface)=>{
				var {to,token} = e.returnValues;
				var tokenId = formatHex(e.returnValues.tokenId, 32);
				var c = this.web3.createContract(token, abi.abi);
				if (this.type == AssetType.ERC721) {
					await c.methods.tokenURI(tokenId).call();
					await c.methods.ownerOf(tokenId).call()
					await c.methods.getApproved(tokenId).call();
				} else if (this.type == AssetType.ERC721) {
					await c.methods.uri(tokenId).call();
					await c.methods.balanceOf(to, tokenId).call()
					await c.methods.balanceOfBatch([to], [tokenId]).call();
				} else {
					throw Error.new('Asset Type not match');
				}
			}
		}
	};
}
