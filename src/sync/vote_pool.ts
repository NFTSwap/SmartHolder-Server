/**
 * @copyright © 2021 Copyright ccl
 * @date 2022-07-20
 */

import {ContractScaner, formatHex,HandleEventData} from './scaner';
import {VoteProposal, storage} from '../db';

export class VotePool extends ContractScaner {

	events = {
			// event Created(uint256 id);
			// event Vote(uint256 indexed id, uint256 member, int256 votes);
			// event Close(uint256 id);
			// event Execute(uint256 indexed id);

		Created: {
			handle: async (data: HandleEventData)=>{
				await this.update(formatHex(data.event.returnValues.id, 32), data);
			},
		},

		Vote: {
			handle: async (data: HandleEventData)=>{
				let db = this.db;
				let {event:e, blockTime: time,blockNumber} = data;
				let proposal_id = formatHex(e.returnValues.id, 32);
				let member_id = formatHex(e.returnValues.member, 32);
				let votes = e.returnValues.votes;
				await this.update(proposal_id, data);

				// id           int primary key auto_increment,
				// proposal_id  varchar (72)                 not null, -- 提案id
				// member_id    varchar (72)                 not null, -- 成员 id
				// votes        int                          not null, -- 投票数量
				// time         bigint                       not null,
				// blockNumber  int                          not null

				if ( ! await db.selectOne(`votes_${this.chain}`, { address: this.address, proposal_id, member_id }) ) {
					// let time = await blockTimeStamp(this.web3, e.blockNumber);

					await db.insert(`votes_${this.chain}`, {
						address: this.address,
						proposal_id,
						member_id,
						votes,
						time,
						blockNumber,
					});
				}
			},
		},

		Close: {
			handle: async (data: HandleEventData)=>{
				await this.update(formatHex(data.event.returnValues.id, 32), data);
			},
		},

		Execute: {
			handle: async (data: HandleEventData)=>{
				await this.update(formatHex(data.event.returnValues.id, 32), data);
			},
		},
	};

	private async update(proposal_id: string, {blockTime: time,blockNumber}: HandleEventData) {
		let db = this.db;
		let proposal = await this.getProposal(proposal_id);

		if ( ! await db.selectOne(`vote_proposal_${this.chain}`, { address: this.address, proposal_id }) ) {
			await db.insert(`vote_proposal_${this.chain}`, {
				host: await this.host(),
				address: this.address,
				proposal_id: proposal_id,
				name: proposal.name,
				description: proposal.description,
				origin: proposal.origin,
				originId: formatHex(proposal.originId),
				target: proposal.target,
				data: proposal.data,
				lifespan: proposal.lifespan,
				expiry: proposal.expiry,
				voteRate: 5000, // (delete props)
				passRate: proposal.passRate,
				loopCount: proposal.loopCount,
				loopTime: proposal.loopTime,
				voteTotal: proposal.voteTotal,
				agreeTotal: proposal.agreeTotal,
				executeTime: proposal.executeTime,
				isAgree: proposal.isAgree,
				isClose: proposal.isClose,
				isExecuted: proposal.isExecuted,
				time: time,
				modify: time,
				blockNumber,
			});

			await storage.set(`vote_proposal_${this.chain}_${this.address}_total`, Number(await (await this.methods()).total().call()));
		} else {
			await db.update(`vote_proposal_${this.chain}`, {
				loopCount: proposal.loopCount,
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
		// struct Proposal {
		// 	uint256   id; // 随机256位长度id
		// 	string    name; // 名称
		// 	string    description; // 描述
		// 	address   origin; // 发起人 address
		// 	uint256   originId; // 发起人成员id (member id),如果为0表示匿名成员
		// 	address[] target; // 目标合约,决议执行合约地址列表
		// 	uint256   lifespan; // 投票生命周期单位（分钟）
		// 	uint256   expiry; // 过期时间,为0时永不过期
		// 	uint256   passRate; // 通过率不小于全体票数50% 1/10000
		// 	int256    loopCount; // 执行循环次数, -1表示永久定期执行决议
		// 	uint256   loopTime; // 执行循环间隔时间,不等于0时必须大于1分钟,0只执行一次
		// 	uint256   voteTotal; // 投票总数
		// 	uint256   agreeTotal; // 通过总数
		// 	uint256   executeTime; // 上次执行的时间
		// 	uint256   idx; //
		// 	bool      isAgree; // 是否通过采用
		// 	bool      isClose; // 投票是否截止
		// 	bool      isExecuted; // 是否已执行完成
		// 	bytes[]   data; // 调用方法与实参列表
		// }

		return await (await this.methods()).getProposal(id).call();
	}
}
 