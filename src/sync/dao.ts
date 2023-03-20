/**
 * @copyright © 2021 Copyright ccl
 * @date 2022-07-20
 */

import {HandleEventData} from './scaner';
import {ModuleScaner} from './asset';
import * as constants from './constants';
import db, {DAO as IDAO,ContractType} from '../db';
import watch from './index';
import {Indexer} from './indexer';
import  * as crypto from 'crypto-tx';

export class DAO extends ModuleScaner {

	async setDataSource(indexer: Indexer, del: string, add: string, type: ContractType) {
		if (del != add) {
			await indexer.deleteDataSource(del);
			await indexer.addDataSource({ address: add, host: this.address, type, time: Date.now() });
		}
	}

	events = {
		// event Change(uint256 indexed tag, uint256 value);
		// event SetModule(uint256 indexed id, address addr);

		Change: {
			handle: (data: HandleEventData)=>this.onChange(data),
		},

		SetModule: {
			handle: async ({event,blockTime: modify}: HandleEventData)=>{
				let db = this.db;
				let id = Number(event.returnValues.id);
				let methods = await this.methods();
				let {address,chain} = this;
				let dao = (await db.selectOne<IDAO>(`dao_${chain}`, { address }))!;
				let indexer = watch.getIndexerFromHash(chain, this.address);

				switch (id) {
					case constants.Module_MEMBER_ID:
						let member = await methods.module(constants.Module_MEMBER_ID).call();
						await db.update(`dao_${chain}`, { member, modify }, { address });
						await this.setDataSource(indexer, dao.member, member, ContractType.Member);
						break;
					case constants.Module_LEDGER_ID:
						let ledger = await methods.module(constants.Module_LEDGER_ID).call();
						await db.update(`dao_${chain}`, { ledger, modify }, { address });
						await this.setDataSource(indexer, dao.ledger, ledger, ContractType.Ledger);
						break;
					case constants.Module_ASSET_ID:
						let asset = await methods.module(constants.Module_ASSET_ID).call();
						await db.update(`dao_${chain}`, { asset, modify }, { address });
						await this.setDataSource(indexer, dao.asset, asset, ContractType.Asset);
						break;
					case constants.Module_ASSET_First_ID:
						let first = await methods.module(constants.Module_ASSET_First_ID).call();
						await db.update(`dao_${chain}`, { first, modify }, { address });
						await this.setDataSource(indexer, dao.first, first, ContractType.AssetShell);
						break;
					case constants.Module_ASSET_Second_ID:
						let second = await methods.module(constants.Module_ASSET_Second_ID).call();
						await db.update(`dao_${chain}`, { second, modify }, { address });
						await this.setDataSource(indexer, dao.second, second, ContractType.AssetShell);
						break;
				}
			}
		},
	};

	protected async onDescription({blockTime: modify}: HandleEventData, desc: string) {
		await this.db.update(`dao_${this.chain}`, { description: desc, modify }, { address: this.address });
	}

	protected async onOperator({blockTime:modify}: HandleEventData, addr: string) {
		await this.db.update(`dao_${this.chain}`, { operator: addr, modify }, { address: this.address });
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
				await this.db.update(`dao_${chain}`, { mission, modify }, { address });
				break;
			case constants.Change_Tag_DAO_Image:
				let image = await methods.image().call();
				await this.db.update(`dao_${chain}`, { image, modify }, { address });
				break;
			case constants.Change_Tag_DAO_Extend:
				let extend = crypto.toBuffer(await methods.image().call());
				await this.db.update(`dao_${chain}`, { extend, modify }, { address });
				break;
		}
	}

}
