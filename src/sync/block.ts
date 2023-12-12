/**
 * @copyright © 2021 Copyright ccl
 * @date 2022-07-21
 */

import '../uncaught';
import somes from 'somes';
import buffer, {IBuffer} from 'somes/buffer';
import {WatchCat} from 'bclib/watch';
import db_, { storage as storage_, ChainType,
	Transaction as ITransaction,TransactionLog } from '../db';
import {MvpWeb3,isRpcLimitRequestAccount} from '../web3+';
import {Transaction, TransactionReceipt} from 'web3-core';
import * as cryptoTx from 'crypto-tx';
import {postWatchBlock} from '../message';
import redis_, {Redis} from 'bclib/redis';
import pool from 'somes/mysql/pool';
import {Charsets} from 'somes/mysql/constants';
import * as cfg from '../../config';
import {MysqlTools} from 'somes/mysql';
import {escape} from 'somes/db';
import {Storage} from 'bclib/storage';
import * as env from '../env';
import api from '../request';
import * as deployInfo from '../../deps/SmartHolder/deployInfo.json';
import {toBuffer as toBuffer_0} from 'crypto-tx';
import * as cry_utils from 'crypto-tx/utils';
import * as contract from '../models/contract';
import {hash} from '../utils';

const addressZero = '0x0000000000000000000000000000000000000000';
const Zero = BigInt(0);

function toBuffer(v?: string|number|bigint|Uint8Array) {
	if (typeof v == 'string') {
		if (cry_utils.isHexString(v)) {
			return buffer.from(cry_utils.padToEven(cry_utils.stripHexPrefix(v)), 'hex');
		} else {
			v = BigInt(v);
			if (v == Zero) {
				return buffer.Zero;
			} else {
				return buffer.from(cry_utils.padToEven(v.toString(16)), 'hex');
			}
		}
	}
	return toBuffer_0(v);
}

export async function testDB() {
	await somes.sleep(1e3);
	pool.CHAREST_NUMBER = Charsets.UTF8MB4_UNICODE_CI;
	let cfg_ = cfg.watchBlock;
	let db = new MysqlTools(cfg_.mysql);
	await db.load('', [], []);
}

function formatTransaction(tx: any): ITransaction {
	tx.fromAddress = '0x' + tx.fromAddress.toString('hex');
	tx.toAddress = '0x' + tx.toAddress.toString('hex');
	tx.value =  '0x' + (tx.value.length ? tx.value.toString('hex'): '0');
	tx.gasPrice = '0x' + tx.gasPrice.toString('hex');
	tx.gas = '0x' + tx.gas.toString('hex');
	tx.gasUsed = '0x' + tx.gasUsed.toString('hex');
	tx.cumulativeGasUsed = '0x' + tx.cumulativeGasUsed.toString('hex');
	tx.blockHash = '0x' + tx.blockHash.toString('hex');
	tx.transactionHash = '0x' + tx.transactionHash.toString('hex');
	tx.contractAddress = tx.contractAddress ? '0x' + tx.contractAddress.toString('hex'): undefined;
	return tx as any;
}

function formatTransactionLog(log: any, tx: ITransaction): TransactionLog {
	let topic = log.topic as IBuffer;
	log.address = '0x' + log.address.toString('hex');
	log.topic = [
		topic.slice(0, 32),
		topic.slice(32, 64),
		topic.slice(64, 96),
		topic.slice(96, 128),
	].filter(e=>e.length).map(e=>'0x'+e.toString('hex'));
	log.data = log.data ? '0x' + log.data.toString('hex'): '0x';
	log.transactionIndex = tx.transactionIndex;
	log.transactionHash = tx.transactionHash;
	log.blockHash = tx.blockHash;
	return log;
}

export class WatchBlock implements WatchCat {
	readonly web3: MvpWeb3;
	private _db: typeof db_;
	readonly redis: Redis;
	readonly storage: Storage;
	readonly use_shs_rpc: boolean;

	private readonly workers: number;// = 1;
	private readonly worker: number;// = 0;

