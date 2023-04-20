/**
 * @copyright © 2021 Copyright ccl
 * @date 2021-09-26
 */

import { ContractInfo, ContractType, ChainType } from '../models/define';
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
import * as contract from '../models/contract';
import * as cryptoTx from 'crypto-tx';
import {DatabaseCRUD} from 'somes/db';
import db from '../db';

export function formatHex(hex_str: string | number | bigint, btyes: number = 32) {
	var s = '';
	if (typeof hex_str == 'string') {
		s = BigInt(hex_str).toString(16);
	} else {
		s = hex_str.toString(16);
	}
	var len = btyes ? (btyes * 2) - s.length: s.length % 2;
	if (len > 0) {
		return '0x' + Array.from({length: len + 1}).join('0') + s;
	} else {
		return '0x' + s;
	}
}

export async function blockTimeStamp(web3: IBcWeb3, blockNumber: number, last: number = 0) {
	last = last || await web3.getBlockNumber();
	// var block = await web3.impl.eth.getBlock(blockNumber);
	// var time0 = Number(block.timestamp) * 1e3;
	return parseInt((Date.now() - (last - blockNumber) * 13.545 * 1e3) as any);
}

export function getNumber(num: number | string) {
	num = String(num);
	if (num.length > 66) {
		num = Number(num).toString();
	}
	return num;
}

export interface HandleEventData {
	event: EventData;
	tx: Transaction;
	blockTime: number;
	blockNumber: number;
}

export interface ResolveEvent {
	handle(this: ContractScaner, e: HandleEventData): Promise<void>;
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
	readonly db: DatabaseCRUD;

	abstract readonly events: Dict<ResolveEvent>;

	get isValid() { // chain is valid
		return !!this._web3;
	}

	get web3() {
		somes.assert(this._web3, `#ContractScaner#web3 Chain type not supported => ${ChainType[this.chain]}`);
		return this._web3!;
	}

	asAsset(): IAssetScaner | null {
		return null;
	}

	async info() {
		if (!this._info) {
			let info = await contract.select(this.address, this.chain)!;
			somes.assert(info, `#ContractScaner#info No match the ${this.address} contract_info_${this.chain}`);
			this._info = info!;
		}
		return this._info;
	}

	contract() { return this.web3.contract(this.address) }
	async methods() { return (await this.contract()).methods }
	async host() { return (await this.info()).host }

	constructor(address: string, type: ContractType, chain: ChainType, db_?: DatabaseCRUD) {
		this.address = cryptoTx.checksumAddress(address);
		this.type = type;
		this.chain = chain;
		this._web3 = web3s[chain];
		this.db = db_ || db;
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

	private async scanEvent(fromBlock: number, toBlock: number, event: string, resolve: ResolveEvent) {
		let self = this;
		let abiI = (await getAbiByType(this.type))!;
		let abiItem = abiI.abi.find(e=>e.name==event);
		if (!abiItem) return 0;

		let signature = self.web3.eth.abi.encodeEventSignature(abiItem);
		let logs: Log[] = await this.web3.eth.getPastLogs({
			address: this.address, topics: [signature], fromBlock, toBlock,
		});
		let txs: Dict<Transaction> = {};

		async function getTransaction(hash: string) {
			if (!txs[hash])
				txs[hash] = await self.web3.eth.getTransaction(hash);
			return txs[hash];
		}

		for (let log of logs) {
			let tx = await getTransaction(log.transactionHash);
			await this.solveReceiptLogFrom(event, signature, abiItem, log, tx, resolve);

			if (cfg.logs.event) {
				console.log(ChainType[this.chain], ContractType[this.type], 
						`event=${event}`, this.address, `blockNumber=${log.blockNumber}`, `idx=${log.transactionIndex}`, `hash=${log.transactionHash}`);
			}
		}
		return logs.length;
	}

	async solveReceiptLog(log: Log, tx: Transaction) {
		var abiI = (await getAbiByType(this.type))!;

		for (var [event, resolve] of Object.entries(this.events)) {
			var abiItem = abiI.abi.find(e=>e.name==event);
			if (abiItem) {
				var signature = this.web3.eth.abi.encodeEventSignature(abiItem).toLowerCase();
				if (signature == log.topics[0].toLowerCase()) {
					await this.solveReceiptLogFrom(event, signature, abiItem, log, tx, resolve);
					return;
				}
			}
		}
		console.warn('#ContractScaner#solveReceiptLog Ignore Log', log);
	}

	private async solveReceiptLogFrom(
		event: string, signature: string, abiItem: AbiItem, log: Log, tx: Transaction, resolve: ResolveEvent
	) {
		try {
			var returnValues = 
				this.web3.eth.abi.decodeLog(abiItem.inputs as AbiInput[], log.data, log.topics.slice(1));
		} catch(err: any) {
			uncaught.fault('#ContractScaner#solveReceiptLogFrom 1',
				...err.filter(['errno', 'message', 'description', 'stack']), //err,
				this.address, ContractType[this.type], ChainType[this.chain], tx, log
			);
			throw err;
		}

		let e: EventData = {
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
			let blockTime = Date.now();
			await resolve.handle.call(this, {event: e, tx,blockTime, blockNumber: Number(e.blockNumber)});
		} catch(err:any) {
			uncaught.fault(
				'#ContractScaner#solveReceiptLogFrom 2',
				...err.filter(['errno', 'message', 'description', 'stack']), //err,
				this.address, ContractType[this.type], ChainType[this.chain], tx, log
			);
			throw err;
		}
	}

}

export class ContractUnknown extends ContractScaner {
	events = {};
}
