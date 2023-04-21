/**
 * @copyright © 2021 Copyright ccl
 * @date 2021-09-26
 */

import { Asset, ContractType, ChainType, SaleType,AssetType} from '../models/define';
import {ContractScaner, IAssetScaner, formatHex,HandleEventData} from './scaner';
import * as utils from '../utils';
import _hash from 'somes/hash';
import somes from 'somes';
import * as opensea from '../models/opensea';
import * as constants from './constants';
import sync from './index';

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

export abstract class AssetModuleScaner extends ModuleScaner implements IAssetScaner {

	abstract uri(tokenId: string): Promise<string>;
	abstract balanceOf(owner: string, tokenId: string): Promise<bigint>;
	abstract exists(id: string): Promise<boolean>;

	assetType(tokenId: string) {
		return BigInt(tokenId) % BigInt(2) ? AssetType.ERC1155: AssetType.ERC721;
	}

	totalSupply(tokenId: string): Promise<bigint> {
		// assetType == AssetType.ERC721 ? 1: 
		return Promise.resolve(BigInt(1));
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
		let token = this.address;
		var [asset] = await db.select<Asset>(`asset_${this.chain}`, { token, tokenId }, {limit:1});
		if (!asset) {
			let uri = await utils.storageTokenURI(await this.uriNoErr(tokenId), { tokenId, token });
			// uri = uri.substring(0, 512);
			somes.assert(uri.length < 512);

			let time = Date.now();
			let host = await this.host();
			let assetType = this.assetType(tokenId);
			let totalSupply = formatHex(await this.totalSupply(tokenId), 0);
			let id = await db.insert(`asset_${this.chain}`, {
				host,
				token,
				tokenId,
				uri,
				time,
				modify: time,
				blockNumber,
				type: this.type,
				assetType,
				totalSupply,
			});
			var [asset] = await db.select<Asset>(`asset_${this.chain}`, {id});
			await sync.assetMetaDataSync.fetchFrom(asset, this.chain);
		}
		return asset;
	}

	async transaction(
		txHash: string,
		tokenId: string,
		from: string, // from address
		to: string, // to address/total
		count: bigint, // transaction count
		value: string, // transaction value
		blockNumber: number
	) {
		let db = this.db;
		var time = Date.now();
		var token = this.address;
		let exists = await this.exists(tokenId);
		if (exists) {
			var asset = await this.asset(tokenId, blockNumber);
			var row: Dict = { owner: to, modify: time };

			if (!BigInt(from) && BigInt(to)) { // update author
				Object.assign(row, { author: to });
			}
			//somes.assert(data.owner, '#ERC721ModuleScaner.assetTransaction, row.owner!=empty str');
			//somes.assert(data.author, '#ERC721ModuleScaner.assetTransaction, row.author!=empty str');

			if (!asset.minimumPrice && this.type == ContractType.AssetShell) {
				let m = await this.methods();
				let v = await m.minimumPrice(tokenId).call();
				row.minimumPrice = formatHex(v, 0);
			}

			await db.update(`asset_${this.chain}`, row, { id: asset.id });
		} else {
			await db.update(`asset_${this.chain}`, {
				owner: '0x0000000000000000000000000000000000000000', modify: time,
			}, { token, tokenId });
		}

		var order = await db.selectOne(`asset_order_${this.chain}`, { txHash, token, tokenId });
		if (! order ) {
			await db.insert(`asset_order_${this.chain}`, {
				txHash: txHash,
				blockNumber: blockNumber,
				token, tokenId,
				fromAddres: from,
				toAddress: to,
				count: count,
				value: `${value}`,
				//description: '',
				time: time,
			});
		}

		await opensea.maskOrderClose(this.chain, token, tokenId, db);
	}

}

export class AssetERC721 extends AssetModuleScaner {

	events = {
		// event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
		// event Change(uint256 indexed tag, uint256 value);

		Transfer: {
			handle: async ({event:e,tx,blockNumber}: HandleEventData)=>{
				var {from, to} = e.returnValues;
				if (e.returnValues.tokenId) {
					let tokenId = formatHex(e.returnValues.tokenId, 32);
					await this.transaction(e.transactionHash, tokenId, from, to, BigInt(1), tx.value, blockNumber);
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

	async balanceOf(owner: string, id: string): Promise<bigint> {
		var c = await this.contract();
		try {
			var _owner = await c.methods.ownerOf(id).call() as string;
			var balance = BigInt(_owner == owner ? 1: 0);
			return balance;
		} catch (err: any) {
			if (err.message.indexOf('exist') != -1)
				return BigInt(0);
			throw err;
		}
	}
}