	private _watchBlockWorkersCaches = {} as Dict<{ value:number, timeout: number }>;
	private _IsCompatibleMode?: number[];

	constructor(web3: MvpWeb3, worker = 0, workers = 1, use_shs_rpc = false) {
		this.web3 = web3;
		this.worker = worker;
		this.workers = workers;
		this.use_shs_rpc = use_shs_rpc;

		pool.MAX_CONNECT_COUNT = 10; // max 50

		let cfg_ = cfg.watchBlock;
		this._db = cfg_.mysql.host ? new MysqlTools(cfg_.mysql): db_;
		this.redis = cfg_.redis ? new Redis(cfg_.redis): redis_;
		this.storage = this._db === db_ ? storage_: new Storage();
	}

	async initialize() {
		if (this._db !== db_)
			await this._db.load('', [], []);
		if (redis_ !== this.redis)
			await this.redis.initialize();
		else {
			if (this._db !== db_)
				// reset Block_Sync_Height data for redis
				this.redis.del(`Block_Sync_Height_${ChainType[this.web3.chain]}`);
		}
		if (storage_ !== this.storage)
			this.storage.initialize(this._db);
	}

	/**
	 * @dev get database part table name and db
	*/
	async getDatabasePart<T = any>(fromBlocks: number[], data: T[] = []) {
		let chain = this.web3.chain;
		let partKeys: Dict<T[]> = {};
		let idx = 0;

		if (!this._IsCompatibleMode) {
			if (this._db.has(`transaction_bin_${chain}`)) {
				// check Is Compatible
				let tx = await this._db.selectOne<ITransaction>(`transaction_bin_${chain}`, {}, {order: 'blockNumber desc'});
				let log = await this._db.selectOne<TransactionLog>(`transaction_log_bin_${chain}`, {}, {order: 'blockNumber desc'});
				if (tx || log) {
					let blockNumber = Math.min(tx?.blockNumber || Infinity, log?.blockNumber || Infinity);
					this._IsCompatibleMode = [blockNumber];
				}
			}
			if (!this._IsCompatibleMode)
				this._IsCompatibleMode = [];
		}

		let compatibleMode = false;

		for (let from of fromBlocks) {
			let part = Math.floor(from / 1e5);
			let v = partKeys[part] || (partKeys[part] = []);
			let d = data[idx++];
			if (d)
				v.push(d);
			compatibleMode = !!this._IsCompatibleMode!.length && from < this._IsCompatibleMode![0];
		}

		let r: {db:typeof db_, part: string, data: T[], from: number, to: number}[] = [];

		for (let [part, data] of Object.entries(partKeys)) {
			let db = this._db;
			let name = `transaction_bin_${chain}_${part}`;
			if (!db.has(name)) {
				await db.load(`

					create table if not exists transaction_bin_${chain}_${part} (
						id                int unsigned primary key auto_increment,
						nonce             int unsigned                 not null,
						fromAddress       binary (20)                  not null,
						toAddress         binary (20)                  not null,
						value             varbinary (32)               not null,
						gasPrice          varbinary (32)               not null,
						gas               varbinary (32)               not null, -- gas limit
						-- data              blob                         null,  -- input data hex format
						gasUsed           varbinary (32)               not null, -- use gasd
						cumulativeGasUsed varbinary (32)               not null,
						-- effectiveGasPrice varbinary (32)               not null,
						blockNumber       int unsigned                 not null, -- input
						blockHash         binary (32)                  not null, -- receipt
						transactionHash   binary (32)                  not null,
						transactionIndex  smallint unsigned            not null,
						-- logsBloom         blob                         not null,
						contractAddress   binary (20)                  null, -- created contract address
						status            bit                          not null,
						logsCount         smallint unsigned            not null, -- logs count
						-- extend index
						txHash            int unsigned                 not null, -- short transaction hash
						fromHash          int unsigned                 not null,
						toHash            int unsigned                 not null
					) row_format=compressed;
		
					create table if not exists transaction_log_bin_${chain}_${part} (
						id                int unsigned primary key auto_increment,
						tx_id             int unsigned                 not null, -- id for transaction table
						address           binary (20)                  not null,
						topic             varbinary (128)              not null,
						data              blob                         null,
						logIndex          int unsigned                 not null, -- log index for transaction
						blockNumber       int unsigned                 not null,
						addressHash       int unsigned                 not null,
						addressNumber     smallint unsigned            not null  -- query region number  0-65535
					) row_format=compressed;

					drop procedure if exists insert_transaction_log_${chain}_${part};

					create procedure insert_transaction_log_${chain}_${part}(
						in tx_id_       int unsigned,
						in address_     binary(20),
						in topic_       varbinary(128),
						in data_        blob,
						in logIndex_    int unsigned,
						in blockNumber_ int unsigned,
						in addressHash_ int unsigned,
						in addressNumber_ smallint unsigned
					) begin
						set @count = (
							select count(*) from transaction_log_bin_${chain}_${part} where tx_id=tx_id_ and logIndex=logIndex_
						);
						if @count=0 then
							insert into transaction_log_bin_${chain}_${part}
								(tx_id,address,topic,data,logIndex,blockNumber,addressHash,addressNumber)
							values
								(tx_id_,address_,topic_,data_,logIndex_,blockNumber_,addressHash_,addressNumber_);
						end if;
					end;

				`, [], [
					// transaction
					`create        index transaction_bin_${chain}_${part}_0     on transaction_bin_${chain}_${part}     (txHash)`,
					`create        index transaction_bin_${chain}_${part}_1     on transaction_bin_${chain}_${part}     (blockNumber)`,
					`create        index transaction_bin_${chain}_${part}_2     on transaction_bin_${chain}_${part}     (fromHash)`,
					`create        index transaction_bin_${chain}_${part}_3     on transaction_bin_${chain}_${part}     (toHash)`,
					//transaction_log_bin
					`create unique index transaction_log_bin_${chain}_${part}_0 on transaction_log_bin_${chain}_${part} (tx_id,logIndex)`,
					`create        index transaction_log_bin_${chain}_${part}_1 on transaction_log_bin_${chain}_${part} (addressHash)`,
					`create        index transaction_log_bin_${chain}_${part}_2 on transaction_log_bin_${chain}_${part} (blockNumber,addressNumber,addressHash)`,
				], `shs_${chain}_${part}`);
			}
			let n = Number(part);
			r.push({db, part: chain + '_' + n, data, from: n * 1e5, to: n * 1e5 + 1e5});
		}

		if (compatibleMode) {
			let number = this._IsCompatibleMode![0];
			r.push({
				db: this._db,
				part: chain+'',
				data: data,
				from: number, to: number,
			});
		}

		return r;
	}

