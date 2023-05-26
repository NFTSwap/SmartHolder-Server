/**
 * @copyright © 2021 Copyright ccl
 * @date 2022-07-20
 */

import {LedgerType,LedgerReleaseLog,ContractType,SaleType,LedgerBalance,ChainType,chainTraits} from '../../db';
import {formatHex,numberStr,HandleEventData} from '.';
import {ModuleScaner} from './index';
import {getAbiByType} from '../../web3+';

const addressZero = '0x0000000000000000000000000000000000000000';

export class Ledger extends ModuleScaner {
	events = {
		// event Receive(address indexed from, uint256 amount);
		// event Deposit(address indexed from, uint256 amount, string name, string description);
		// event Withdraw(address indexed erc20, address indexed target, uint256 amount, string description);
		// event Release(uint256 indexed member, address indexed to, address indexed erc20, uint256 amount);
		// event ReleaseLog(address indexed operator, address indexed erc20, uint256 amount, string log);

		Change: {
			handle: (data: HandleEventData)=>this.onChange(data),
		},
		Receive: {
			handle: async ({event:e,blockTime: time,blockNumber}: HandleEventData)=>{
				let db = this.db;
				let {from,amount} = e.returnValues;
				let txHash = e.transactionHash;
				let type = LedgerType.Receive;

				if ( await db.selectCount(`ledger_${this.chain}`, { address: this.address, txHash, type, member_id: ''}) )
					return;

				let balance = await this.addLedgerBalanceAmount(addressZero, amount);

				// id           int primary key auto_increment,
				// host         varchar (42)                 not null, -- dao host
				// address      varchar (42)                 not null, -- 合约地址
				// txHash       varchar (66)                 not null, -- tx hash
				// type         int             default (0)  not null, -- 0保留,1进账-无名接收存入,2进账-存入,3出账-取出,4出账-成员分成,5进账-资产销售收入
				// name         varchar (42)    default ('') not null, -- 转账名目
				// description  varchar (1024)  default ('') not null, -- 详细
				// target       varchar (42)                 not null, -- 转账目标:进账为打款人,出账为接收人,资产销售收进账时为store地址,如opensea store
				// ref          varchar (42)                 not null, -- 关联地址:资产销售收进账fromAddress,出账为接收人
				// member_id    varchar (66)    default ('') not null, -- 成员出账id,如果为成员分成才会存在
				// amount       varchar (78)                 not null, -- 金额 for eth
				// time         bigint                       not null, -- 时间
				// blockNumber  int                          not null, -- 区块
				// state        int             default (0)  not null,
				// erc20        varchar (42)                 not null  -- erc20 token address

				await db.insert(`ledger_${this.chain}`, {
					host: await this.host(),
					address: this.address,
					txHash: txHash,
					type: type,
					ref: from,
					target: from,
					amount: numberStr(amount),
					time: time,
					blockNumber: blockNumber,
					erc20: addressZero,
					symbol: balance.symbol,
				});
			},
		},

		Release: {
			handle: async ({event:e,blockTime: time}: HandleEventData)=>{
				let db = this.db;
				let {member,to,amount,erc20} = e.returnValues;
				let txHash = e.transactionHash;
				let type = LedgerType.Release;
				let member_id = formatHex(member);

				if ( await db.selectCount(`ledger_${this.chain}`, { address: this.address, txHash, type, member_id}) )
					return;

				let log = await db.selectOne<LedgerReleaseLog>(`ledger_release_log_${this.chain}`, { address: this.address, txHash });

				await db.insert(`ledger_${this.chain}`, {
					host: await this.host(),
					address: this.address,
					txHash: txHash,
					type: type,
					ref: to,
					target: to,
					amount: numberStr(amount),
					description: log? log.log: '',
					member_id,
					time,
					blockNumber: Number(e.blockNumber) || 0,
					erc20,
					symbol: log? log.symbol: '',
				});
			},
		},

		ReleaseLog: {
			handle: async ({event:e,blockTime: time}: HandleEventData)=>{
				let db = this.db;
				let {operator,amount,log,erc20} = e.returnValues;
				let txHash = e.transactionHash;

				if ( await db.selectCount(`ledger_release_log_${this.chain}`, { address: this.address, txHash }) )
					return;
				
				let balance = await this.addLedgerBalanceAmount(erc20, -BigInt(amount));

				// id           int primary key auto_increment,
				// address      varchar (64)                 not null, -- 合约地址
				// operator     varchar (64)                 not null,
				// txHash       varchar (72)                 not null, -- tx hash
				// log          varchar (1024)               not null,
				// time         bigint                       not null,
				// erc20        varchar (42)                 not null,
				// blockNumber  int                          not null

				let symbol = balance.symbol;

				await db.insert(`ledger_release_log_${this.chain}`, {
					address: this.address,
					operator,
					amount: numberStr(amount),
					log,
					time,
					blockNumber: Number(e.blockNumber) || 0,
					txHash,
					erc20,
					symbol,
				});

				await db.update(`ledger_${this.chain}`, { description: log, symbol }, { address: this.address, txHash, });
			},
		},

		Deposit: {
			handle: async ({event:e,blockTime: time,blockNumber}: HandleEventData)=>{
				let db = this.db;
				let {from,amount,name,description} = e.returnValues;
				let txHash = e.transactionHash;
				let type = LedgerType.Deposit;

				if ( await db.selectCount(`ledger_${this.chain}`, { address: this.address, txHash, type, member_id: ''}) ) 
					return;

				let balance = await this.addLedgerBalanceAmount(addressZero, BigInt(amount));

				await db.insert(`ledger_${this.chain}`, {
					host: await this.host(),
					address: this.address,
					txHash: txHash,
					type: type,
					target: from,
					ref: from,
					amount: numberStr(amount),
					name: name,
					description: description,
					time,
					blockNumber: blockNumber,
					erc20: addressZero,
					symbol: balance.symbol,
				});
			},
		},

		Withdraw: {
			handle: async ({event:e,blockTime: time,blockNumber}: HandleEventData)=>{
				let db = this.db;
				let {erc20,target,amount,description} = e.returnValues;
				let txHash = e.transactionHash;
				let type = LedgerType.Withdraw;

				if ( await db.selectCount(`ledger_${this.chain}`, { address: this.address, txHash, type, member_id: ''}) ) 
					return;

				let balance = await this.addLedgerBalanceAmount(erc20, -BigInt(amount));

				await db.insert(`ledger_${this.chain}`, {
					host: await this.host(),
					address: this.address,
					txHash: txHash,
					type: type,
					amount: numberStr(amount),
					ref: target,
					target: target,
					description: description,
					time: time,
					blockNumber: blockNumber,
					erc20: erc20,
					symbol: balance.symbol,
				});

			},
		},

	};

