/**
 * @copyright © 2022 Smart Holder Server
 * @date 2022-07-21
 */

import somes from 'somes';
import {Task} from './task';
import {Tasks} from './models/def';
import {ChainType} from './models/def';
import {txApi} from './request';
import getWeb3, {MvpWeb3} from './web3+';
import {PostResult} from 'bclib/web3_tx';
import * as cfg from '../config';
import db, {storage, ContractType,SaleType} from './db';
import errno from './errno';
import {escape} from 'somes/db';
import {scopeLock} from 'bclib/atomic_lock';
import {getContractInfo, insert as insertC, update as updateC} from './models/contract';
// abis
import * as ContextProxyDAO from '../abi/ContextProxyDAO.json';
import * as ContextProxyAsset from '../abi/ContextProxyAsset.json';
import * as ContextProxyAssetShell from '../abi/ContextProxyAssetShell.json';
import * as ContextProxyLedger from '../abi/ContextProxyLedger.json';
import * as ContextProxyMember from '../abi/ContextProxyMember.json';
import * as ContextProxyVotePool from '../abi/ContextProxyVotePool.json';

// make new dao tasks

export interface MakeMemberArgs {
	id: string;
	owner: string;
	votes: number;
	name: string;
	description: string;
	avatar: string;
}

export interface MakeDaoArgs {
	name: string;
	mission: string;
	description: string;
	operator: string;
	chain: ChainType;
	members?: MakeMemberArgs[];
	assetIssuanceTax?: number; // 资产发行税
	assetCirculationTax?: number; // 资产流转税
	defaultVotePassRate?: number; // 投票通过率不小于 50%，默认50%=0.5
	defaultVoteTime?: number; // 默认投票时间
	memberBaseName?: string; // 成员base名称
	memberTotalLimit?: number; // 成员总量限制
}

// require(proposal.voteRate > 5000, "#VotePool#create proposal vote rate not less than 50%");
// require(proposal.passRate > 5000, "#VotePool#create proposal vote rate not less than 50%");

export class MakeDAO extends Task<MakeDaoArgs> {

	constructor(tasks: Tasks<MakeDaoArgs>) {
		super(tasks);
	}

	private async deploy(web3: MvpWeb3, impl: string, from: string, abi: {bytecode: string, abi: any}, flags: string) {
		let addr = '0x0000000000000000000000000000000000000000';
		let id = this.tasks.id;
		let {data:review} = await txApi.post<string>('tx/send', {
			chain: web3.chain,
			tx: {
				from: from,
				data: web3.createContract(addr, abi.abi).deploy({
					data: abi.bytecode,
					arguments: [impl],
				}).encodeABI(),
			},
			callback: `${cfg.publicURL}/service-api/tasks/makeDAO_Next__?taskId=${id}&flags=${flags}`,
		});
		await storage.set(`MakeDAO_${this.id}_review_${flags}`, review);
	}

	private async callContract(web3: MvpWeb3, address: string, from: string, data: string, flags: string) {
		let {data:review} = await txApi.post<string>('tx/send', {
			chain: web3.chain,
			tx: { from, to: address, data },
			callback: `${cfg.publicURL}/service-api/tasks/makeDAO_Next__?taskId=${this.id}&flags=${flags}`,
		});
		await storage.set(`MakeDAO_${this.id}_review_${flags}`, review);
	}

	private async getStorageAddr() {
		return {
			DAO: await storage.get(`MakeDAO_${this.id}_address_DAO`) as string,
			Asset: await storage.get(`MakeDAO_${this.id}_address_Asset`) as string,
			openseaFirst: await storage.get(`MakeDAO_${this.id}_address_AssetShell.openseaFirst`) as string,
			openseaSecond: await storage.get(`MakeDAO_${this.id}_address_AssetShell.openseaSecond`) as string,
			Ledger: await storage.get(`MakeDAO_${this.id}_address_Ledger`) as string,
			Member: await storage.get(`MakeDAO_${this.id}_address_Member`) as string,
			VotePool: await storage.get(`MakeDAO_${this.id}_address_VotePool`) as string,
		};
	}

	private async getAccount(part_key: string, opts: {isSave: boolean, accounts: Dict<string>}) {
		let acc = opts.accounts[part_key];
		if (!acc) {
			let {data} = await txApi.post('keys/genSecretKeyFromPartKey', {part_key});
			opts.isSave = true;
			opts.accounts[part_key] = acc = data;
		}
		return acc;
	}

	private async getAccounts() {
		let opts = {
			isSave: false,
			accounts: await storage.get<Dict<string>>('keys_genSecretKeyFromPartKey_getAccounts') || {},
		};
		let a1 = await this.getAccount('test', opts);
		let a2 = await this.getAccount('a2', opts);
		let a3 = await this.getAccount('a3', opts);
		let a4 = await this.getAccount('a4', opts);
		let a5 = await this.getAccount('a5', opts);
		let a6 = await this.getAccount('a6', opts);
		let a7 = await this.getAccount('a7', opts);
		if (opts.isSave) {
			await storage.set('keys_genSecretKeyFromPartKey_getAccounts', opts.accounts);
		}
		return { a1,a2,a3,a4,a5,a6,a7 };
	}