	private async solveReceipt(blockNumber: number, receipt: TransactionReceipt, transactionIndex: number, tx: Transaction) {
		let chain = this.web3.chain;
		somes.assert(receipt, `#WatchBlock.watchReceipt, receipt: TransactionReceipt Can not be empty, blockNumber=${blockNumber}`);
		somes.assert(transactionIndex == receipt.transactionIndex, '#WatchBlock.watchReceipt transaction index no match');

		let [{db,part}] = await this.getDatabasePart([blockNumber]);
		let transactionHash = toBuffer(receipt.transactionHash);
		let txHash = hash(transactionHash).value;
		let tx_id = 0;
		let [tx_] = (await db.query<{id:number}>(
			`select id from transaction_bin_${part} where txHash=${txHash}`));

		if ( !tx_ ) {
			let fromAddress = toBuffer(tx.from != addressZero ? tx.from: receipt.from); // check from address is zero
			let toAddress = toBuffer(tx.to || '0x0000000000000000000000000000000000000000');

			tx_id = await db.insert(`transaction_bin_${part}`, {
				nonce: Number(tx.nonce),
				fromAddress,
				toAddress,
				value: toBuffer(tx.value),
				gasPrice: toBuffer(tx.gasPrice),
				gas: toBuffer(tx.gas), // gas limit
				// data: tx.input,
				gasUsed: toBuffer(receipt.gasUsed),
				cumulativeGasUsed: toBuffer(receipt.cumulativeGasUsed),
				// effectiveGasPrice: '0x' + Number(receipt.effectiveGasPrice || tx.gasPrice).toString(16),
				blockNumber: toBuffer(receipt.blockNumber),
				blockHash: toBuffer(receipt.blockHash),
				transactionHash,
				transactionIndex: Number(receipt.transactionIndex),
				// logsBloom: receipt.logsBloom,
				contractAddress: receipt.contractAddress ? toBuffer(receipt.contractAddress): null,
				status: Number(receipt.status),
				logsCount: receipt.logs.length,
				txHash: txHash,
				fromHash: hash(fromAddress).value,
				toHash: hash(toAddress).value,
			});

		} else {
			tx_id = tx_.id;
		}

		if (receipt.contractAddress) { // New contract
			let address = cryptoTx.checksumAddress(receipt.contractAddress);
			let ci = await contract.select(address, chain, true);
			if (!ci)
				await contract.insert({address,blockNumber}, chain);
			//console.log(`Discover contract:`, ChainType[chain], blockNumber, address);
		}

		if (receipt.logs.length) { // event logs
			let sql: string[] = [];
			for (let log of receipt.logs) {
				let address = log.address;
				let logIndex = Number(log.logIndex);
				let topic = '0x' + (log.topics.length ? log.topics.map(e=>e.slice(2)).join(''): '0');
				let addressHash = hash(buffer.from(address.slice(2), 'hex'));

				//if (log.topics.length == 0)
				//	console.warn('#WatchBlock.solveReceipt topic is empty', log);

				if (log.data.length > 65535*2+2) {
					log.data = '0x' + buffer.from('rpc:fetch').toString('hex');
				}
				let data = log.data && log.data.length > 2 ? log.data: 'NULL';
				sql.push(
					`call insert_transaction_log_${part}(${tx_id},${address},${topic},${data},`+
						`${logIndex},${blockNumber},${addressHash.value},${addressHash.number});`
				);
			}
			await db.exec(sql.join('\n'));
		}
	}