	async addAssetIncome(e: {
		host: string, saleType: SaleType, blockNumber: number,
		token: string, tokenId: string, source: string, erc20: string,
		from: string, to: string, amount: string, price: bigint, count: string, txHash: string
	}) {
		let db = this.db;
		let {token,source,from,to,saleType,erc20} = e;
		let txHash = e.txHash;
		let type = LedgerType.AssetIncome;

		if ( await db.selectCount(`ledger_${this.chain}`, { address: this.address, txHash, type, member_id: ''}) )
			return;

		let blockNumber = Number(e.blockNumber) || 0;
		let amount = numberStr(e.amount);
		let price = numberStr(e.price);
		let count = numberStr(e.count);
		let host = await this.host();
		let time = Date.now();

		let balance = await this.addLedgerBalanceAmount(erc20, BigInt(amount));

		let id = await db.insert(`ledger_${this.chain}`, {
			host,
			address: this.address,
			txHash: txHash,
			type: type,
			ref: from,
			target: source,
			amount,
			name: '',
			description: '',
			time,
			blockNumber,
			erc20,
			symbol: balance.symbol,
		});

		let tokenId = formatHex(e.tokenId);
		let asset = await db.selectOne(`asset_${this.chain}`, {token, tokenId});
		if (!asset)
			console.warn(`#Ledger.addAssetIncome asset asset ${token},${tokenId} a not found`);

		await db.insert(`ledger_asset_income_${this.chain}`, {
			id,
			host,
			asset_id: asset ? asset.id: 0,
			token, tokenId,
			source,
			amount,
			price,
			fromAddress: from,
			toAddress: to,
			count,
			saleType,
			blockNumber,
			time,
			erc20,
			symbol: balance.symbol,
		});
	}

	async addLedgerBalanceAmount(erc20: string, amount: bigint) {
		// create table if not exists ledger_balance_${chain} ( -- 财务记录余额汇总 balance total 
		// 	id           int primary key auto_increment,
		// 	host         varchar (42)                 not null, -- dao host
		// 	erc20        varchar (42)                 not null, -- erc20 token address
		// 	value        varchar (78)   default ('0') not null, -- 余额
		// 	income       varchar (78)   default ('0') not null, -- 正向收益
		// 	expenditure  varchar (78)   default ('0') not null, -- 反向支出
		// 	items        int            default (0)   not null, -- 流通次数
		// 	symbol       varchar (32)                 not null, -- erc20 symbol
		// 	name         varchar (32)                 not null, -- erc20 name
		// 	time         bigint                       not null  -- 更新时间
		// );

		let time = Date.now();
		let host = await this.host();
		let summary = (await this.db.selectOne<LedgerBalance>(`ledger_balance_${this.chain}`, {host,erc20}))!;
		if (!summary) {
			let symbol = chainTraits[ChainType[this.chain]][2], name = ChainType[this.chain];
			if (erc20 != addressZero) {
				let abi = (await getAbiByType(ContractType.ERC20))!;
				let c = this.web3.createContract(erc20, abi.abi);
				symbol = await this.web3.tryCall(c, 'symbol') || '';
				name = await this.web3.tryCall(c, 'name') || symbol || '';
			}
			let id = await this.db.insert(`ledger_balance_${this.chain}`, {host,erc20,name,symbol,time});
			summary = (await this.db.selectOne(`ledger_balance_${this.chain}`, {id}))!;
		}
		let row: Dict = {time,value: BigInt(summary.value) + BigInt(amount) + '', items: summary.items+1};
		if (amount < BigInt(0)) { // pay
			row.expenditure = BigInt(summary.expenditure) - BigInt(amount) + '';
		} else { // income
			row.income = BigInt(summary.income) + BigInt(amount) + '';
		}
		await this.db.update(`ledger_balance_${this.chain}`, row, {id: summary.id});

		return { ...summary, ...row } as LedgerBalance;
	}

	protected async onDescription({blockTime: modify}: HandleEventData, desc: string) {
		//await db.update(`dao_${this.chain}`, { description: desc, modify }, { address: this.address });
	}

	protected async onOperator({blockTime:modify}: HandleEventData, addr: string) {
		//await db.update(`dao_${this.chain}`, { operator: addr, modify }, { address: this.address });
	}

	protected async onUpgrade(data: HandleEventData, addr: string) {
		// noop
	}

}
