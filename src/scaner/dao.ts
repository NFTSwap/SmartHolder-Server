/**
 * @copyright © 2021 Copyright ccl
 * @date 2022-07-20
 */

import {ContractScaner} from './scaner';
import {EventData} from 'web3-tx';
import {Transaction} from 'web3-core';

export class DAO extends ContractScaner {

	events = {
		Change: {
			use: async (e: EventData, tx: Transaction)=>{
				let {tag} = e.returnValues;
				if (tag == 'Init') {
					// TODO ...
				} else if (tag == 'Ledger') {
					// TODO ...
				} else if (tag == 'AssetGlobal') {
					// TODO ...
				} else if (tag == 'Asset') {
					// TODO ...
				} else if (tag == 'Department') {
					// TODO ...
				}
			},
		}
	};
}