	private async solveReceipts(blockNumber: number, receipt: TransactionReceipt[], tx: Transaction[]) {
		let chain = this.web3.chain;
		let [{db,part}] = await this.getDatabasePart([blockNumber]);
		let txHashBuf = receipt.map(e=>toBuffer(e.transactionHash));
		let txHashNum = txHashBuf.map(e=>hash(e).value);
		let txBin = await db.exec(txHashNum.map(e=>
			`select id from transaction_bin_${part} where txHash=${e}`
		).join(';'));

		let txData = receipt.map((e,j)=>{
			somes.assert(e, `#WatchBlock.watchReceipt, receipt: TransactionReceipt Can not be empty, blockNumber=${blockNumber}`);
			somes.assert(j == e.transactionIndex, '#WatchBlock.watchReceipt transaction index no match');
			let row = txBin[j].rows![0] as {id:number} | undefined;
			return {
				receipt: e,
				transactionHash: txHashBuf[j],
				txHash: txHashNum[j],
				tx: tx[j],
				id: row ? row.id: 0,
			};
		});

		let insertSql = txData.filter(e=>!e.id).map(({tx,receipt,txHash,transactionHash})=>{
			let fromAddress = toBuffer(tx.from != addressZero ? tx.from: receipt.from); // check from address is zero
			let toAddress = toBuffer(tx.to || '0x0000000000000000000000000000000000000000');
			return db.insertSql(`transaction_bin_${part}`, {
				nonce: Number(tx.nonce),
				fromAddress,
				toAddress,
				value: toBuffer(tx.value),
				gasPrice: toBuffer(tx.gasPrice),
				gas: toBuffer(tx.gas), // gas limit
				// data: tx.input,
				gasUsed: toBuffer(receipt.gasUsed),
				cumulativeGasUsed: toBuffer(receipt.cumulativeGasUsed),
				// effectiveGasPrice: '0x' + Number(receipt.effectiveGasPrice || tx.gasPrice).toString(16),
				blockNumber: toBuffer(receipt.blockNumber),
				blockHash: toBuffer(receipt.blockHash),
				transactionHash,
				transactionIndex: Number(receipt.transactionIndex),
				// logsBloom: receipt.logsBloom,
				contractAddress: receipt.contractAddress ? toBuffer(receipt.contractAddress): null,
				status: Number(receipt.status),
				logsCount: receipt.logs.length,
				txHash: txHash,
				fromHash: hash(fromAddress).value,
				toHash: hash(toAddress).value,
			});
		});

		if (insertSql.length) {
			let res = await db.exec(insertSql.join(';'));
			let res_i = 0;
			for (let d of txData) {
				if (!d.id) {
					d.id = Number(res[res_i++].insertId!) || 0;
				}
			}
		}

		let exec_sql: string[] = [];

		for (let {receipt, id} of txData) {
			if (receipt.contractAddress) { // New contract
				let address = cryptoTx.checksumAddress(receipt.contractAddress);
				let ci = await contract.select(address, chain, true);
				if (!ci)
					await contract.insert({address,blockNumber}, chain);
				//console.log(`Discover contract:`, ChainType[chain], blockNumber, address);
			}
			somes.assert(id, 'db tx id cannot be empty');

			if (receipt.logs.length) { // event logs
				for (let log of receipt.logs) {
					let address = log.address;
					let logIndex = Number(log.logIndex);
					let topic = '0x' + (log.topics.length ? log.topics.map(e=>e.slice(2)).join(''): '0');
					let addressHash = hash(buffer.from(address.slice(2), 'hex'));

					//if (log.topics.length == 0)
					//	console.warn('#WatchBlock.solveReceipt topic is empty', log);

					if (log.data.length > 65535*2+2) {
						log.data = '0x' + buffer.from('rpc:fetch').toString('hex');
					}
					let data = log.data && log.data.length > 2 ? log.data: 'NULL';
					exec_sql.push(
						`call insert_transaction_log_${part}(${id},${address},${topic},${data},`+
							`${logIndex},${blockNumber},${addressHash.value},${addressHash.number});`
					);
				}
			}
		}

		if (exec_sql.length) {
			await db.exec(exec_sql.join('\n'));
		}
	}

