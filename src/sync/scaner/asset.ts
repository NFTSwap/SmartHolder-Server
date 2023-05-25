/**
 * @copyright © 2021 Copyright ccl
 * @date 2021-09-26
 */

import { Asset, ContractType, ChainType, SaleType,AssetType,AssetOwner,DAO} from '../../models/define';
import {ModuleScaner, IAssetScaner, numberStr,formatHex,HandleEventData} from '.';
import * as utils from '../../utils';
import _hash from 'somes/hash';
import * as order from '../../models/order';
import * as constants from './../constants';
import sync from './../index';
import somes from 'somes';
import * as contract from '../../models/contract';
import {isExecutionRevreted,getAbiByType} from '../../web3+';
import {Ledger} from './ledger';

const addressZero = '0x0000000000000000000000000000000000000000';

export abstract class AssetModuleScaner extends ModuleScaner implements IAssetScaner {

	abstract uri(tokenId: string): Promise<string>;
	abstract balanceOf(owner: string, tokenId: string, blockNumber?: number): Promise<bigint>;

	protected assetType(tokenId: string): Promise<AssetType> {
		return Promise.resolve(AssetType.ERC721);
	}
	protected totalSupply(tokenId: string, blockNumber?: number): Promise<bigint> {
		return Promise.resolve(BigInt(1));
	}

