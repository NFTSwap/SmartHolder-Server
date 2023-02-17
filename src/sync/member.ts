/**
 * @copyright © 2021 Copyright ccl
 * @date 2022-07-20
 */

import {formatHex,HandleEventData} from './scaner';
import {ModuleScaner} from './asset';
import db, {storage,MemberInfo,Member as MemberDef} from '../db';
import * as constants from './constants';

export class Member extends ModuleScaner {
	events = {
		// event Update(uint256 indexed id); // update info
		// event TransferVotes(uint256 indexed from, uint256 indexed to, uint32 votes);
		// event AddPermissions(uint256[] ids, uint256[] actions);
		// event RemovePermissions(uint256[] ids, uint256[] actions);

		Change: {
			handle: (data: HandleEventData)=>this.onChange(data),
		},
		Transfer: {
			handle: async ({event:e,blockTime: time}: HandleEventData)=>{
				let db = this.db;
				let tokenId = formatHex(e.returnValues.tokenId);
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
				this.web3.eth.call({}, 100);

				let methods = await this.methods();
				let isRemove = ! await methods.exists(tokenId).call(); // (to == '0x0000000000000000000000000000000000000000');
				let token = this.address;

				if (await db.selectOne(`member_${chain}`, { token, tokenId })) {
					if (isRemove) {
						let members = await this.total();
						let host = await this.host();
						await db.delete(`member_${chain}`, { token, tokenId });
						await db.update(`dao_${chain}`, { members }, {address: host});
						await storage.set(`member_${chain}_${this.address}_total`, members);
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

					let members = await this.total();
					let host = await this.host();

					await db.insert(`member_${chain}`, {
						host: host,
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
					await db.update(`dao_${chain}`, { members }, {address: host});
					await storage.set(`member_${chain}_${this.address}_total`, members);
				}
			},
		},
		Update: {
			handle: async ({event:e,blockTime: time}: HandleEventData)=>{
				let db = this.db;
				let tokenId = formatHex(e.returnValues.id);
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
			handle: async (data: HandleEventData)=>{
				let db = this.db;
				let {from,to} = data.event.returnValues;
				let methods = await this.methods();

				for (let [id] of [from, to]) {
					if (id != '0' && await methods.exists(id).call()) {
						let info = await this.getMemberInfo(id);
						await db.update(`member_${this.chain}`, {
							votes: info.votes,
						}, { token: this.address, tokenId: formatHex(id) });
					}
				}
			},
		},
		AddPermissions: { // May be inaccurate
			handle: async ({event}: HandleEventData)=>{
				let db = this.db;
				let tokenIds = (event.returnValues.ids as string[]).map(e=>formatHex(e, 32));
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
				let db = this.db;
				let tokenIds = (event.returnValues.ids as string[]).map(e=>formatHex(e, 32));
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

	protected async onDescription({blockTime: modify}: HandleEventData, desc: string) {
		//await db.update(`dao_${this.chain}`, { description: desc, modify }, { address: this.address });
	}

	protected async onOperator({blockTime:modify}: HandleEventData, addr: string) {
		//await db.update(`dao_${this.chain}`, { operator: addr, modify }, { address: this.address });
	}

	protected async onUpgrade(data: HandleEventData, addr: string) {
		// noop
	}

	protected async onChangePlus({blockTime:modify}: HandleEventData, tag: number) {
		let db = this.db;
		switch (tag) {
			case constants.Change_Tag_Member_Set_Executor:
				let methods = await this.methods();
				let executor = formatHex(await methods.executor().call());
				let info = await this.info()
				await db.update(`dao_${this.chain}`, { executor, modify }, { address: info.host });
				break;
		}
	}

	async total() {
		return Number(await (await this.methods()).total().call());
	}

	async ownerOf(tokenId: string) {
		return await (await this.methods()).ownerOf(tokenId).call() as string;
	}

	async getMemberInfo(tokenId: string) {
		return await (await this.methods()).getMemberInfo(tokenId).call() as MemberInfo;
	}
}