	private async solveBlock(blockNumber: number) {
		let time0 = Date.now();
		let web3 = this.web3;
		let chain = web3.chain;
		let block = await web3.eth.getBlock(blockNumber, true);
		let txs = block.transactions;
		let idx = 0;

		if (txs.length == 0) {
			console.log(`Watch Block:`, ChainType[chain], 'blockNumber', blockNumber, 'receipts', 0, 'logs', 0);
			return;
		}

		if (await web3.hasSupportGetTransactionReceiptsByBlock()) {
			let receipts: TransactionReceipt[] | undefined;
			try {
				receipts = await web3.getTransactionReceiptsByBlock(blockNumber);
			} catch(err: any) {
				console.warn(`#WatchBlock._watchReceipt`, chain, err);
			}

			if (receipts) {
				let time = Date.now();

				await this.solveReceipts(blockNumber, receipts, txs);

				console.log(`Watch Block:`, ChainType[chain], 'blockNumber', blockNumber, 
					'receipts', receipts.length, 'logs', receipts.reduce((p,n)=>p+n.logs.length, 0),
					'time', time - time0, Date.now() - time
				);

				// for (let item of receipts) {
					// let _idx = idx++;
					// await this.solveReceipt(blockNumber, item, _idx, txs[_idx]);
				// }
				return;
			}
		}

		// ----------------------- Compatibility Mode -----------------------

		let logs = await web3.eth.getPastLogs({
			toBlock: blockNumber,
			fromBlock: blockNumber,
		});
		let receipts: TransactionReceipt[] = [];

		for (let tx of txs) {
			let idx = receipts.length;
			somes.assert(tx.transactionIndex === idx, '#WatchBlock.solveBlock transactionIndex !== idx');
			somes.assert(tx.blockHash !== null, '#WatchBlock.solveBlock blockHash !== null');
			somes.assert(tx.blockNumber == blockNumber, '#WatchBlock.solveBlock blockNumber == blockNumber');

			let contractAddress: string | undefined;
			if (!tx.to) {
				let r = await web3.eth.getTransactionReceipt(tx.hash);
				if (!r) {
					r = await web3.eth.getTransactionReceipt(tx.hash); // retry
				}
				contractAddress = r.contractAddress;
			}

			receipts[idx] = {
				status: true,
				transactionHash: tx.hash,
				transactionIndex: tx.transactionIndex!,
				blockHash: tx.blockHash!,
				blockNumber: tx.blockNumber!,
				from: tx.from,
				to: tx.to || '0x0000000000000000000000000000000000000000',
				contractAddress,
				cumulativeGasUsed: 0,
				gasUsed: 0,
				effectiveGasPrice: 0,
				logs: logs.filter(e=>e.transactionHash==tx.hash),
				logsBloom: '0x',
			};
		}

		let time = Date.now();

		await this.solveReceipts(blockNumber, receipts, txs);

		//for (let receipt of receipts) {
		//	await this.solveReceipt(blockNumber, receipt, receipt.transactionIndex, txs[receipt.transactionIndex]);
		//}

		// for (let txHash of block.transactions) {
		// 	let _idx = idx++;
		// 	let receipt = await web3.eth.getTransactionReceipt(txHash);
		// 	await this.solveReceipt(blockNumber, receipt, _idx, ()=>getTransaction(_idx));
		// }

		console.log(`Watch Block:`, ChainType[chain], 'blockNumber', blockNumber,
			'receipts', txs.length, 'logs', logs.length, 'time', time - time0, Date.now() - time
		);
	}

