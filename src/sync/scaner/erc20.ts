/**
 * @copyright © 2021 Copyright smart holder
 * @date 2023-05-09
 */

import {ContractScaner,HandleEventData} from '.';

export class ERC20 extends ContractScaner {
	// event Transfer(address indexed from, address indexed to, uint256 value);

	events = {

		Transfer: {
			handle: async (data: HandleEventData)=>{
				// TODO ...
			},
		},
	};
}
