/**
 * @copyright © 2021 Copyright ccl
 * @date 2022-07-20
 */

import {HandleEventData} from './scaner';
import {ModuleScaner} from './asset';
import * as constants from './constants';
import db from '../db';

export class DAO extends ModuleScaner {

	events = {
		// event Change(uint256 indexed tag, uint256 value);
		// event SetModule(uint256 indexed id, address addr);

		Change: {
			handle: (data: HandleEventData)=>this.onChange(data),
		},

		SetModule: {
			handle: async ({event,blockTime: modify}: HandleEventData)=>{
				let id = Number(event.returnValues.id);
				let methods = await this.methods();
				let {address,chain} = this;

				switch (id) {
					case constants.Module_MEMBER_ID:
						let member = await methods.module(constants.Module_MEMBER_ID).call();
						await db.update(`dao_${chain}`, { member, modify }, { address });
						break;
					case constants.Module_LEDGER_ID:
						let ledger = await methods.module(constants.Module_LEDGER_ID).call();
						await db.update(`dao_${chain}`, { ledger, modify }, { address });
						break;
					case constants.Module_ASSET_ID:
						let asset = await methods.module(constants.Module_ASSET_ID).call();
						await db.update(`dao_${chain}`, { asset, modify }, { address });
						break;
					case constants.Module_ASSET_First_ID:
						let first = await methods.module(constants.Module_ASSET_First_ID).call();
						await db.update(`dao_${chain}`, { first, modify }, { address });
						break;
					case constants.Module_ASSET_Second_ID:
						let second = await methods.module(constants.Module_ASSET_Second_ID).call();
						await db.update(`dao_${chain}`, { second, modify }, { address });
						break;
				}
			}
		},
	};

	protected async onDescription({blockTime: modify}: HandleEventData, desc: string) {
		await db.update(`dao_${this.chain}`, { description: desc, modify }, { address: this.address });
	}

	protected async onOperator({blockTime:modify}: HandleEventData, addr: string) {
		await db.update(`dao_${this.chain}`, { operator: addr, modify }, { address: this.address });
	}

	protected async onUpgrade(data: HandleEventData, addr: string) {
		// noop
	}

	protected async onChangePlus({blockTime: modify}: HandleEventData, tag: number) {
		let methods = await this.methods();
		let {address,chain} = this;
		switch (tag) {
			case constants.Change_Tag_DAO_Mission:
				let mission = await methods.mission().call();
				await db.update(`dao_${chain}`, { mission, modify }, { address });
				break;
		}
	}

}