	async getBlockSyncHeight(worker = 0) {
		if (this.use_shs_rpc)
			return (await api.get('chain/getBlockSyncHeight', {chain: this.web3.chain,worker})).data;

		let key = `Block_Sync_Height_${ChainType[this.web3.chain]}`;
		let num = await this.redis.client.hGet(key, `worker_${worker}`);
		if (!num)
			num = await this.storage.get(`${key}_${worker}`);
		return (num || 0) as number;
	}

	async getValidBlockSyncHeight() {
		let chain = this.web3.chain;
		if (this.use_shs_rpc) {
			let data = await api.get<number>('chain/getValidBlockSyncHeight', {chain});
			return data.data;
		}

		let workers = await this.getWatchBlockWorkers();
		let key = `Block_Sync_Height_${ChainType[chain]}`;
		let heightAll = await this.redis.client.hGetAll(key);

		if (!heightAll || !Array.from({length:workers}).every((_,j)=>heightAll[`worker_${j}`])) {
			// read block height for mysql db
			heightAll = {};
			let key = `Block_Sync_Height_${ChainType[chain]}`;
			let ls = await this._db.query<{kkey:string, value: any}>(
				`select * from storage where kkey like '${key}%'`);
			for (let it of ls) {
				heightAll['worker' + it.kkey.substring(key.length)] = it.value;
			}
		}

		let [height, ...heights] = Array.from({length:workers})
				.map((_,i)=>(Number(heightAll[`worker_${i}`]) || 0))
				.sort((a,b)=>a-b);

		for (let i = 0; i < heights.length; i++) {
			if (height + 1 != heights[i])
				break;
			height++;
		}
		return height;
	}

