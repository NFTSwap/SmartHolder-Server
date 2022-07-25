/**
 * @copyright © 2022 Smart Holder Server
 * @date 2022-07-21
 */

import somes from 'somes';
import {Task} from './task';
import {Tasks} from './models/def';
import {ChainType} from './models/def';
import {mvpApi} from './request';
import getWeb3, {MvpWeb3} from './web3+';
import {PostResult} from 'bclib/web3_tx';
import * as cfg from '../config';
import db, {storage, ContractType} from './db';
import errno from './errno';
// abis
import * as ContextProxyDAO from '../abi/ContextProxyDAO.json';
import * as ContextProxyAsset from '../abi/ContextProxyAsset.json';
import * as ContextProxyAssetGlobal from '../abi/ContextProxyAssetGlobal.json';
import * as ContextProxyLedger from '../abi/ContextProxyLedger.json';
import * as ContextProxyMember from '../abi/ContextProxyMember.json';
import * as ContextProxyVotePool from '../abi/ContextProxyVotePool.json';

// make new dao tasks

export interface MakeDaoArgs {
	name: string;
	mission: string;
	description: string;
	operator: string;
	chain: ChainType;
}

export class MakeDAO extends Task<MakeDaoArgs> {

	constructor(tasks: Tasks<MakeDaoArgs>) {
		super(tasks);
	}

