/**
 * @copyright © 2021 Copyright ccl
 * @date 2021-09-26
 */

import {
	Asset, AssetMy, AssetOwner, AssetType,
	AssetContract, ChainType, AssetOrder
} from '../models/def';
import db from '../db';
import {IBcWeb3} from 'bclib/web3_tx';
import {web3s, MvpWeb3} from '../web3+';
import {EventData} from 'web3-tx';
import sync from '../sync';
import somes from 'somes';
import * as fetch from '../utils';
// import * as msg from '../message';
import errno from '../errno';
import {Transaction, Log} from 'web3-core';
import {getAbiByType} from '../web3+';
import {AbiInterface} from 'bclib/abi';
import {AbiInput} from 'web3-utils';
import * as cfg from '../../config';
import {AbiItem} from 'web3-utils';
import uncaught from '../uncaught';
// import {update as updateAc} from '../sync/contract';

const cryptoTx = require('crypto-tx');

export function formatHex(hex_str: string | number | bigint, btyes: number = 32) {
	var s = '';
	if (typeof hex_str == 'string') {
		s = BigInt(hex_str).toString(16);
	} else {
		s = hex_str.toString(16);
	}
	var len = (btyes * 2) - s.length;
	if (len > 0) {
		return '0x' + Array.from({length: len + 1}).join('0') + s;
	} else {
		return '0x' + s;
	}
}

export interface ResolveEvent {
	use(this: AssetFactory, e: EventData, tx: Transaction): Promise<void>;
	test?(this: AssetFactory, e: EventData, abi: AbiInterface): Promise<void>;
}

export abstract class AssetFactory {
	private _ac?: AssetContract;
	private _web3?: MvpWeb3;

	readonly originType: AssetType;
	readonly address: string;
	readonly type: AssetType;
	readonly chain: ChainType;

	abstract readonly events: Dict<ResolveEvent>;
	abstract uri(tokenId: string): Promise<string>;
	abstract balanceOf(owner: string, tokenId: string): Promise<number>;
	// function deposit(address to, uint256 tokenId, uint256 amount) virtual public
	// function withdraw(address to, uint256 tokenId, uint256 amount) public

	async uriNoErr(tokenId: string) {
		var uri: string = '';
		try {
			uri = await this.uri(tokenId);
		} catch(err: any) {
			console.warn('AssetFactory#uriNoErr', AssetType[this.type], ChainType[this.chain], this.address, tokenId, err.message);
		}
		return uri;
	}

	get isValid() { // chain is valid
		return !!this._web3;
	}

	get enableWatch() {
		return true;
	}

	get web3() {
		somes.assert(this._web3, `Chain type not supported => ${ChainType[ChainType.MATIC]}`);
		return this._web3 as MvpWeb3;
	}

	async contract() {
		return this.web3.contract(this.address);
	}

	async assetContract() {
		if (!this._ac) {
			var [ac] = await db.select('asset_contract', { address: this.address, chain: this.chain }) as AssetContract[];
			somes.assert(ac, `No match the ${this.address} asset_contract`);
			this._ac = ac;
		}
		return this._ac;
	}

	constructor(address: string, type: AssetType, chain: ChainType) {
		this.address = cryptoTx.checksumAddress(address);
		this.type = type;
		this.chain = chain;
		this.originType = type;
		if (this.type >= AssetType.ERC721Proxy) {
			this.type >>= 8;
		}
		this._web3 = web3s[chain];
	}

	private async syncEvent(fromBlock: number, toBlock: number, event: string, resolve: ResolveEvent) {
		var self = this;
		var abiI = await getAbiByType(this.originType) as AbiInterface;
		var abiItem = abiI.abi.find(e=>e.name==event);
		if (!abiItem) return 0;

		var signature = this.web3.eth.abi.encodeEventSignature(abiItem);
		var logs: Log[] = await this.web3.eth.getPastLogs({
			address: this.address, topics: [signature], fromBlock, toBlock,
		});
		var transactions: Dict<Transaction> = {};

		async function getTransaction(hash: string) {
			if (!transactions[hash])
				transactions[hash] = await self.web3.eth.getTransaction(log.transactionHash);
			return transactions[hash];
		}

		for (var log of logs) {
			var tx = await getTransaction(log.transactionHash);
			somes.assert(await this.solveReceiptLogFrom(event, signature, abiItem, log, tx, resolve), 'AssetFactory#syncEvent not solve log');

			if (cfg.logs.event) {
				console.log(ChainType[this.chain], AssetType[this.originType], 
						`event=${event}`, this.address, `blockNumber=${log.blockNumber}`, `idx=${log.transactionIndex}`, `hash=${log.transactionHash}`);
			}
		}
		return logs.length;
	}

