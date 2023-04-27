/**
 * @copyright © 2023 Copyright ccl
 * @date 2023-01-11
 */

import watch, {WatchCat} from 'bclib/watch';
import db, {
	ChainType, ContractInfo, Indexer as IIndexer,
	ContractType, Transaction, TransactionLog } from '../db';
import msg, {postNewIndexer, EventNewIndexer, postIndexerNextBlock} from '../message';
import * as deployInfo from '../../deps/SmartHolder/deployInfo.json';
import * as contract from '../models/contract';
import * as env from '../env';
import mk_scaner, {ContractScaner} from './mk_scaner';
import index from './index';
import redis from 'bclib/redis';
import {DatabaseCRUD} from 'somes/db';
import pool from 'somes/mysql/pool';
import {Event} from 'somes/event';
import somes from 'somes';

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
		somes.assert(dss.length, '#Indexer.initialize dss.length is equal 0');

		for (let ds of dss) {
			if (ds.state == 0) {
				this.ds[ds.address] = ds;
				this._dsList.push(ds);
			}
		}
	}

	async addDataSource({address, ...ds}: Partial<ContractInfo> & {address: string}) {
		if (!address || address == '0x0000000000000000000000000000000000000000')
			return;
		let chain = this.chain;
		let ds_ = await contract.select(address, chain, true);

		if (ds_ && ds_.state == 1) {
			await contract.update({
				...ds,
				indexer_id: this.data.id,
				state: 0,
				time: Date.now(),
			}, address, chain);
			ds_.state = 0;
		} else if (!ds_) { // insert
			await contract.insert({
				...ds,
				indexer_id: this.data.id,
				host: ds.host || '0x0000000000000000000000000000000000000000',
				time: Date.now(),
			}, chain);
			ds_ = (await contract.select(address, chain, true))!;
		} else {
			return;
		}

		if (!this.ds[address]) {
			this.ds[address] = ds_;
			this._dsList.push(ds_);
		}
	}

	async deleteDataSource(address: string) {
		let c = await contract.select(address, this.chain, true);
		if (c && c.state == 0) {
			await contract.update({state: 1}, address, this.chain);
			this.ds[address].state = 1; // mark delete state
		}
	}

	private async solveLogs(logs: TransactionLog[], info: ContractInfo, db: DatabaseCRUD, out: ContractScaner[] ) {

		let tx: Transaction | null = null;
		let getTx = async (hash: string)=>{
			if (!tx)
				tx = await index.watchBlocks[this.chain].getTransaction(hash);
			return tx!;
		}

		for (let log of logs) {
			let address = log.address;
			let scaner = mk_scaner(address, info.type, this.chain, db);
			let tx = await getTx(log.transactionHash);

			if (log.data.slice(0,2) != '0x') {
				if (log.data == 'rpc:fetch' || log.data.slice(0,4) == 'http'/*Compatible with old*/) {
					let logs = await scaner.web3.eth.getPastLogs({
						fromBlock: tx.blockNumber, toBlock: tx.blockNumber, address: address,
					});
					log.data = logs.find(e=>
						e.transactionIndex==log.transactionIndex && e.logIndex==log.logIndex
					)!.data;
				}
			}

			let log_ = {
				address,
				data: log.data,
				topics: [log.topic0, log.topic1, log.topic2, log.topic3].filter(e=>e),
				logIndex: log.logIndex,
				transactionIndex: log.transactionIndex,
				transactionHash: log.transactionHash,
				blockHash: log.blockHash,
				blockNumber: log.blockNumber,
				removed: false,
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

			out.push(scaner);
		}
	}

	static async getWatchHeightFromHash(chain: ChainType, hash: string) {
		let height = await redis.get<number>(`indexer_hash_${chain}_${hash.toLowerCase()}`);
		if (height) return height;
		let obj = await db.selectOne<IIndexer>(`indexer_${chain}`, {hash});
		return obj ? obj.watchHeight: 0;
	}

	async cat() {
		let chain = this.chain;
		let blockNumber = this.data.watchHeight;
		let watchBlock = index.watchBlocks[chain];
		let curBlockNumber = await watchBlock.getValidBlockSyncHeight();
		// let test_id = somes.random();

		let setBlockNumber = async (blockNumber: number)=>{
			await db.update(`indexer_${chain}`, {watchHeight: blockNumber}, {id: this.data.id});
			await redis.set(`indexer_hash_${chain}_${this.data.hash.toLowerCase()}`, blockNumber);
			postIndexerNextBlock(chain, this.data.id, this.data.hash, blockNumber);
			this.data.watchHeight = blockNumber;
		};

		while (blockNumber < curBlockNumber) {
			let end = Math.min(blockNumber + 100, curBlockNumber);
			let logsAll = await watchBlock.getTransactionLogsFrom(blockNumber+1, end, this._dsList);

			for (let block of logsAll.blocks) {
				let allScaner: (ContractScaner)[] = [];

				await db.transaction(async (db)=>{
					for (let logs of block.logs) {
						// let log = logs.logs.find(e=>e.transactionHash=='0x84eff6fc01a493fe7dcaaaaf1996eff397592ca44457cdb5303413e61b86b237');
						// if (log)
							// console.log(test_id);
						await this.solveLogs(logs.logs, this._dsList[logs.idx], db, allScaner);
					}
					if (block.logs.length)
						await setBlockNumber(blockNumber = block.blockNumber);
				});
				// resolve block ok

				if (allScaner.length) {
					let evt = new Event(null);
					for (let s of allScaner)
						s.onAfterSolveBlockReceipts.triggerWithEvent(evt);
				}
			}

			if (blockNumber < end) {
				await setBlockNumber(blockNumber = end);
			}
		}

		return true;
	}
}

