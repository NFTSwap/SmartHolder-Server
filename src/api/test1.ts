
import ApiController from '../api';
import { RuleResult } from 'deps/bclib/deps/somes/router';

export default class extends ApiController {

	onAuth(_: RuleResult) {
		return Promise.resolve(true);
	}

	async getOpenseaContractJSON({address}: {address: string}) {
		let addr = BigInt(address).toString(16);
		addr = '0x' + Array.from({length: 1 + Math.max(0, 40 - addr.length)}).join('0') + addr;
		let json = {
			"name":"TestNFT-ABCD",
			"description":"TestNFT-ABCD",
			"image":"https://smart-dao-rel.stars-mine.com/image.png",
			"external_link":"https://smart-dao-rel.stars-mine.com",
			"seller_fee_basis_points":1000,
			"fee_recipient": addr,
		};
		var type = this.server.getMime('json');
		this.returnString(JSON.stringify(json), type);
	}

}