	exec(args: MakeDaoArgs) {
		type Result = PostResult & { taskId: string, flags: string };
		let web3 = getWeb3(args.chain);

		// deploy
		this.step(async ()=>{
			let acc = await this.getAccounts();
			let impls = (cfg.contractImpls as Dict)[ChainType[web3.chain]];
			await this.deploy(web3, impls.DAO, acc.a1, ContextProxyDAO, 'DAO');
			await this.deploy(web3, impls.Asset, acc.a2, ContextProxyAsset, 'Asset');
			await this.deploy(web3, impls.AssetShell, acc.a3, ContextProxyAssetShell, 'AssetShell.openseaFirst');
			await this.deploy(web3, impls.AssetShell, acc.a4, ContextProxyAssetShell, 'AssetShell.openseaSecond');
			await this.deploy(web3, impls.Ledger, acc.a5, ContextProxyLedger, 'Ledger');
			await this.deploy(web3, impls.Member, acc.a6, ContextProxyMember, 'Member');
			await this.deploy(web3, impls.VotePool, acc.a7, ContextProxyVotePool, 'VotePool');
		}, (result: Result)=>scopeLock(`tasks_${this.id}`, async ()=>{ // 使用分布式原子锁
			if (result.error) return Error.new(result.error);
			let time = Date.now();
			let blockNumber = result.receipt!.blockNumber;
			let address = result.receipt!.contractAddress!;
			let [flags] = result.flags.split('.');
			let type = ContractType[flags as any] as any as ContractType;

			await storage.set(`MakeDAO_${this.id}_address_${result.flags}`, result.receipt!.contractAddress);
			if (! await getContractInfo(address, web3.chain)) {
				await insertC({ address, type, blockNumber, time }, web3.chain);
			}

			for (let i of [
				'DAO', 'Asset',
				'AssetShell.openseaFirst',
				'AssetShell.openseaSecond', 'Ledger', 'Member', 'VotePool'
			]) {
				let addr = await storage.get(`MakeDAO_${this.id}_address_${i}`);
				if (!addr) return;
			}
			let host = await storage.get(`MakeDAO_${this.id}_address_DAO`);

			// update host
			for (let i of [
				'DAO', 'Asset',
				'AssetShell.openseaFirst',
				'AssetShell.openseaSecond', 'Ledger', 'Member', 'VotePool'
			]) {
				let addr = await storage.get(`MakeDAO_${this.id}_address_${i}`);
				await updateC({host}, addr, web3.chain);
			}

			return true;
		}));

		// Init
		this.step(async()=>{
			let acc = await this.getAccounts();
			let {DAO,Asset,openseaFirst,openseaSecond,Ledger,Member,VotePool} = await this.getStorageAddr();
			let operator = '0x0000000000000000000000000000000000000000';
			let days7 = 7 * 24 * 3600;

			await this.callContract(web3, DAO, acc.a1, 
				(await web3.contract(DAO)).methods.initInterfaceID().encodeABI(), 'Init_DAO_InterfaceID');

			await this.callContract(web3, Asset, acc.a2, (await web3.contract(Asset))
				.methods.initAsset(
					DAO, '', operator, 
					`${cfg.publicURL}/service-api/utils/getOpenseaContractJSON?\
host=${DAO}&chain=${args.chain}&address=${Ledger}`
				).encodeABI(), 'Init_Asset');

			await this.callContract(web3, openseaFirst, acc.a3, (await web3.contract(openseaFirst))
				.methods.initAssetShell(
					DAO, '', operator, 
					`${cfg.publicURL}/service-api/utils/getOpenseaContractJSON?\
host=${DAO}&chain=${args.chain}&address=${openseaFirst}&first=1`, SaleType.kOpenseaFirst // kOpenseaFirst
				).encodeABI(),
			'Init_AssetShell.openseaFirst');

			await this.callContract(web3, openseaSecond, acc.a4, (await web3.contract(openseaSecond))
				.methods.initAssetShell(
					DAO, '', operator, 
					`${cfg.publicURL}/service-api/utils/getOpenseaContractJSON?\
host=${DAO}&chain=${args.chain}&address=${openseaSecond}`, SaleType.kOpenseaSecond // kOpenseaSecond
				).encodeABI(),
			'Init_AssetShell.openseaSecond');

			await this.callContract(web3, Ledger, acc.a5, 
				(await web3.contract(Ledger)).methods.initLedger(DAO, '', operator).encodeABI(), 'Init_Ledger');

			await this.callContract(web3, Member, acc.a6, (await web3.contract(Member))
				.methods.initMember(DAO, args.memberBaseName || '', operator, (args.members || []).map(it=>{
					return {
						owner: it.owner,
						info: {
							id: it.id,
							name: it.name || '',
							description: it.description || '',
							avatar: it.avatar || '', // TODO random avatar ?
							role: 0,
							votes: it.votes || 1,
							idx: 0,
							__ext: [0, 0],
						},
					};
				})).encodeABI(),
			'Init_Member');

			await this.callContract(web3, VotePool, acc.a7, 
				(await web3.contract(VotePool)).methods.initVotePool(DAO, '', days7).encodeABI(), 'Init_VotePool');

		}, (result: Result)=>scopeLock(`tasks_${this.id}`, async ()=>{
			if (result.flags.indexOf('Init_') != 0) return false;
			if (result.error) return Error.new(result.error);
			await storage.set(`MakeDAO_${this.id}_${result.flags}`, result.receipt!.to);
			for (let i of [
				'DAO_InterfaceID', 'Asset',
				'AssetShell.openseaFirst', 'AssetShell.openseaSecond', 'Ledger', 'Member', 'VotePool'
			]) {
				let ok = await storage.get(`MakeDAO_${this.id}_Init_${i}`);
				if (!ok) return;
			}
			return true;
		}));

		// InitDAO
		this.step(async()=>{
			let acc = await this.getAccounts();
			let {DAO,Asset,openseaFirst,openseaSecond,Ledger,Member,VotePool} = await this.getStorageAddr();
			let data = (await web3.contract(DAO)).methods.initDAO(
				args.name,
				args.mission, args.description,
				args.operator, VotePool,
				Member, Ledger, openseaFirst, openseaSecond, Asset,
			).encodeABI();
			await this.callContract(web3, DAO,  (acc as any)[`a${somes.random(1, 7)}`], data, 'Init_DAO');
		}, (result: Result)=>scopeLock(`tasks_${this.id}`, async ()=>{
			if (result.flags != 'Init_DAO') return false;
			if (result.error) return Error.new(result.error);
			return await this._InsertDAO(args, result.receipt?.blockNumber);
		}));

	}