	private async tryUri(tokenId: string) {
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

	private async tryBalanceOf(owner: string, tokenId: string, blockNumber?: number) {
		try {
			return await this.balanceOf(owner, tokenId, blockNumber);
		} catch(err: any) {
			if (isExecutionRevreted(err))
				return BigInt(0);
			throw err;
		}
	}

	private async tryTotalSupply(tokenId: string, blockNumber?: number) {
		try {
			return await this.totalSupply(tokenId, blockNumber);
		} catch(err: any) {
			if (isExecutionRevreted(err))
				return BigInt(0);
			throw err;
		}
	}

	private async asset(tokenId: string) {
		let db = this.db;
		let token = this.address;
		let uri = await this.tryUri(tokenId);
		uri = await utils.storageTokenURI(uri, { tokenId, token });
		if (uri.length > 1024) uri = ''; // Temporarily ignored

		let time = Date.now();
		let host = await this.host();
		let assetType = await this.assetType(tokenId);
		let totalSupply = await this.tryTotalSupply(tokenId, this.blockNumber - 1);
		let id = await db.insert(`asset_${this.chain}`, {
			host,
			token,
			tokenId,
			uri,
			time,
			modify: time,
			blockNumber: this.blockNumber,
			assetType,
			totalSupply: numberStr(totalSupply),
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
		logIndex: number,
	) {
		tokenId = formatHex(tokenId, 32);

		const addressZero = '0x0000000000000000000000000000000000000000';

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

		let totalSupply = BigInt(asset.totalSupply); // prev block or prev log status
		// update totalSupply
		if (from == addressZero) // mint
			totalSupply += count;
		if (to == addressZero) // burn
			totalSupply -= count;
		row.totalSupply = numberStr(totalSupply);

		let rows = await db.update(`asset_${this.chain}`, row, { id: asset.id });
		somes.assert(rows, '#AssetModuleScaner.transaction rows != 0');

		// check
		if (asset.assetType == AssetType.ERC1155_Single && to == addressZero) {
			let it = await db.selectOne<Asset>(`asset_${this.chain}`, { id: asset.id });
			let totalSupply = BigInt(it!.totalSupply);
			somes.assert(totalSupply == BigInt(0), '#AssetModuleScaner.transaction totalSupply == 0');
		}

		// update asset order
		//let order = await db.selectOne(`asset_order_${this.chain}`, { txHash,token,tokenId });
		await db.insert(`asset_order_${this.chain}`, {
			asset_id: asset.id,
			host: await this.host(),
			txHash: txHash,
			blockNumber: this.blockNumber,
			token, tokenId,
			logIndex,
			fromAddres: from,
			toAddress: to,
			count: count,
			value: `${value}`,
			//description: '',
			time: time,
		});
		// console.log(`insert asset_order_${this.chain}`, txHash,token,tokenId);

		// update asset owner
		for (let [owner,c] of [[from,-count],[to,count]] as [string,bigint][]) {
			let ao = await db.selectOne<AssetOwner>(`asset_owner_${this.chain}`, { token, tokenId, owner });
			if (ao) {
				let count = BigInt(ao.count) + c;
				somes.assert(count >= 0, '#AssetModuleScaner.transaction Bad count argument.');
				await db.update(`asset_owner_${this.chain}`, {count: numberStr(count)}, {
					token, tokenId, owner,
				});
			} else if (owner != addressZero) {
				let count = await this.tryBalanceOf(owner, tokenId, this.blockNumber - 1) + c; // prev block count + change value
				somes.assert(count >= 0, '#AssetModuleScaner.transaction Bad count argument. 1');
				await db.insert(`asset_owner_${this.chain}`, {
					asset_id: asset.id, token, tokenId, owner, count: numberStr(count),
				});
			}
		}

		await order.maskSellOrderClose(this.chain, token, tokenId, count, from, db);
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
				await this.transaction(e.transactionHash, tokenId, from, to, BigInt(1), tx.value, e.logIndex);
			},
		},
	};

	async uri(tokenId: string): Promise<string> {
		var m = await this.methods();
		var uri = await m.tokenURI(tokenId).call(this.blockNumber) as string;
		return uri;
	}

	async balanceOf(owner: string, id: string, blockNumber?: number): Promise<bigint> {
		var m = await this.methods();
		var addr = await m.ownerOf(id).call(blockNumber || this.blockNumber) as string;
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
				await this.transaction(e.transactionHash, id, from, to, BigInt(value), tx.value,e.logIndex);
			},
		},
		TransferBatch: {
			handle: async ({event:e,tx}: HandleEventData)=>{
				let {from,to,ids,values} = e.returnValues;
				for (let [id,value] of (ids as string[]).map((e,j)=>[e,values[j]])) {
					await this.transaction(e.transactionHash, id, from, to, BigInt(value), tx.value,e.logIndex);
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

		Unlock: {
			// event Unlock(
			// 	uint256 indexed tokenId,
			// 	address indexed source, address indexed erc20,
			// 	address from, address to, uint256 amount, uint256 eth, uint256 count
			// );
			handle: async ({event:e, blockNumber}: HandleEventData)=>{
				let {tokenId,source,erc20,from,to,amount,count} = e.returnValues;
				let host = await this.host();
				let dao = (await this.db.selectOne<DAO>(`dao_${this.chain}`, {address: host}))!;
				let saleType = dao.first.toLowerCase() == this.address.toLowerCase() ? SaleType.kFirst: SaleType.kSecond;
				let fee = await this.seller_fee_basis_points(blockNumber);
				let price = BigInt(amount) * BigInt(10_000) / BigInt(fee);

				await new Ledger(dao.ledger, ContractType.Ledger, this.chain, this.db).addAssetIncome({
					host,
					saleType,
					blockNumber,
					token: this.address,
					tokenId,
					source,
					from,
					to,
					erc20,
					amount,
					price,
					count: count,
					txHash: e.transactionHash,
				});
			},
		},

		Receive: { // Receive ETH
			// event Receive(address indexed sender, uint256 amount);
			handle: async ({event:e,blockNumber}: HandleEventData)=>{
				let {sender,amount} = e.returnValues;
				let host = await this.host();
				let dao = await this.db.selectOne<DAO>(`dao_${this.chain}`, {address: host});
				await this.onReceiveERC20({
					blockNumber, dao: dao!, amount: BigInt(amount),
					source: sender, erc20: addressZero, txHash: e.transactionHash,
				});
			},
		}
	};

	// receive erc20 or eth, unlock asset shell
	async onReceiveERC20(e: {blockNumber: number, dao: DAO, amount: bigint, source: string, erc20: string, txHash: string}) {
		let {dao,blockNumber,source,erc20,txHash} = e;
		let {blocks:[block]} = await sync.watchBlocks[this.chain] // search logs by address and block number
			.getTransactionLogsFrom(blockNumber, blockNumber, [{address: this.address, state: 0}]);
		if (!block) return; // No logs ignored Transfer

		// erc1155 events
		// 0xd713904ca4dede24d8ccd2773f9ce5ad16d546d39ab1bb0f7039c3cf790f8377 0xd713904c
		// event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)
		let c = await this.contract();
		let abiI = (await getAbiByType(ContractType.AssetShell))!;
		let TransferSingle = abiI.abi.find(e=>e.name=='TransferSingle')!;
		let signature = this.web3.eth.abi.encodeEventSignature(TransferSingle);

		let logs = await Promise.all(block.logs[0].logs.filter(e=>{
			// check getTransactionLogsFrom query
			somes.assert(e.blockNumber == blockNumber, '#AssetERC1155.onReceiveERC20 log blockNumber no match');
			somes.assert(e.address == this.address, '#AssetERC1155.onReceiveERC20 log address no match');
			return e.transactionHash==e.transactionHash && e.topic[0]==signature // match TransferSingle log and tx hash
		})
		.map(async e=>{
			let {from,to,id,value} = this.web3.eth.abi.decodeLog(TransferSingle.inputs!, e.data, e.topic.slice(1));
			let item = await c.methods.lockedOf(id,to,from).call(blockNumber); // get locked item
			let minimumPrice = BigInt(await c.methods.minimumPrice(id).call(blockNumber));
			return {
				address: e.address,
				from,
				to,
				tokenId: formatHex(id),
				count: value,
				locked: item as {blockNumber: number, count: string},
				minimumPrice,
			};
		}));

		if (logs.length == 0) return; // no logs

		let minimumPriceTotal = logs.reduce((p,c)=>p + c.minimumPrice, BigInt(0)); // total min price
		let seller_fee_basis_points = await this.seller_fee_basis_points(blockNumber);

		for (let log of logs) {
			let {from,to,tokenId,count,locked,minimumPrice} = log;
			let amount = e.amount * minimumPrice / minimumPriceTotal + ''; // uniform distribution

			if (locked.blockNumber == blockNumber) { // if is locked then need to god the unlock it
				somes.assert(locked.count == count, '#AssetERC1155.onReceiveERC20 item count no match');
				somes.assert(erc20 != addressZero, '#AssetERC1155.onReceiveERC20 erc20 != addressZero');

				await this.db.insert(`asset_unlock_${this.chain}`, {
					host: dao.address, // get host address,
					token: log.address, // ref asset token address
					tokenId: tokenId, // ref asset token id
					fromAddress: from,
					toAddress: to,
					erc20: erc20,
					amount, // uniform distribution
					source: source, // use start call contract address
					blockNumber: blockNumber,
					time: Date.now(),
					txHash: txHash,
				});
			} else { // add ledger
				let isLock = await c.methods.isEnableLock().call(blockNumber);
				somes.assert(!isLock, '#AssetERC1155.onReceiveERC20 Locking must be disable'); // check state
				let saleType = dao.first.toLowerCase() == log.address.toLowerCase() ? SaleType.kFirst: SaleType.kSecond;

				await new Ledger(dao.ledger, ContractType.Ledger, this.chain, this.db).addAssetIncome({
					host: dao.address,
					saleType,
					blockNumber,
					token: log.address,
					tokenId,
					source: source,
					from,
					to,
					erc20: erc20,
					amount,
					price: BigInt(amount) * BigInt(10_000) / seller_fee_basis_points,
					count: count,
					txHash: txHash,
				});
			}
		} // for (let log of logs)
	}

	protected async assetType(id: string): Promise<AssetType> {
		if (ContractType.Asset == this.type) {
			return BigInt(id) % BigInt(2) ? AssetType.ERC1155: AssetType.ERC1155_Single;
		}
		else if (ContractType.AssetShell == this.type) {
			let m = await this.methods();
			let meta = await m.assetMeta(id).call(this.blockNumber);
			let ci = await contract.select(meta.token, this.chain);

			if (ci && ci.type == ContractType.Asset) {
				return BigInt(meta.tokenId) % BigInt(2) ? AssetType.ERC1155: AssetType.ERC1155_Single;
			}
		}
		return AssetType.ERC1155;
	}

	protected async totalSupply(id: string, blockNumber?: number): Promise<bigint> {
		if (ContractType.Asset == this.type || ContractType.AssetShell == this.type) {
			let m = await this.methods();
			let totalSupply = await m.totalSupply(id).call(blockNumber || this.blockNumber);
			return BigInt(totalSupply);
		} else {
			return BigInt(1);
		}
	}

	async uri(id: string): Promise<string> {
		let m = await this.methods();
		let uri = await m.uri(id).call(this.blockNumber) as string;
		return uri;
	}

	async balanceOf(owner: string, id: string, blockNumber?: number): Promise<bigint> {
		let m = await this.methods();
		let balance = await m.balanceOf(owner, id).call(blockNumber || this.blockNumber) as string;
		return BigInt(balance);
	}

	async seller_fee_basis_points(blockNumber?: number) {
		let m = await this.methods();
		let fee = await m.seller_fee_basis_points().call(blockNumber || this.blockNumber);
		return BigInt(fee);
	}
}