	async sync(fromBlock: number, toBlock: number): Promise<number> {
		if (cfg.logs.sync)
			console.log(`Asset Sync:`, fromBlock, '->', toBlock, ChainType[this.chain], ':', AssetType[this.originType], this.address);

		var events = 0;
		for (var [event, watch] of Object.entries(this.events)) {
			events += await this.syncEvent(fromBlock, toBlock, event, watch);
		}
		// update sync_height
		var sync_height = toBlock + 1;
		if (this._ac)
			this._ac.sync_height = sync_height;

		return events;
	}

	private async solveReceiptLogFrom(
		event: string, signature: string, abiItem: AbiItem,
		log: Log, tx: Transaction, resolve: ResolveEvent, noErr?: boolean
	) {
		try {
			var returnValues = 
				this.web3.eth.abi.decodeLog(abiItem.inputs as AbiInput[], log.data, log.topics.slice(1));
		} catch(err) {
			return false;
		}

		var e: EventData = {
			returnValues,
			raw: {
				data: log.data,
				topics: log.topics,
			},
			event,
			signature,
			logIndex: log.logIndex,
			transactionIndex: log.transactionIndex,
			transactionHash: log.transactionHash,
			blockHash: log.blockHash,
			blockNumber: log.blockNumber,
			address: log.address,
		};

		try {
			await resolve.use.call(this, e, tx);
		} catch(err:any) {
			uncaught[noErr ? 'warn': 'fault']('AssetFactory#solveReceiptLogFrom',
				err.message, this.address, AssetType[this.type], ChainType[this.chain], tx, log
			);
			if (noErr) {
				return false;
			} else {
				throw err;
			}
		}

		return true;
	}

	async solveReceiptLog(log: Log, tx: Transaction) {
		var abiI = await getAbiByType(this.originType) as AbiInterface;

		for (var [event, resolve] of Object.entries(this.events)) {
			var abiItem = abiI.abi.find(e=>e.name==event);
			if (abiItem) {
				var signature = this.web3.eth.abi.encodeEventSignature(abiItem);
				if (signature == log.topics[0]) {
					if ( await this.solveReceiptLogFrom(event, signature, abiItem, log, tx, resolve, true) ) {
						return true;
					}
				}
			}
		}
		return false;
	}

	async test(log: Log) {
		var abiJson = await getAbiByType(this.originType) as AbiInterface;

		for (var [event, evt] of Object.entries(this.events)) {
			if (!evt.test)
				continue;
			var abiItem = abiJson.abi.find(e=>e.name==event);
			if (abiItem) {
				var abi = this.web3.eth.abi;
				var signature = abi.encodeEventSignature(abiItem);

				if (signature == log.topics[0]) {
					try {
						var returnValues = abi.decodeLog(abiItem.inputs as AbiInput[], log.data, log.topics.slice(1));
					} catch(err) {
						continue;
					}

					var e: EventData = {
						returnValues,
						raw: {
							data: log.data,
							topics: log.topics,
						},
						event,
						signature,
						logIndex: log.logIndex,
						transactionIndex: log.transactionIndex,
						transactionHash: log.transactionHash,
						blockHash: log.blockHash,
						blockNumber: log.blockNumber,
						address: log.address,
					};

					try {
						await evt.test.call(this, e, abiJson);
						return this.originType;
					} catch(err) {}
				}
			}
		}

		return AssetType.INVALID;
	}

	async asset(tokenId: string) {
		//var ac = await this.assetContract();
		var token = this.address;
		var type = this.type;
		var chain = this.chain;

		var [asset] = await db.select<Asset>('asset', { token, tokenId, chain }, {limit:1});
		if (!asset) {
			//if (type != ac.type) {
			//	type = ac.type; // use asset contract type
			//	console.warn('fix assert.type no match, assert.type != assetContract.type');
			//}
			var uri = await fetch.storageTokenURI(await this.uriNoErr(tokenId), {
				tokenId, token, type, chain,
			} as any);
			uri = uri.substring(0, 512);
			var id = await db.insert('asset', { token, tokenId, type, chain, uri });
			var [asset] = await db.select<Asset>('asset', {id});
		} else { // fix data ..
			//await this.assetUpdate(asset, ac);
		}
		return asset;
	}