	private async deploy(web3: MvpWeb3, impl: string, from: string, abi: {bytecode: string, abi: any}, flags: string) {
		let addr = '0x0000000000000000000000000000000000000000';
		let id = this.tasks.id;
		let review = await mvpApi.post<string>('tx/send', {
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
		let review = await mvpApi.post<string>('tx/send', {
			chain: web3.chain,
			tx: { from, to: address, data },
			callback: `${cfg.publicURL}/service-api/tasks/makeDAO_Next__?taskId=${this.id}&flags=${flags}`,
		});
		await storage.set(`MakeDAO_${this.id}_review_${flags}`, review);
	}

	private async getStorageAddr() {
		return {
			DAO: await storage.get(`MakeDAO_${this.id}_address_DAO`),
			Asset: await storage.get(`MakeDAO_${this.id}_address_Asset`),
			AssetGlobal: await storage.get(`MakeDAO_${this.id}_address_AssetGlobal`),
			Ledger: await storage.get(`MakeDAO_${this.id}_address_Ledger`),
			Member: await storage.get(`MakeDAO_${this.id}_address_Member`),
			VotePool: await storage.get(`MakeDAO_${this.id}_address_VotePool`),
		};
	}

	exec(args: MakeDaoArgs) {
		let web3 = getWeb3(args.chain);
		type Result = PostResult & { taskId: string, flags: string };
		let part_key = 'test';

		// deploy
		this.step(async ()=>{
			let {data:from} = await mvpApi.post('keys/genSecretKeyFromPartKey', {part_key});
			let impls = (cfg.contractImpls as Dict)[ChainType[web3.chain]];
			await this.deploy(web3, impls.DAO, from, ContextProxyDAO, 'DAO');
			await this.deploy(web3, impls.Asset, from, ContextProxyAsset, 'Asset');
			await this.deploy(web3, impls.AssetGlobal, from, ContextProxyAssetGlobal, 'AssetGlobal');
			await this.deploy(web3, impls.Ledger, from, ContextProxyLedger, 'Ledger');
			await this.deploy(web3, impls.Member, from, ContextProxyMember, 'Member');
			await this.deploy(web3, impls.VotePool, from, ContextProxyVotePool, 'VotePool');
		}, async (result: Result)=>{
			if (result.error) return Error.new(result.error);
			let tableName = `contract_info_${web3.chain}`;
			let time = Date.now();
			let blockNumber = result.receipt!.blockNumber;
			let address = result.receipt!.contractAddress;
			let type = ContractType[result.flags as any];

			await storage.set(`MakeDAO_${this.id}_address_${result.flags}`, result.receipt!.contractAddress);
			if (!await db.selectOne(tableName, {address})) {
				await db.insert(tableName, { address, type, blockNumber, time });
			}
			for (let i of ['DAO', 'Asset', 'AssetGlobal', 'Ledger', 'Member', 'VotePool']) {
				let addr = await storage.get(`MakeDAO_${this.id}_address_${i}`);
				if (!addr) return;
			}
			return true;
		});

		// DAO.InitInterfaceID
		this.step(async ()=>{
			let {data:from} = await mvpApi.post('keys/genSecretKeyFromPartKey', {part_key});
			let DAO = await storage.get(`MakeDAO_${this.id}_address_DAO`);
			await this.callContract(web3, DAO, from, (await web3.contract(DAO)).methods.initInterfaceID().encodeABI(), 'InitInterfaceID');
		}, async(result: Result)=>{
			if (result.flags != 'InitInterfaceID') return false;
			if (result.error) return Error.new(result.error);
			return result.receipt;
		});

		// Init
		this.step(async()=>{
			let {data:from} = await mvpApi.post('keys/genSecretKeyFromPartKey', {part_key});
			let {DAO,Asset,AssetGlobal,Ledger,Member,VotePool} = await this.getStorageAddr();
			let operator = '0x0000000000000000000000000000000000000000';
			await this.callContract(web3, Asset, from, (await web3.contract(Asset)).methods.initAsset(DAO, '', operator).encodeABI(), 'Init_Asset');
			await this.callContract(web3, AssetGlobal, from, (await web3.contract(AssetGlobal)).methods.initAssetGlobal(DAO, '', operator).encodeABI(), 'Init_AssetGlobal');
			await this.callContract(web3, Ledger, from, (await web3.contract(Ledger)).methods.initLedger(DAO, '', operator).encodeABI(), 'Init_Ledger');
			await this.callContract(web3, Member, from, (await web3.contract(Member)).methods.initMember(DAO, '', operator).encodeABI(), 'Init_Member');
			await this.callContract(web3, VotePool, from, (await web3.contract(VotePool)).methods.initVotePool(DAO, '').encodeABI(), 'Init_VotePool');
		}, async (result: Result)=>{
			if (result.flags.indexOf('Init_') != 0) return false;
			if (result.error) return Error.new(result.error);
			await storage.set(`MakeDAO_${this.id}_${result.flags}`, result.receipt!.to);
			for (let i of ['Asset', 'AssetGlobal', 'Ledger', 'Member', 'VotePool']) {
				let addr = await storage.get(`MakeDAO_${this.id}_Init_${i}`);
				if (!addr) return;
			}
			return true;
		});

		// InitDAO
		this.step(async()=>{
			let {data:from} = await mvpApi.post('keys/genSecretKeyFromPartKey', {part_key});
			let {DAO,Asset,AssetGlobal,Ledger,Member,VotePool} = await this.getStorageAddr();
			await this.callContract(web3, DAO, from,
				(await web3.contract(DAO)).methods.initDAO(
					args.name,
					args.mission, args.description,
					args.operator, VotePool,
					Member, Ledger, AssetGlobal, Asset,
				).encodeABI(),
				'Init_DAO'
			);
		}, async(result: Result)=>{
			if (result.flags != 'Init_DAO') return false;
			if (result.error) return Error.new(result.error);
			let {DAO,Asset,AssetGlobal,Ledger,Member,VotePool} = await this.getStorageAddr();
	
			if (! await db.selectOne(`dao_${web3.chain}`, { address: DAO }) ) {
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
					assetGlobal: AssetGlobal,
					asset: Asset,
					time: Date.now(),
					modify: Date.now(),
					blockNumber: 0,//result.receipt!.blockNumber,
				});
			}

			return DAO;
		});
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
		let task = await this.make(`MakeDAO#${args.name}`, args, user);
		await task.next();
		return task.tasks;
	}

	static async next(data: any) {
		let task = await this.task(data.taskId);
		await task.next(null, data);
	}
}