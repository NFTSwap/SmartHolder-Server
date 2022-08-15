/**
 * @copyright © 2021 Copyright ccl
 * @date 2021-09-26
 */

import { Asset, AssetOrder, ContractInfo, ContractType, ChainType } from '../models/def';
import db from '../db';
import {IBcWeb3} from 'bclib/web3_tx';
import {web3s, MvpWeb3} from '../web3+';
import {EventData} from 'web3-tx';
import somes from 'somes';
import {Transaction, Log} from 'web3-core';
import {getAbiByType} from '../web3+';
import {AbiInterface} from 'bclib/abi';
import {AbiInput} from 'web3-utils';
import * as cfg from '../../config';
import {AbiItem} from 'web3-utils';
import uncaught from '../uncaught';

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

export async function blockTimeStamp(web3: IBcWeb3, blockNumber: number) {
	var cur = await web3.getBlockNumber();
	// var block = await web3.impl.eth.getBlock(blockNumber);
	// var time0 = Number(block.timestamp) * 1e3;
	return parseInt((Date.now() - (cur - blockNumber) * 13.545 * 1e3) as any);
}

export function getNumber(num: number | string) {
	num = String(num);
	if (num.length > 66) {
		num = Number(num).toString();
	}
	return num;
}

export interface ResolveEvent {
	use(this: ContractScaner, e: EventData, tx: Transaction): Promise<void>;
	test?(this: ContractScaner, e: EventData, abi: AbiInterface): Promise<void>;
}

export interface IAssetScaner {
	uri(tokenId: string): Promise<string>;
	uriNoErr(tokenId: string): Promise<string>;
	balanceOf(owner: string, tokenId: string): Promise<number>;
}

export abstract class ContractScaner {
	private _web3?: MvpWeb3;
	private _info?: ContractInfo;

	readonly address: string;
	readonly type: ContractType;
	readonly chain: ChainType;

	abstract readonly events: Dict<ResolveEvent>;

	get isValid() { // chain is valid
		return !!this._web3;
	}

	get web3() {
		somes.assert(this._web3, `Chain type not supported => ${ChainType[this.chain]}`);
		return this._web3 as MvpWeb3;
	}

	asAsset(): IAssetScaner | null {
		return null;
	}

	async info() {
		if (!this._info) {
			var [info] = await db.select(`asset_contract_${this.chain}`, { address: this.address, chain: this.chain }) as ContractInfo[];
			somes.assert(info, `No match the ${this.address} asset_contract`);
			this._info = info;
		}
		return this._info;
	}

	async host() {
		return (await this.info()).host;
	}

	async contract() {
		return this.web3.contract(this.address);
	}

	async methods() {
		return (await this.contract()).methods;
	}

	constructor(address: string, type: ContractType, chain: ChainType) {
		this.address = cryptoTx.checksumAddress(address);
		this.type = type;
		this.chain = chain;
		this._web3 = web3s[chain];
	}

	private async scanEvent(fromBlock: number, toBlock: number, event: string, resolve: ResolveEvent) {
		var self = this;
		var abiI = await getAbiByType(this.type) as AbiInterface;
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
			somes.assert(await this.solveReceiptLogFrom(event, signature, abiItem, log, tx, resolve), 'ContractScaner#scanEvent not solve log');

			if (cfg.logs.event) {
				console.log(ChainType[this.chain], ContractType[this.type], 
						`event=${event}`, this.address, `blockNumber=${log.blockNumber}`, `idx=${log.transactionIndex}`, `hash=${log.transactionHash}`);
			}
		}
		return logs.length;
	}

	async scan(fromBlock: number, toBlock: number): Promise<number> {
		if (cfg.logs.sync) {
			console.log(`Asset Sync:`, fromBlock, '->', toBlock, ChainType[this.chain], ':', ContractType[this.type], this.address);
		}
		var events = 0;
		for (var [event, watch] of Object.entries(this.events)) {
			events += await this.scanEvent(fromBlock, toBlock, event, watch);
		}
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
			uncaught[noErr ? 'warn': 'fault']('ContractScaner#solveReceiptLogFrom',
				err.message, this.address, ContractType[this.type], ChainType[this.chain], tx, log
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
		var abiI = await getAbiByType(this.type) as AbiInterface;

		for (var [event, resolve] of Object.entries(this.events)) {
			var abiItem = abiI.abi.find(e=>e.name==event);
			if (abiItem) {
				var signature = this.web3.eth.abi.encodeEventSignature(abiItem);
				if (signature == log.topics[0]) {
					somes.assert(
						await this.solveReceiptLogFrom(event, signature, abiItem, log, tx, resolve),
						'ContractScaner#solveReceiptLog not solve log'
					);
					return true;
				}
			}
		}
		return false;
	}

}

export class ContractUnknown extends ContractScaner {
	events = {};
}
