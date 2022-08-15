/**
 * @copyright © 2021 Copyright ccl
 * @date 2022-07-20
 */

import {ContractScaner, blockTimeStamp,formatHex} from './scaner';
import {EventData} from 'web3-tx';
import db, {storage} from '../db';

export class Member extends ContractScaner {
	events = {
		// event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
		// event UpdateInfo(uint256 id);

		Transfer: {
			use: async (e: EventData)=>{
				let tokenId = formatHex(e.returnValues.tokenId, 32);
				let chain = this.chain;
				let time = await blockTimeStamp(this.web3, e.blockNumber);
				

				// id           int primary key auto_increment,
				// host         varchar (64)               not null, -- dao host
				// token        varchar (64)               not null, -- address
				// tokenId      varchar (72)               not null, -- id
				// uri          varchar (512)              not null, -- uri
				// owner        varchar (64)               not null, -- owner address
				// name         varchar (64)               not null, -- member name
				// description     varchar (512)              not null, -- member description
				// avatar       varchar (512)              not null, -- member head portrait
				// role         int           default (0)  not null, -- default 0
				// votes        int           default (0)  not null, -- default > 0
				// time         bigint                     not null,
				// modify       bigint                     not null

				let methods = await this.methods();
				// let to = formatHex(e.returnValues.to, 32);
				let isRemove = ! await methods.exists().call(); // (to == '0x0000000000000000000000000000000000000000');
				let token = this.address;

				if (await db.selectOne(`member_${chain}`, { token, tokenId })) {
					if (isRemove) {
						await storage.set(`member_${chain}_${this.address}_total`, await methods.total().call());
						await db.delete(`member_${chain}`, { token, tokenId });
					} else {
						let owner = this.ownerOf(tokenId);
						await db.update(`member_${chain}`, { owner: owner }, { token: this.address, tokenId });
					}
				} else {
					if (isRemove)
						return;
					let owner = this.ownerOf(tokenId);
					let uri = await this.uri(tokenId);
					let info = await this.getMemberInfo(tokenId);

					await db.insert(`member_${chain}`, {
						host: await this.host(),
						token: this.address,
						tokenId, uri,
						owner: owner,
						name: info.name,
						description: info.description,
						avatar: info.avatar,
						role: info.role,
						votes: info.votes,
						time: time,
						modify: time,
					});

					await storage.set(`member_${chain}_${this.address}_total`, await methods.total().call());
				}
			},
		},

		UpdateInfo: {
			use: async (e: EventData)=>{
				let tokenId = formatHex(e.returnValues.id, 32);
				let chain = this.chain;
				let time = await blockTimeStamp(this.web3, e.blockNumber);
				let uri = await this.uri(tokenId);
				let info = await this.getMemberInfo(tokenId);

				await db.update(`member_${chain}`, {
					uri,
					name: info.name,
					description: info.description,
					avatar: info.avatar,
					role: info.role,
					votes: info.votes,
					modify: time,
				}, { token: this.address, tokenId });
			},
		},
	};

	async total() {
		return await (await this.methods()).total().call() as number;
	}

	async ownerOf(tokenId: string) {
		return await (await this.methods()).ownerOf(tokenId).call() as string;
	}

	async getMemberInfo(tokenId: string) {
		// function getInfo(uint256 id) view external override returns (Info memory) {
		return await (await this.methods()).getInfo(tokenId).call();
	}

	async uri(tokenId: string): Promise<string> {
		var c = await this.contract();
		var uri = await c.methods.tokenURI(tokenId).call() as string;
		return uri;
	}

}