	async assetUpdate(asset: Asset, ac: AssetContract) {
		var token = this.address;
		var type = this.type;
		var chain = this.chain;

		if (ac.type != type) {
			type = ac.type;
			console.warn('fix assert.type no match, assert.type != assetContract.type');
		}
		if (ac.chain != chain) {
			chain = ac.chain;
			console.warn('fix assert.chain no match, assert.chain != assetContract.chain');
		}
		
		if (asset.token != token
			|| this.type != type
			|| asset.chain != chain
		) { // fix case sensitive or type
			await db.update('asset', {token, type, chain}, {id: asset.id});
			Object.assign(asset, {token, type, chain});
		}
	}

	static postMessage(asset: AssetMy, event: string = 'UpdateNFT') {
		// msg.postMessageFrom(asset.ownerBase || asset.owner || '', event, asset);
	}

	static async blockTimeStamp(web3: IBcWeb3, blockNumber: number) {
		var cur = await web3.getBlockNumber();
		// var block = await web3.impl.eth.getBlock(blockNumber);
		// var time0 = Number(block.timestamp) * 1e3;
		return parseInt((Date.now() - (cur - blockNumber) * 13.545 * 1e3) as any);
	}

	static Number(num: number | string) {
		num = String(num);
		if (num.length > 66) {
			num = Number(num).toString();
		}
		return num;
	}

	async assetTransaction(
		txHash: string, blockNumber: number, count: string, tokenId: string,
		from: [string, number], // from address/total
		to: [string, number], // to address/total
		value: string,
	) {
		var chain = this.chain;
		var token = this.address;
		var asset = await this.asset(tokenId);
		var time = await AssetFactory.blockTimeStamp(this.web3, blockNumber);

		for (let [owner,count_] of [from,to]) {
			if (BigInt(owner)) {
				var asset_o = await db.selectOne<AssetOwner>('asset_owner', { chain, token, tokenId, owner });
				var count = AssetFactory.Number(count_);
				if (asset_o) {
					if (asset_o.count != count) {
						await db.update('asset_owner', { count }, { chain, token, tokenId, owner });
					} else {
						continue;
					}
				} else {
					await db.insert('asset_owner', { chain, token, count, tokenId, owner });
				}
				AssetFactory.postMessage({ ...asset, owner, count: String(count) });
			}
		}

		var up: Dict = { modifiedDate: time };
		if (!asset.author && !BigInt(from[0]) && BigInt(to[0])) { // update author
			Object.assign(up, { author: to[0], createdDate: time });
		}
		await db.update('asset', up, { id: asset.id });

		var orders = await db.select<AssetOrder>('asset_order', { txHash });

		if (!orders.length || !orders.find(e=>e.token==token&&e.tokenId==tokenId)) 
		{ // skip repact
			await db.insert('asset_order', {
				txHash: txHash,
				blockNumber: blockNumber,
				token, tokenId,
				fromAddres: from[0],
				toAddress: to[0],
				count: count,
				value: `${value}`,
				chain: this.chain,
				date: time,
			});
		}

		// sync.assetMetaDataSync.fetchFrom(asset);
	}

}

export class AssetUnknown extends AssetFactory {
	uri(id: string): Promise<string> {
		throw Error.new(errno.ERR_NOT_IMPL_ASSET_UNKNOWN).ext({ description: `Not impl AssetUnknown.uri(${id}) for token=${this.address}` });
	}
	balanceOf(owner: string, id: string): Promise<number> {
		throw Error.new(errno.ERR_NOT_IMPL_ASSET_UNKNOWN).ext({description:`Not impl AssetUnknown.balanceOf(${owner}, ${id}) for token=${this.address}`});
	}
	sync(fromBlock: number, toBlock: number): Promise<number> {
		throw Error.new(errno.ERR_NOT_IMPL_ASSET_UNKNOWN).ext({ description: `Not impl AssetUnknown.assetSync(${fromBlock}, ${toBlock}) for token=${this.address}` });
	}
	async solveReceipt(log: Log, tx: Transaction) {
		return false;
	}
	events = {};
}
