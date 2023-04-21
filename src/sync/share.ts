/**
 * @copyright © 2021 Copyright ccl
 * @date 2023-04-21
 */

import {HandleEventData} from './scaner';
import {ModuleScaner} from './asset';

export class Share extends ModuleScaner {
	events = {
		Change: {
			handle: (data: HandleEventData)=>this.onChange(data),
		},
		Transfer: {
			handle: async ({event:e,blockTime: time}: HandleEventData)=>{
				console.log('Share.Transfer handle', e.returnValues);
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

}
