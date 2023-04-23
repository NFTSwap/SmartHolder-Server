/**
 * @copyright © 2021 Copyright ccl
 * @date 2021-09-26
 */

import { Asset, ContractType, ChainType, SaleType,AssetType,AssetOwner} from '../../models/define';
import {ContractScaner, IAssetScaner, numberStr,formatHex,HandleEventData} from '.';
import * as utils from '../../utils';
import _hash from 'somes/hash';
import * as opensea from '../../models/opensea';
import * as constants from './../constants';
import sync from './../index';
import somes from 'somes';
import * as contract from '../../models/contract';

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

	protected specific(tokenId: string): Promise<{assetType: AssetType, totalSupply: bigint}> {
		return Promise.resolve({
			assetType: AssetType.ERC721, totalSupply: BigInt(1)
		});
	}

	private async uriNoErr(tokenId: string) {
		var uri: string = '';
		try {
			uri = await this.uri(tokenId);
		} catch(err: any) {
			console.warn('#AssetModuleScaner.uriNoErr',
				ContractType[this.type], ChainType[this.chain], this.address, tokenId, err.message
			);
		}
		return uri;
	}

	private async asset(tokenId: string) {
		let db = this.db;
		let token = this.address;
		let uri = await this.uriNoErr(tokenId);
		uri = await utils.storageTokenURI(uri, { tokenId, token });
		if (uri.length > 1024) uri = ''; // Temporarily ignored

		let time = Date.now();
		let host = await this.host();
		let specific = await this.specific(tokenId);
		let totalSupply = numberStr(specific.totalSupply);
		let id = await db.insert(`asset_${this.chain}`, {
			host,
			token,
			tokenId,
			uri,
			time,
			modify: time,
			blockNumber: this.blockNumber,
			type: this.type,
			assetType: specific.assetType,
			totalSupply,
		});
		let asset = await db.selectOne<Asset>(`asset_${this.chain}`, {id});
		this.onAfterSolveBlockReceipts.on(()=>sync.assetMetaDataSync.fetchFrom(asset!, this.chain));
		return asset!;
	}

	async transaction(
		txHash: string,
		tokenId: string,
		from: string, // from address
		to: string, // to address
		count: bigint, // asset count
		value: string, // transaction value
	) {
		tokenId = formatHex(tokenId, 32);

		let db = this.db;
		let time = Date.now();
		let token = this.address;
		let asset_ = await db.selectOne<Asset>(`asset_${this.chain}`, { token, tokenId });
		let asset = asset_ ? asset_: await this.asset(tokenId);
		let row: Dict = { owner: to, modify: time };

		if (!asset.minimumPrice) {
			if (this.type == ContractType.AssetShell) {
				let m = await this.methods();
				row.minimumPrice = numberStr(await m.minimumPrice(tokenId).call());
			}
		}

		if (!BigInt(from) && BigInt(to)) { // update author
			Object.assign(row, { author: to });
		}

		await db.update(`asset_${this.chain}`, row, { id: asset.id });

		// update asset order
		//let order = await db.selectOne(`asset_order_${this.chain}`, { txHash,token,tokenId });
		await db.insert(`asset_order_${this.chain}`, {
			txHash: txHash,
			blockNumber: this.blockNumber,
			token, tokenId,
			fromAddres: from,
			toAddress: to,
			count: count,
			value: `${value}`,
			//description: '',
			time: time,
		});

		// update asset owner
		for (let [owner,c] of [[from,-count],[to,count]] as [string,bigint][]) {
			let ao = await db.selectOne<AssetOwner>(`asset_owner_${this.chain}`, { token, tokenId, owner });
			if (ao) {
				let count = BigInt(ao.count) + c;
				somes.assert(count >= 0, '#AssetModuleScaner.transaction Bad count argument.');
				await db.update(`asset_owner_${this.chain}`, {count: numberStr(count)}, {
					token, tokenId, owner,
				});
			} else if (owner != '0x0000000000000000000000000000000000000000') {
				let count = await this.balanceOf(owner, tokenId);
				await db.insert(`asset_owner_${this.chain}`, {
					token, tokenId, owner, count: numberStr(count),
				});
			}
		}

		// TODO ... maskOrderClose
		await opensea.maskOrderClose(this.chain, token, tokenId, db);
	}

	protected async onChangePlus({event,blockTime: modify}: HandleEventData, tag: number) {
		if (this.type != ContractType.AssetShell) return;

		switch (tag) {
			case constants.Change_Tag_Asset_set_seller_fee_basis_points: // update fee basis points
				let methods = await this.methods();
				let saleType = await methods.saleType().call() as SaleType;
				let info = await this.info();

				if (saleType == SaleType.kFirst) {
					let assetIssuanceTax = Number(event.returnValues.value);
					await this.db.update(`dao_${this.chain}`, { assetIssuanceTax, modify }, { address: info.host });
				}
				else if (saleType == SaleType.kSecond) {
					let assetCirculationTax = Number(event.returnValues.value);
					await this.db.update(`dao_${this.chain}`, { assetCirculationTax, modify }, { address: info.host });
				}
				break;
			case constants.Change_Tag_Asset_set_fee_recipient:
				break;
		}
	}

}

