/**
 * @copyright © 2021 Copyright ccl
 * @date 2022-07-20
 */

import {ContractScaner,blockTimeStamp} from './scaner';
import {EventData} from 'web3-tx';
import db from '../db';

export class DAO extends ContractScaner {

	events = {
		// event Change(string tag);

		Change: {
			use: async (e: EventData)=>{
				// id: number;//           int primary key auto_increment,
				// host: string;//         varchar (64)   not null, -- dao host or self address
				// address: string;//      varchar (64)   not null,
				// name: string;//         varchar (64)   not null,
				// mission: string;//      varchar (1024) not null,
				// describe: string;//     varchar (1024) not null,
				// root: string;//         varchar (64)   not null,
				// operator: string;//     varchar (64)   not null,
				// member: string;//       varchar (64)   not null,
				// ledger: string;//       varchar (64)   not null,
				// assetGlobal: string;//  varchar (64)   not null,
				// asset: string;//        varchar (64)   not null,
				// time: number;//         bigint         not null,
				// modify: number;//       bigint         not null

				let tag = e.returnValues.tag;
				let m = await this.methods();
				let time = await blockTimeStamp(this.web3, e.blockNumber);

				if (tag == 'Init') {
					if (! await db.selectOne(`dao_${this.chain}`, { address: this.address }) ) {
						await db.insert(`dao_${this.chain}`, {
							host: await this.host(),
							address: this.address,
							name: await m.name().call(),
							mission: await m.mission().call(),
							describe: await m.describe().call(),
							root: await m.root().call(),
							member: await m.member().call(),
							ledger: await m.ledger().call(),
							assetGlobal: await m.assetGlobal().call(),
							asset: await m.asset().call(),
							time: time,
							modify: time,
							blockNumber: e.blockNumber,
						});
					}
				} else if (tag == 'Ledger') {
					await db.update(`dao_${this.chain}`, { ledger: await m.ledger().call(), modify: time }, { address: this.address });
				} else if (tag == 'AssetGlobal') {
					await db.update(`dao_${this.chain}`, { assetGlobal: await m.assetGlobal().call(), modify: time }, { address: this.address });
				} else if (tag == 'Asset') {
					await db.update(`dao_${this.chain}`, { asset: await m.asset().call(), modify: time }, { address: this.address });
				} else if (tag == 'Department') {
					// await db.update(`dao_${this.chain}`, { ledger: await m.ledger().call(), modify: time }, { address: this.address });
				}
			},
		}
	};


}
