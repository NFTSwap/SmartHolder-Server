/**
 * @copyright © 2021 Copyright ccl
 * @date 2022-07-20
 */

import {ContractScaner,formatHex,blockTimeStamp} from './scaner';
import {EventData} from 'web3-tx';
import db, {LedgerType,LedgerReleaseLog} from '../db';

export class Ledger extends ContractScaner {
	events = {

		// event Receive(address indexed from, uint256 balance);
		// event ReleaseLog(address indexed operator, uint256 balance, string log);
		// event Deposit(address indexed from, uint256 balance, string name, string describe);
		// event Withdraw(address indexed target, uint256 balance, string describe);
		// event Release(uint256 indexed member, address indexed to, uint256 balance);

		Receive: {
			use: async (e: EventData)=>{
				let {from,balance} = e.returnValues;
				let txHash = e.transactionHash;
				let type = LedgerType.Receive;

				// id           int primary key auto_increment,
				// host         varchar (64)                 not null, -- dao host
				// address      varchar (64)                 not null, -- 合约地址
				// txHash       varchar (72)                 not null, -- tx hash
				// type         int             default (0)  not null, -- 0保留,1进账-无名接收存入,2进账-存入,3出账-取出,4出账-成员分成
				// name         varchar (64)    default ('') not null, -- 转账名目
				// describe     varchar (1024)  default ('') not null, -- 详细
				// target       varchar (64)                 not null, -- 转账目标,进账为打款人,出账为接收人
				// member_id    varchar (72)    default ('') not null, -- 成员出账id,如果为成员分成才会存在
				// balance      varchar (72)                 not null, -- 金额
				// time         bigint                       not null, -- 时间
				// blockNumber  int                          not null  -- 区块

				if ( ! await db.selectOne(`ledger_${this.chain}`, { address: this.address, txHash, type, member_id: ''}) ) {
					await db.insert(`ledger_${this.chain}`, {
						host: await this.host(),
						address: this.address,
						txHash: txHash,
						type: type,
						target: from,
						balance: formatHex(balance),
						time: await blockTimeStamp(this.web3, e.blockNumber),
						blockNumber: e.blockNumber,
					});
				}
			},
		},

		ReleaseLog: {
			use: async (e: EventData)=>{
				let {operator,balance,log} = e.returnValues;
				let txHash = e.transactionHash;

				// id           int primary key auto_increment,
				// address      varchar (64)                 not null, -- 合约地址
				// operator     varchar (64)                 not null,
				// txHash       varchar (72)                 not null, -- tx hash
				// log          varchar (1024)               not null,
				// time         bigint                       not null,
				// blockNumber  int                          not null

				if ( ! await db.selectOne(`ledger_release_log_${this.chain}`, { address: this.address, txHash }) ) {
					await db.insert(`ledger_release_log_${this.chain}`, {
						address: this.address,
						operator,
						balance: formatHex(balance),
						log,
						time: await blockTimeStamp(this.web3, e.blockNumber),
						blockNumber: e.blockNumber,
					});
					await db.update(`ledger_${this.chain}`, { describe: log }, { address: this.address, txHash, });
				}
			},
		},

		Deposit: {
			use: async (e: EventData)=>{
				let {from,balance,name,describe} = e.returnValues;
				let txHash = e.transactionHash;
				let type = LedgerType.Deposit;
				if ( ! await db.selectOne(`ledger_${this.chain}`, { address: this.address, txHash, type, member_id: ''}) ) {
					await db.insert(`ledger_${this.chain}`, {
						host: await this.host(),
						address: this.address,
						txHash: txHash,
						type: type,
						target: from,
						balance: formatHex(balance),
						name: name,
						describe: describe,
						time: await blockTimeStamp(this.web3, e.blockNumber),
						blockNumber: e.blockNumber,
					});
				}
			},
		},
		
		Withdraw: {
			use: async (e: EventData)=>{
				let {target,balance,describe} = e.returnValues;
				let txHash = e.transactionHash;
				let type = LedgerType.Withdraw;
				if ( ! await db.selectOne(`ledger_${this.chain}`, { address: this.address, txHash, type, member_id: ''}) ) {
					await db.insert(`ledger_${this.chain}`, {
						host: await this.host(),
						address: this.address,
						txHash: txHash,
						type: type,
						balance: formatHex(balance),
						target: target,
						describe: describe,
						time: await blockTimeStamp(this.web3, e.blockNumber),
						blockNumber: e.blockNumber,
					});
				}
			},
		},

		Release: {
			use: async (e: EventData)=>{
				let {member,to,balance} = e.returnValues;
				let txHash = e.transactionHash;
				let type = LedgerType.Release;
				if ( ! await db.selectOne(`ledger_${this.chain}`, { address: this.address, txHash, type, member_id: member}) ) {
					let log = await db.selectOne<LedgerReleaseLog>(`ledger_release_log_${this.chain}`, { address: this.address, txHash });

					await db.insert(`ledger_${this.chain}`, {
						host: await this.host(),
						address: this.address,
						txHash: txHash,
						type: type,
						target: to,
						balance: formatHex(balance),
						describe: log?.log || '',
						member_id: member,
						time: await blockTimeStamp(this.web3, e.blockNumber),
						blockNumber: e.blockNumber,
					});
				}
			},
		},
	};

}
