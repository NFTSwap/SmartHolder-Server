/**
 * @copyright © 2021 Copyright ccl
 * @date 2022-07-20
 */

import {ContractScaner, formatHex, blockTimeStamp} from './scaner';
import {EventData} from 'web3-tx';
import db, {VoteProposal, storage} from '../db';

export class VotePool extends ContractScaner {

	events = {
			// event Created(uint256 id);
			// event Vote(uint256 indexed id, uint256 member, int256 votes);
			// event Close(uint256 id);
			// event Execute(uint256 indexed id);
		Created: {
			use: async (e: EventData)=>{
				await this.update(formatHex(e.returnValues.id, 32), e);
			},
		},

		Vote: {
			use: async (e: EventData)=>{
				let proposal_id = formatHex(e.returnValues.id, 32);
				let member_id = formatHex(e.returnValues.member, 32);
				let votes = e.returnValues.votes;
				await this.update(proposal_id, e);

				// id           int primary key auto_increment,
				// proposal_id  varchar (72)                 not null, -- 提案id
				// member_id    varchar (72)                 not null, -- 成员 id
				// votes        int                          not null, -- 投票数量
				// time         bigint                       not null,
				// blockNumber  int                          not null

				if ( ! await db.selectOne(`votes_${this.chain}`, { address: this.address, proposal_id, member_id }) ) {
					let time = await blockTimeStamp(this.web3, e.blockNumber);

					await db.insert(`votes_${this.chain}`, {
						proposal_id,
						member_id,
						votes,
						time,
						blockNumber: e.blockNumber,
					});
				}
			},
		},

		Close: {
			use: async (e: EventData)=>{
				await this.update(formatHex(e.returnValues.id, 32), e);
			},
		},

		Execute: {
			use: async (e: EventData)=>{
				await this.update(formatHex(e.returnValues.id, 32), e);
			},
		},
	};

	private async update(proposal_id: string, e: EventData) {
		let proposal = await this.getProposal(proposal_id);
		let time = await blockTimeStamp(this.web3, e.blockNumber);

		if ( ! await db.selectOne(`vote_proposal_${this.chain}`, { address: this.address, proposal_id }) ) {
			await db.insert(`vote_proposal_${this.chain}`, {
				host: await this.host(),
				address: this.address,
				proposal_id: proposal_id,
				name: proposal.name,
				describe: proposal.describe,
				origin: proposal.origin,
				target: proposal.target,
				data: proposal.data,
				lifespan: proposal.lifespan,
				expiry: proposal.expiry,
				voteRate: proposal.voteRate,
				passRate: proposal.passRate,
				loop: proposal.loop,
				loopTime: proposal.loopTime,
				voteTotal: proposal.voteTotal,
				agreeTotal: proposal.agreeTotal,
				executeTime: proposal.executeTime,
				isAgree: proposal.isAgree,
				isClose: proposal.isClose,
				isExecuted: proposal.isExecuted,
				time: time,
				modify: time,
				blockNumber: e.blockNumber,
			});

			await storage.set(`vote_proposal_${this.chain}_${this.address}_total`, await (await this.methods()).total().call());
		} else {
			await db.update(`vote_proposal_${this.chain}`, {
				loop: proposal.loop,
				voteTotal: proposal.voteTotal,
				agreeTotal: proposal.agreeTotal,
				executeTime: proposal.executeTime,
				isAgree: proposal.isAgree,
				isClose: proposal.isClose,
				isExecuted: proposal.isExecuted,
				modify: time,
			}, { address: this.address, proposal_id });
		}
	}

	async getProposal(id: string): Promise<VoteProposal> {
		// export interface VoteProposal {

		// id: number;//           int primary key auto_increment,
		// host: string;//         varchar (64)                 not null, -- dao host
		// address: string;//      varchar (64)                 not null, -- 投票池合约地址
		// proposal_id: string;//  varchar (72)                 not null, -- 提案id
		// name: string;//         varchar (64)                 not null, -- 提案名称
		// describe: string;//     varchar (1024)               not null, -- 提案描述
		// origin: string;//       varchar (64)                 not null, -- 发起人
		// target: string;//       varchar (64)                 not null, -- 执行目标合约地址
		// data: string;//         text                         not null, -- 执行参数数据
		// lifespan: number;//     bigint                       not null, -- 投票生命周期（minutes）
		// expiry: number;//       bigint                       not null, -- 过期时间（区块链时间单位）
		// voteRate: number;//     int                          not null, -- 投票率不小于全体票数50% (0-10000)
		// passRate: number;//     int                          not null, -- 通过率不小于全体票数50% (0-10000)
		// loop: number;//         int              default (0) not null, -- 执行循环次数: -1无限循环,0不循环
		// loopTime: number;//     bigint           default (0) not null, -- 执行循环间隔时间
		// voteTotal: number;//    bigint           default (0) not null, -- 投票总数
		// agreeTotal: number;//   bigint           default (0) not null, -- 通过总数
		// executeTime: number;//  bigint           default (0) not null, -- 上次执行的时间
		// isAgree: boolean;//     bit              default (0) not null, -- 是否通过采用
		// isClose: boolean;//     bit              default (0) not null, -- 投票是否截止
		// isExecuted: boolean;//  bit              default (0) not null  -- 是否已执行完成
		// time: number;//         bigint                       not null,
		// modify: number;//       bigint                       not null,
		// blockNumber: number;//  int                          not null

		// struct Proposal {
		// 	uint256 id;
		// 	string name;
		// 	string describe;
		// 	address origin; // 发起人
		// 	address target; // 目标合约
		// 	uint256 lifespan; // 投票生命周期
		// 	uint256 expiry; // 过期时间
		// 	uint256 voteRate; // 投票率不小于全体票数50%
		// 	uint256 passRate; // 通过率不小于全体票数50%
		// 	int256  loop; // 执行循环次数
		// 	uint256 loopTime; // 执行循环间隔时间
		// 	uint256 voteTotal; // 投票总数
		// 	uint256 agreeTotal; // 通过总数
		// 	uint256 executeTime; // 上次执行的时间
		// 	uint256 idx;
		// 	bool isAgree; // 是否通过采用
		// 	bool isClose; // 投票是否截止
		// 	bool isExecuted; // 是否已执行完成
		// 	bytes data; // 调用方法与实参
		// }

		return await (await this.methods()).getProposal(id).call();
	}
}
 