/**
 * @class IndexerPool indexer manage
*/
export class IndexerPool implements WatchCat {
	readonly chain: ChainType;
	readonly workers: number;// = 1;
	readonly worker: number;// = 0;
	readonly indexers: Dict<Indexer> = {}; // id => Indexer
	readonly cattime = 40; // 20 * 6 = 240 second

	constructor(chain: ChainType, worker = 0, workers = 1) {
		this.chain = chain;
		this.worker = worker;
		this.workers = workers;
		pool.MAX_CONNECT_COUNT = 10; // max 50
		// pool.CONNECT_TIMEOUT = 2e4; // 20 second
	}

	static async addIndexer(
		chain: ChainType, hash: string, blockNumber: number,
		initDataSource: (Partial<ContractInfo> & {address: string, exclude?: boolean/*exclude indexer*/})[] = []
	) {
		if (await db.selectOne(`indexer_${chain}`, {hash}))
			return ()=>{};

		let id = await db.transaction(async (db: DatabaseCRUD)=>{
			let id = await db.insert(`indexer_${chain}`, {hash, watchHeight: Math.max(0, blockNumber - 1)});

			for (let {id:_, ...ds} of initDataSource) {
				if (!await contract.select(ds.address, chain, true)) {
					await db.insert(`contract_info_${chain}`, { // use transaction
						...ds,
						indexer_id: ds.exclude ? 0: id,
						host: ds.host || '0x0000000000000000000000000000000000000000',
						time: Date.now(),
						blockNumber,
					});
				}
			}
			return id;
		});

		return ()=>postNewIndexer(chain, id);
	}

	private async addWatch(i: IIndexer) {
		let j = BigInt(i.hash) % BigInt(this.workers);
		if (Number(j) == this.worker) {
			if (!this.indexers[i.id]) {
				let indexer = new Indexer(this.chain, i);
				this.indexers[i.id] = indexer;
				try {
					await indexer.initialize(); // init
					watch.impl.addWatch(indexer); // add to watch
				} catch(err) {
					delete this.indexers[i.id];
					throw err;
				}
			}
		}
	}

	async initialize() {
		let isMainWorker = !env.workers || env.workers.id === 0;

		msg.addEventListener(EventNewIndexer, async (e)=>{
			let obj = await db.selectOne<IIndexer>(`indexer_${this.chain}`, { id: e.data.indexer_id });
			if (obj)
				await this.addWatch(obj);
		});

		if (isMainWorker) { // init DAOs contract, add indexer
			let info = deployInfo[ChainType[this.chain].toLowerCase() as 'goerli'];
			if (info) {
				let {address,blockNumber} = info.DAOsProxy;
				// init root indexer
				await IndexerPool.addIndexer(this.chain, address, blockNumber, [{
					address, type: ContractType.DAOs, blockNumber
				}]);
			}
		}

		await this.cat();
	}

	async cat() {
		let indexer = await db.select<IIndexer>(`indexer_${this.chain}`);

		for (let i of indexer) {
			await this.addWatch(i);
		}
		return true;
	}
}