export class AssetERC721 extends AssetModuleScaner {

	events = {
		// event Change(uint256 indexed tag, uint256 value);
		// event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
		Change: {
			handle: (data: HandleEventData)=>this.onChange(data),
		},
		Transfer: {
			handle: async ({event:e,tx}: HandleEventData)=>{
				var {from,to,tokenId} = e.returnValues;
				somes.assert(tokenId, '#AssetERC721.events.Transfer.handle token id is empty');
				await this.transaction(e.transactionHash, tokenId, from, to, BigInt(1), tx.value);
			},
		},
	};

	async uri(tokenId: string): Promise<string> {
		var m = await this.methods();
		var uri = await m.tokenURI(tokenId).call(this.blockNumber) as string;
		return uri;
	}

	async balanceOf(owner: string, id: string): Promise<bigint> {
		var m = await this.methods();
		var addr = await m.ownerOf(id).call(this.blockNumber) as string;
		var balance = BigInt(addr == owner ? 1: 0);
		return balance;
	}
}

export class AssetERC1155 extends AssetModuleScaner {

	events = {
		// event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);
		// event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values);
		// event ApprovalForAll(address indexed account, address indexed operator, bool approved);
		// event URI(string value, uint256 indexed id);
		Change: {
			handle: (data: HandleEventData)=>this.onChange(data),
		},
		TransferSingle: {
			handle: async ({event:e,tx}: HandleEventData)=>{
				let {from,to,id,value} = e.returnValues;
				await this.transaction(e.transactionHash, id, from, to, BigInt(value), tx.value);
			},
		},
		TransferBatch: {
			handle: async ({event:e,tx}: HandleEventData)=>{
				let {from,to,ids,values} = e.returnValues;
				for (let [id,value] of (ids as string[]).map((e,j)=>[e,values[j]])) {
					await this.transaction(e.transactionHash, id, from, to, BigInt(value), tx.value);
				}
			},
		},
		ApprovalForAll: {
			handle: async ({event:e,tx}: HandleEventData)=>{
				console.log('#AssetERC1155.events.ApprovalForAll.handle', this.address);
			},
		},
		URI: {
			handle: async ({event:e,tx}: HandleEventData)=>{
				console.log('#AssetERC1155.events.URI.handle', this.address);
			},
		},
	};

	private async specificForAsset(token: string, tokenId: string): Promise<{assetType: AssetType, totalSupply: bigint}> {
		if (BigInt(tokenId) % BigInt(2)) { // 1155
			let c = await this.web3.contract(token);
			let totalSupply = await c.methods.totalSupply(tokenId).call(this.blockNumber);
			return { assetType: AssetType.ERC1155, totalSupply };
		} else {
			return { assetType: AssetType.ERC721, totalSupply: BigInt(1) };
		}
	}

	async specific(tokenId: string): Promise<{assetType: AssetType, totalSupply: bigint}> {
		if (ContractType.Asset == this.type) {
			return await this.specificForAsset(this.address, tokenId);
		}
		else if (ContractType.AssetShell == this.type) {
			let m = await this.methods();
			let meta = await m.assetMeta(tokenId).call(this.blockNumber);
			let ci = await contract.select(meta.token, this.chain);

			if (ci && ci.type == ContractType.Asset) {
				return await this.specificForAsset(meta.token, meta.tokenId);
			} else {
				let totalSupply = await m.totalSupply(tokenId).call(this.blockNumber);
				return { assetType: AssetType.ERC1155, totalSupply };
			}
		} else {
			return await super.specific(tokenId);
		}
	}

	async uri(tokenId: string): Promise<string> {
		let m = await this.methods();
		let uri = await m.uri(tokenId).call(this.blockNumber) as string;
		return uri;
	}

	async balanceOf(owner: string, id: string): Promise<bigint> {
		let m = await this.methods();
		let balance = await m.balanceOf(owner, id).call(this.blockNumber) as string;
		return BigInt(balance);
	}
}
