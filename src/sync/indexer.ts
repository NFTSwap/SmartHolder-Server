/**
 * @copyright © 2023 Copyright ccl
 * @date 2023-01-11
 */

import watch, {WatchCat} from 'bclib/watch';
import db, {
	ChainType, ContractInfo, Indexer as IIndexer,
	ContractType, Transaction, TransactionLog,
} from '../db';
import msg, {postNewIndexer, EventNewIndexer, postIndexerNextBlock} from '../message';
import * as deployInfo from '../../deps/SmartHolder/deployInfo.json';
import * as contract from '../models/contract';
import * as env from '../env';
import mk_scaner from './mk_scaner';
import {WatchBlock} from './block';
import * as redis from 'bclib/redis';

/**
 * @class indexer for dao
*/
export class Indexer implements WatchCat {
	readonly chain: ChainType;
	readonly data: IIndexer;
	readonly ds: Dict<ContractInfo> = {}; // address => ContractInfo
	private _dsList: ContractInfo[] = [];

	constructor(chain: ChainType, data: IIndexer) {
		this.chain = chain;
		this.data = data;
	}

	async initialize() {
		let dss = await db.select<ContractInfo>(`contract_info_${this.chain}`, { indexer_id: this.data.id });
		for (let ds of dss) {
			if (ds.state == 0) {
				this.ds[ds.address] = ds;
				this._dsList.push(ds);
			}
		}
	}

	async addDataSource({address, ...ds}: Partial<ContractInfo> & {address: string}) {
		if (
			address &&
			address != '0x0000000000000000000000000000000000000000' && 
			!await contract.select(address, this.chain, true)
		) {
			await contract.insert({address, ...ds}, this.chain);
			let ds_ = (await contract.select(address, this.chain, true))!;
			if (ds_.state == 0) {
				this.ds[address] = ds_;
				this._dsList.push(ds_);
			}
		}
	}

	async deleteDataSource(address: string) {
		let c = await contract.select(address, this.chain, true);
		if (c && c.state == 0) {
			await contract.update({state: 1}, address, this.chain);
			let ds = this.ds[address];
			ds.state = 1;
			delete this.ds[address];
		}
	}

	private async solveLogs(blockNumber: number, info: ContractInfo) {
		let logs = await db.select<TransactionLog>(
			`transaction_log_${this.chain}`, {address: info.address, blockNumber}, {order: 'logIndex'});

		if (!logs.length) return;

		let tx: Transaction | null = null;
		let getTx = async (hash: string)=>{
			if (!tx)
				tx = await db.selectOne<Transaction>(`transaction_${this.chain}`, { transactionHash: hash });
			return tx!;
		}

		for (let log of logs) {
			let address = log.address;
			let scaner = mk_scaner(address, info.type, this.chain);
			let tx = await getTx(log.transactionHash);

			let log_ = {
				address,
				data: log.data,
				topics: [log.topic0, log.topic1, log.topic2, log.topic3].filter(e=>e),
				logIndex: log.logIndex,
				transactionIndex: log.transactionIndex,
				transactionHash: log.transactionHash,
				blockHash: log.blockHash,
				blockNumber: log.blockNumber,
			};

			let tx_ = {
				hash: tx.transactionHash,
				nonce: tx.nonce,
				blockHash: tx.blockHash,
				blockNumber: tx.blockNumber,
				transactionIndex: tx.transactionIndex,
				from: tx.fromAddress,
				to: tx.toAddress == '0x0000000000000000000000000000000000000000' ? null: tx.toAddress,
				value: tx.value,
				gasPrice: tx.gasPrice,
				maxFeePerGas: tx.gas,
				gas: Number(tx.gas),
				input: '0x',
			};

			await scaner.solveReceiptLog(log_, tx_);
		}
	}

	static async getWatchHeightFromHash(chain: ChainType, hash: string) {
		let height = await redis.get<number>(`indexer_hash_${chain}_${hash.toLowerCase()}`);
		if (height) return height;
		let obj = await db.selectOne<IIndexer>(`indexer_${chain}`, {hash});
		return obj ? obj.watchHeight: 0;
	}

	async cat() {
		let blockNumber = this.data.watchHeight;
		let curBlockNumber = await WatchBlock.getMinBlockSyncHeight(this.chain);

		while (blockNumber++ < curBlockNumber) {
			await db.transaction(async (db)=>{
				for (let i = 0; i < this._dsList.length; i++) {
					let ds = this._dsList[i];
					if (ds.state == 0) {
						await this.solveLogs(blockNumber, this._dsList[i]);
					}
				}
				await db.update(`indexer_${this.chain}`, {watchHeight: blockNumber}, {id: this.data.id});
				await redis.set(`indexer_hash_${this.chain}_${this.data.hash.toLowerCase()}`, blockNumber);
				postIndexerNextBlock(this.chain, this.data.id, this.data.hash, blockNumber);
				this.data.watchHeight = blockNumber;
			});
		}
		return true;
	}
}

export class RunIndexer implements WatchCat {
	readonly chain: ChainType;
	readonly workers: number;// = 1;
	readonly worker: number;// = 0;
	readonly indexers: Dict<Indexer> = {}; // id => Indexer
	readonly cattime = 40; // 20 * 6 = 240 second

	constructor(chain: ChainType, worker = 0, workers = 1) {
		this.chain = chain;
		this.worker = worker;
		this.workers = workers;
	}

	static async addIndexer(
		chain: ChainType,
		hash: string,
		blockNumber: number,
		initDataSource: (Partial<ContractInfo> & {address: string})[] = []
	) {
		if (await db.selectOne(`indexer_${chain}`, {hash}))
			return;

		let id = await db.insert(`indexer_${chain}`, {hash, watchHeight: Math.max(0, blockNumber - 1)});

		for (let {id:_, ...ds} of initDataSource) {
			if (!await contract.select(ds.address, chain, true)) {
				await contract.insert({
					...ds,
					indexer_id: id,
					host: ds.host || '0x0000000000000000000000000000000000000000',
					time: Date.now(),
					blockNumber,
				}, chain);
			}
		}

		postNewIndexer(chain, id);
	}

	private async addWatch(i: IIndexer) {
		let j = BigInt(i.hash) % BigInt(this.workers);
		if (Number(j) == this.worker) {
			if (!this.indexers[i.id]) {
				let indexer = new Indexer(this.chain, i);
				await indexer.initialize(); // init
				this.indexers[i.id] = indexer;
				watch.impl.addWatch(indexer); // add to watch
			}
		}
	}

	async initialize() {
		let isMainWorker = !env.workers || env.workers.id === 0;

		msg.addEventListener(EventNewIndexer, async (e)=>{
			let obj = await db.selectOne<IIndexer>(`indexer_${this.chain}`, { id: e.data.id });
			if (obj)
				await this.addWatch(obj);
		});

		if (isMainWorker) { // init DAOs contract, add indexer
			let info = deployInfo[ChainType[this.chain].toLowerCase() as 'goerli'];
			if (info) {
				let {address,blockNumber} = info.DAOsProxy;
				// init root indexer
				await RunIndexer.addIndexer(this.chain, address, blockNumber, [{
					address, type: ContractType.DAOs, blockNumber
				}]);
			}
		}

	}

	async cat() {
		let indexer = await db.select<IIndexer>(`indexer_${this.chain}`);

		for (let i of indexer) {
			await this.addWatch(i);
		}
		return true;
	}
}