	async getTransactionLogsFrom<T extends {state: number,address: string}>(
		startBlockNumber: number, endBlockNumber: number, info: T[]
	) {
		type Log = TransactionLog & {tx:ITransaction};
		let chain = this.web3.chain;
		let logsAll = {
			info,
			blocks: [] as {
				blockNumber: number,
				logs: {
					idx: number, // index for info
					// address: string, // info address
					logs: Log[],
				}[],
			}[],
		};

		if (this.use_shs_rpc) {
			let r = await api.post<typeof logsAll>('chain/getTransactionLogsFrom', {
				chain, startBlockNumber, endBlockNumber, info: info.map(e=>({state: e.state,address:e.address}))
			}, {logs: cfg.moreLog, gzip: true});
			r.data.info = info;
			return r.data;
		}

		// -------------------------------------------------------------------

		let parts = await this.getDatabasePart([startBlockNumber, endBlockNumber+1]);

		let addressSet: Dict = {};
		let where = info.filter(e=>e.state==0).map(e=>{
			let buffer = toBuffer(e.address);
			e.address = '0x' + buffer.toString('hex');
			addressSet[e.address] = 1;
			let {value,number} = hash(buffer);
			return `addressNumber=${number} and addressHash=${value}`;
		});

		let all = await Promise.all(parts.map(({db,part})=>{
			let sql = `select * from transaction_log_bin_${part} where (${where.join(' or ')})
				and blockNumber>=${escape(startBlockNumber)} and blockNumber<=${escape(endBlockNumber)}
			`;
			let logs = db.query<Log>(sql);
			return logs;
		}));

		let logs = all.reduce((a,b)=>(a.push(...b),a), []).sort((a,b)=>a.blockNumber-b.blockNumber);
		let txs: Dict<ITransaction> = {};

		if (logs.length) {
			for (let tx of await this.getTransactions(logs.map(e=>({id:e.tx_id,blockNumber: e.blockNumber}))))
				txs[tx.id] = tx;
		}

		// if (chain == ChainType.ARBITRUM_GOERLI && startBlockNumber <= 22982999 && 22982999 <= endBlockNumber)
		// 	debugger

		// -------------------------------------------------------------------

		let b_logs = [] as {blockNumber: number, logs: Log[]}[];

		for (let log of logs) {
			let tx = txs[log.tx_id];
			somes.assert(tx, '#WatchBlock.getTransactionLogsFrom() tx is null');
			log.tx = tx;
			log = formatTransactionLog(log, tx) as Log;
			
			if (addressSet[log.address]) {
				let {blockNumber} = log;
				let b_log = b_logs.indexReverse(0);
				if (b_log) {
					if (b_log.blockNumber == blockNumber) {
						b_log.logs.push(log);
					} else {
						somes.assert(b_log.blockNumber < blockNumber,
							'#WatchBlock.getTransactionLogsFrom blockNumber order error');
							b_logs.push({blockNumber, logs: [log]});
					}
				} else {
					b_logs[0] = {blockNumber, logs: [log]};
				}
			}
		} // for (let log of logs)

		for (let {blockNumber,logs} of b_logs) { // each block
			let block = { blockNumber, logs: [] } as typeof logsAll.blocks[0];
			let logsDict: Dict<Log[]> = {}; // address => log[]

			for (let log of logs) {
				let logs = logsDict[log.address];
				if (!logs)
					logsDict[log.address] = logs = [];
				logs.push(log); // address => log[]
			}

			info.forEach((e,idx)=>{
				let logs = logsDict[e.address];
				if (logs) {
					let logsSet = new Set();
					logs = logs.filter(e=>logsSet.has(e.logIndex) ? 0: logsSet.add(e.logIndex)); // exclude duplicates
					logs = logs.sort((a,b)=>a.logIndex-b.logIndex); // sort
					block.logs.push({ idx, logs });
				}
			});

			logsAll.blocks.push(block);
		}

		return logsAll;
	}

