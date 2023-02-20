/**
 * @copyright © 2021 Copyright ccl
 * @date 2021-09-26
 */

import { Asset, ContractType, ChainType, SaleType} from '../models/define';
import {ContractScaner, IAssetScaner, formatHex,HandleEventData} from './scaner';
import * as utils from '../utils';
import _hash from 'somes/hash';
import * as opensea from '../models/opensea';
import * as constants from './constants';
import sync from './index';
import db_ from '../db';
import somes from 'somes';

export abstract class ModuleScaner extends ContractScaner {

	protected async onDescription(data: HandleEventData, desc: string) {}
	protected async onOperator(data: HandleEventData, addr: string) {}
	protected async onUpgrade(data: HandleEventData, addr: string) {}
	protected async onChangePlus(data: HandleEventData, tag: number) {}

	// module change handle
	protected async onChange(data: HandleEventData) {
		let tag = Number(data.event.returnValues.tag);
		let methods = await this.methods();

		switch (tag) {
			case constants.Change_Tag_Description:
				await this.onDescription(data, await methods.description().call());
				break;
			case constants.Change_Tag_Operator:
				await this.onOperator(data, await methods.operator().call());
				break;
			case constants.Change_Tag_Upgrade:
				await this.onUpgrade(data, await methods.impl().call());
				break;
			default:
				await this.onChangePlus(data, tag);
				break;
		}
	}

}

export abstract class ERC721ModuleScaner extends ModuleScaner implements IAssetScaner {

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
			console.warn('#AssetScaner#uriNoErr', ContractType[this.type], ChainType[this.chain], this.address, tokenId, err.message);
		}
		return uri;
	}

	async asset(tokenId: string, blockNumber?: number) {
		let db = this.db;
		var token = this.address;
		var [asset] = await db.select<Asset>(`asset_${this.chain}`, { token, tokenId }, {limit:1});
		if (!asset) {
			let uri = await utils.storageTokenURI(await this.uriNoErr(tokenId), { tokenId, token });
			uri = uri.substring(0, 512);
			let time = Date.now();
			let id = await db.insert(`asset_${this.chain}`, { token, tokenId, uri, time, modify: time, blockNumber });
			var [asset] = await db.select<Asset>(`asset_${this.chain}`, {id});
			await sync.assetMetaDataSync.fetchFrom(asset, this.chain);
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
		let db = this.db;
		var time = Date.now();
		var token = this.address;
		let exists = await this.exists(tokenId);
		if (exists) {
			var asset = await this.asset(tokenId, blockNumber);
			var data: Dict = { owner: to[0], modify: time };

			if (!asset.author && !BigInt(from[0]) && BigInt(to[0])) { // update author
				Object.assign(data, { author: to[0], modify: time });
			}
			//somes.assert(data.owner, '#ERC721ModuleScaner.assetTransaction, data.owner!=empty str');
			//somes.assert(data.author, '#ERC721ModuleScaner.assetTransaction, data.author!=empty str');

			if (!asset.minimumPrice && this.type == ContractType.AssetShell) {
				let m = await this.methods();
				let v = await m.minimumPrice(tokenId).call();
				data.minimumPrice = BigInt(v) + '';//formatHex(v);
			}

			await db.update(`asset_${this.chain}`, data, { id: asset.id });
		} else {
			// await db.update(`asset_${this.chain}`, {
			// 	owner: '0x0000000000000000000000000000000000000000', modify: time,
			// }, { token, tokenId });
			await db.delete(`asset_${this.chain}`, {token, tokenId});
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

		await opensea.maskOrderClose(this.chain, token, tokenId, db);
	}

}

export class AssetERC721 extends ERC721ModuleScaner {

	events = {
		// event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
		// event Change(uint256 indexed tag, uint256 value);

		Transfer: {
			handle: async ({event:e,tx,blockNumber}: HandleEventData)=>{
				var {from, to} = e.returnValues;
				if (e.returnValues.tokenId) {
					let tokenId = formatHex(e.returnValues.tokenId, 32);
					await this.assetTransaction(e.transactionHash, blockNumber, '1', tokenId, [from, 0], [to, 1], tx.value);
				} else {
					console.warn(`#AssetERC721#Transfer, token=${this.address}, returnValues.tokenId=`, e.returnValues.tokenId, e.returnValues);
				}
			},
		},
		Change: {
			handle: (data: HandleEventData)=>this.onChange(data),
		},
	};

	protected async onChangePlus({event,blockTime: modify}: HandleEventData, tag: number) {
		let db = this.db;
		switch (tag) {
			case constants.Change_Tag_Asset_set_seller_fee_basis_points: // update fee basis points
				let methods = await this.methods();
				let saleType = await methods.saleType().call() as SaleType;
				let info = await this.info();

				if (saleType == SaleType.kFirst) {
					let assetIssuanceTax = Number(event.returnValues.value);
					await db.update(`dao_${this.chain}`, { assetIssuanceTax, modify }, { address: info.host });
				}
				else if (saleType == SaleType.kSecond) {
					let assetCirculationTax = Number(event.returnValues.value);
					await db.update(`dao_${this.chain}`, { assetCirculationTax, modify }, { address: info.host });
				}
				break;
			case constants.Change_Tag_Asset_set_fee_recipient:
				break;
		}
	}

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
