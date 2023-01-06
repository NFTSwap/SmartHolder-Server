/**
 * @copyright © 2021 Copyright ccl
 * @date 2022-07-20
 */

import {ContractScaner,formatHex,HandleEventData} from './scaner';
import db, {storage,MemberInfo,Member as MemberDef} from '../db';
import * as constants from './constants';

export class Member extends ContractScaner {
	events = {
		// event Update(uint256 indexed id); // update info
		// event TransferVotes(uint256 indexed from, uint256 indexed to, uint32 votes);
		// event AddPermissions(uint256[] ids, uint256[] actions);
		// event RemovePermissions(uint256[] ids, uint256[] actions);

		Transfer: {
			handle: async ({event:e,blockTime: time}: HandleEventData)=>{
				let tokenId = formatHex(e.returnValues.tokenId, 32);
				let chain = this.chain;

				// id           int primary key auto_increment,
				// host         varchar (64)               not null, -- dao host
				// token        varchar (64)               not null, -- address
				// tokenId      varchar (72)               not null, -- id
				// owner        varchar (64)               not null, -- owner address
				// name         varchar (64)               not null, -- member name
				// description  varchar (512)              not null, -- member description
				// image        varchar (512)              not null, -- member head portrait
				// votes        int           default (0)  not null, -- default > 0
				// time         bigint                     not null,
				// modify       bigint                     not null

				let methods = await this.methods();
				let isRemove = ! await methods.exists(tokenId).call(); // (to == '0x0000000000000000000000000000000000000000');
				let token = this.address;

				if (await db.selectOne(`member_${chain}`, { token, tokenId })) {
					if (isRemove) {
						await storage.set(`member_${chain}_${this.address}_total`, await this.total());
						await db.delete(`member_${chain}`, { token, tokenId });
					} else {
						let owner = await this.ownerOf(tokenId);
						await db.update(`member_${chain}`, { owner: owner }, { token: this.address, tokenId });
					}
				} else {
					if (isRemove)
						return;
					let owner = await this.ownerOf(tokenId);
					let info = await this.getMemberInfo(tokenId);
					let permissions = [];

					if (await methods.isPermissionFrom(tokenId, constants.Action_VotePool_Create).call())
						permissions.push(constants.Action_VotePool_Create);
					if (await methods.isPermissionFrom(tokenId, constants.Action_VotePool_Vote).call())
						permissions.push(constants.Action_VotePool_Vote);

					await db.insert(`member_${chain}`, {
						host: await this.host(),
						token: this.address,
						tokenId,
						owner: owner,
						name: info.name,
						description: info.description,
						image: info.image,
						votes: info.votes,
						time: time,
						modify: time,
						permissions,
					});

					await storage.set(`member_${chain}_${this.address}_total`, await this.total());
				}
			},
		},
		Update: {
			handle: async ({event:e,blockTime: time}: HandleEventData)=>{
				let tokenId = formatHex(e.returnValues.id, 32);
				if ( await db.selectOne(`member_${this.chain}`, { token: this.address, tokenId }) ) {
					let info = await this.getMemberInfo(tokenId);
					await db.update(`member_${this.chain}`, {
						name: info.name,
						description: info.description,
						image: info.image,
						votes: info.votes,
						modify: time,
					}, { token: this.address, tokenId });
				}
			},
		},
		TransferVotes: {
			handle: (data: HandleEventData)=>this.events.Update.handle(data),
		},
		AddPermissions: { // May be inaccurate
			handle: async ({event}: HandleEventData)=>{
				let tokenIds = (event.returnValues.IDs as string[]).map(e=>formatHex(e, 32));
				let actions = (event.returnValues.actions as string[]).map(e=>Number(e));
				for (let tokenId of tokenIds) {
					let mbr = await db.selectOne<MemberDef>(`member_${this.chain}`, { token: this.address, tokenId })
					if ( mbr ) {
						let permissions = mbr.permissions || [];
						let len = permissions.length;
						for (let action of actions) {
							if (permissions.indexOf(action) == -1)
								permissions.push(action);
						}
						if (len != permissions.length) {
							await db.update(`member_${this.chain}`, { permissions }, { id: mbr.id });
						}
					}
				}
			},
		},
		RemovePermissions: { // May be inaccurate
			handle: async ({event}: HandleEventData)=>{
				let tokenIds = (event.returnValues.IDs as string[]).map(e=>formatHex(e, 32));
				let actions = (event.returnValues.actions as string[]).map(e=>Number(e));
				for (let tokenId of tokenIds) {
					let mbr = await db.selectOne<MemberDef>(`member_${this.chain}`, { token: this.address, tokenId })
					if ( mbr ) {
						let permissions = mbr.permissions || [];
						let len = permissions.length;
						for (let per of permissions) {
							if (actions.indexOf(per) != -1)
								permissions.deleteOf(per);
						}
						if (len != permissions.length) {
							await db.update(`member_${this.chain}`, { permissions }, { id: mbr.id });
						}
					}
				}
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
		return await (await this.methods()).getMemberInfo(tokenId).call() as MemberInfo;
	}

}