	async getTransaction(transactionHash: string, blockNumber: number): Promise<ITransaction | null> {
		if (this.use_shs_rpc) {
			return (await api.get<ITransaction>('chain/getTransaction', {
				chain: this.web3.chain, txHash: transactionHash,
			}, {logs: cfg.moreLog, gzip: true})).data;
		}
		let txHash = hash(toBuffer(transactionHash)).value;
		let parts = await this.getDatabasePart([blockNumber]);

		let all = await Promise.all(parts.map(({part,db})=>db.select<ITransaction>(
			`transaction_bin_${part}`, { txHash }, {limit: 3})
		));
		let tx = all.reduce((a,b)=>(a.push(...b),a),[]);
		let txOne = tx.map(e=>formatTransaction(e)).find(e=>e.transactionHash==transactionHash);

		return txOne || null;
	}

	async getTransactions(IDs: {id: number, blockNumber:number}[]) {
		if (this.use_shs_rpc) {
			return (await api.get<ITransaction[]>('chain/getTransactions', {
				chain: this.web3.chain, ids: IDs
			}, {logs: cfg.moreLog, gzip: true})).data;
		}

		if (IDs.length) {
			let parts = await this.getDatabasePart(IDs.map(e=>e.blockNumber), IDs.map(e=>e.id));

			let tx = await Promise.all(parts.map(({db,part,data:ids})=>db.select(
				`transaction_bin_${part}`, `id in (${ids.map(e=>escape(e))})`)
			));

			return tx.map(e=>e.map(e=>formatTransaction(e))).reduce((a,b)=>(a.push(...b),a), []);
		} else {
			return [];
		}
	}

	private async saveBlockSyncHeight(blockNumber: number, worker = 0) {
		let key = `Block_Sync_Height_${ChainType[this.web3.chain]}`;
		await this.storage.set(`${key}_${worker}`, blockNumber);
		await this.redis.client.hSet(key, `worker_${worker}`, blockNumber);
	}

	private async getWatchBlockWorkers() {
		let chain: ChainType = this.web3.chain;
		let key = `Block_Sync_Workers_${ChainType[chain]}`;
		let cache = this._watchBlockWorkersCaches[chain] || {value:0,timeout: 0};

		if (cache.timeout < Date.now()) {
			let workers = (await this.redis.get<number>(key))!;
			if (!workers)
				workers = await this.storage.get(key) || 1;
			this._watchBlockWorkersCaches[chain] = {
				value: workers, timeout: Date.now() + 1e4, // 10 second
			};
			return workers;
		} else {
			return cache.value;
		}
	}

	private async saveBlockSyncWorkers() {
		let key = `Block_Sync_Workers_${ChainType[this.web3.chain]}`;
		await this.storage.set(key, this.workers);
		await this.redis.set(key, this.workers);
	}

	async cat() {
		if (!env.watch_main)
			return true;

		// await this._Test();
		await this.saveBlockSyncWorkers();

		let web3 = this.web3;
		let chain = web3.chain;
		let key = (worker: number)=> `Block_Sync_Height_${ChainType[chain]}_${worker}`;

		let blockNumber = await this.storage.get<number>(key(this.worker)) || 0;
		if (blockNumber == 0) {
			for (let i = 0; i < this.workers; i++) {
				let num = await this.storage.get<number>(key(i));
				if (num) {
					blockNumber = blockNumber ? Math.min(blockNumber, num): num;
				}
			}
		}

		if (blockNumber == 0) { // blockNumber == 0
			if (!cfg.block_full_sync) {
				let info = deployInfo[ChainType[chain].toLowerCase() as 'goerli'];
				if (info)
					blockNumber = info.DAOsProxy.blockNumber;
				else
					return true; // cancel
			}
		}

		try {
			let blockNumberCur = await web3.getBlockNumber();

			while (++blockNumber <= blockNumberCur) {
				if (blockNumber % this.workers === this.worker) {
					await this.solveBlock(blockNumber);
					await this.saveBlockSyncHeight(blockNumber, this.worker); // complete save
					postWatchBlock(this.worker, blockNumber, web3.chain);
				}
			}
		} catch (err: any) {
			if (isRpcLimitRequestAccount(web3, err)) {
				web3.swatchRpc();
			}
			console.error(`#WatchBlock.cat chain=${this.web3.chain}`, ...err.filter(['message', 'description', 'stack']));
		}

		return true;
	}
}
