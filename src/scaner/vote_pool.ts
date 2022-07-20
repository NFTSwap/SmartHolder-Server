/**
 * @copyright © 2021 Copyright ccl
 * @date 2022-07-20
 */

import {ContractScaner} from './scaner';
import {EventData} from 'web3-tx';

export class DAO extends ContractScaner {

	events = {
			// event Created(uint256);
			// event Vote(uint256 indexed id, uint256 member, int256 votes);
			// event Close(uint256 id);
			// event Execute(uint256 indexed id);
		Created: {
			use: async (e: EventData)=>{
				let {tag} = e.returnValues;
				// TODO ...
			},
		},
		Vote: {
			use: async (e: EventData)=>{
				let {tag} = e.returnValues;
				// TODO ...
			},
		},
		Close: {
			use: async (e: EventData)=>{
				let {tag} = e.returnValues;
				// TODO ...
			},
		},
		Execute: {
			use: async (e: EventData)=>{
				let {tag} = e.returnValues;
				// TODO ...
			},
		},
	};
}
 