/**
 * @copyright © 2021 Copyright ccl
 * @date 2021-09-26
 */

import { Asset, ContractType, ChainType } from '../models/def';
import {ContractScaner, IAssetScaner, formatHex,blockTimeStamp} from './scaner';
import {EventData} from 'web3-tx';
import {Transaction} from 'web3-core';
import * as utils from '../utils';
import db from '../db';
import _hash from 'somes/hash';
import * as opensea from '../models/opensea';

export abstract class AssetScaner extends ContractScaner implements IAssetScaner {
	abstract uri(tokenId: string): Promise<string>;
	abstract balanceOf(owner: string, tokenId: string): Promise<number>;
	abstract exists(id: string): Promise<boolean>;

	asAsset(): IAssetScaner | null {
		return this;
	}

	async uriNoErr(tokenId: string) {
		var uri: string = '';
		try {
			uri = await this.uri(tokenId);
		} catch(err: any) {
			console.warn('AssetScaner#uriNoErr', ContractType[this.type], ChainType[this.chain], this.address, tokenId, err.message);
		}
		return uri;
	}

	async asset(tokenId: string, blockNumber?: number) {
		var token = this.address;
		var [asset] = await db.select<Asset>(`asset_${this.chain}`, { token, tokenId }, {limit:1});
		if (!asset) {
			let uri = await utils.storageTokenURI(await this.uriNoErr(tokenId), { tokenId, token });
			uri = uri.substring(0, 512);
			let time = Date.now();
			let id = await db.insert(`asset_${this.chain}`, { token, tokenId, uri, time, modify: time, blockNumber });
			var [asset] = await db.select<Asset>(`asset_${this.chain}`, {id});
		}
		return asset;
	}

	async assetTransaction(
		txHash: string, blockNumber: number,
		count: string, tokenId: string,
		from: [string, number], // from address/total
		to: [string, number], // to address/total
		value: string,
	) {
		var time = await blockTimeStamp(this.web3, blockNumber);
		var token = this.address;
		let exists = await this.exists(tokenId);
		if (exists) {
			var asset = await this.asset(tokenId, blockNumber);
			var data = { owner: to[0], modify: time };
			if (!asset.author && !BigInt(from[0]) && BigInt(to[0])) { // update author
				Object.assign(data, { author: to[0], modify: time });
			}
			await db.update(`asset_${this.chain}`, data, { id: asset.id });
		}

		var order = await db.selectOne(`asset_order_${this.chain}`, { txHash, token, tokenId });
		if (! order ) {
			await db.insert(`asset_order_${this.chain}`, {
				txHash: txHash,
				blockNumber: blockNumber,
				token, tokenId,
				fromAddres: from[0],
				toAddress: to[0],
				count: count,
				value: `${value}`,
				//description: '',
				time: time,
			});
		}

		await opensea.maskOrderClose(this.chain, token, tokenId);
	}

}

export class AssetERC721 extends AssetScaner {

	events = {
		// event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
		Transfer: {
			use: async (e: EventData, tx: Transaction)=>{
				var {from, to} = e.returnValues;
				if (e.returnValues.tokenId) {
					let tokenId = formatHex(e.returnValues.tokenId, 32);
					let blockNumber = Number(e.blockNumber) || 0;
					await this.assetTransaction(e.transactionHash, blockNumber, '1', tokenId, [from, 0], [to, 1], tx.value);
				} else {
					console.warn(`AssetERC721#Transfer, token=${this.address}, returnValues.tokenId=`, e.returnValues.tokenId, e.returnValues);
				}
			},
		}
	};

	async ownerOf(tokenId: string) {
		return await (await this.methods()).ownerOf(tokenId).call() as string;
	}

	async uri(tokenId: string): Promise<string> {
		var c = await this.contract();
		var uri = await c.methods.tokenURI(tokenId).call() as string;
		return uri;
	}

	async exists(id: string) {
		var c = await this.contract();
		try {
			return await c.methods.exists(id).call() as boolean;
		} catch (err: any) {
			try {
				await c.methods.ownerOf(id).call() as string;
			} catch(err: any) {
				if (err.message.indexOf('exist') != -1)
					return false;
			}
		}
		return true;
	}

	async balanceOf(owner: string, id: string): Promise<number> {
		var c = await this.contract();
		try {
			var _owner = await c.methods.ownerOf(id).call() as string;
			var balance = _owner == owner ? 1: 0;
			return balance;
		} catch (err: any) {
			if (err.message.indexOf('exist') != -1)
				return 0;
			throw err;
		}
	}
}