	private async _InsertDAO(args: MakeDaoArgs, blockNumber?: number) {
		let web3 = getWeb3(args.chain);
		let {DAO,Asset,openseaFirst,openseaSecond,Ledger,Member,VotePool} = await this.getStorageAddr();

		if ( await db.selectOne(`dao_${web3.chain}`, { address: DAO }) ) {
			await db.update(`dao_${web3.chain}`, {
				assetIssuanceTax: args.assetIssuanceTax,
				assetCirculationTax: args.assetCirculationTax,
				defaultVoteRate: 5000, // (delete prop)
				defaultVotePassRate: args.defaultVotePassRate,
				defaultVoteTime: args.defaultVoteTime,
				memberBaseName: args.memberBaseName,
				memberTotalLimit: args.memberTotalLimit,
			}, {
				address: DAO,
			});
		} else {
			await db.insert(`dao_${web3.chain}`, {
				address: DAO,
				host: DAO,
				name: args.name,
				mission: args.mission,
				description: args.description,
				root: VotePool,
				operator: args.operator,
				member: Member,
				ledger: Ledger,
				assetGlobal: openseaFirst, // (delete prop)
				openseaFirst: openseaFirst,
				openseaSecond: openseaSecond,
				asset: Asset,
				time: Date.now(),
				modify: Date.now(),
				blockNumber: blockNumber || 0,
				assetIssuanceTax: args.assetIssuanceTax, // 资产发行税
				assetCirculationTax: args.assetCirculationTax, // 资产流转税
				defaultVoteRate: 5000, // (delete prop)
				defaultVotePassRate: args.defaultVotePassRate, // 投票通过率不小于 50%，默认50%=0.5
				defaultVoteTime: args.defaultVoteTime,  // 默认投票时间
				memberBaseName: args.memberBaseName, // 成员base名称
				memberTotalLimit: args.memberTotalLimit, // 成员总量限制
			});
		}

		// insert members
		for (let m of args.members || []) {
			// TODO ...
		}

		return DAO as string;
	}

	static async makeDAO(args: MakeDaoArgs, user?: string) {
		// let task = await this.task(42);
		// await task.next();
		// let id = 41;
		// let web3 = getWeb3(args.chain);
		// let DAO = await storage.get(`MakeDAO_${id}_address_DAO`);
		// let data = (await web3.contract(DAO)).methods.initInterfaceID().encodeABI();
		// console.log(data);
		// return data;

		somes.assert(! await db.selectOne(`dao_${args.chain}`, { name: args.name }), errno.ERR_DAO_NAME_EXISTS);
		if (user) {
			let [task] = await db.query<Tasks<MakeDAO>>(`select * from tasks where name like 'MakeDAO%' and state = 0 and user = ${escape(user)} limit 1`);
			somes.assert(!task, errno.ERR_DAO_IS_BEING_CREATED);
		}
		let task = await this.make(`MakeDAO#${args.name}`, args, user);
		await task.next();
		return task.tasks;
	}

	static async next(data: any) {
		let task = await this.task(data.taskId);
		await task.next(null, data);
	}
}