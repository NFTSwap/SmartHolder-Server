
// import _ from 'bclib/api/chain';
import {ChainType} from '../models/define';
import sync from '../sync';
import ApiController from '../api';
import web3s from 'bclib/web3+';

export default class extends ApiController {

	protected _web3() { return web3s[Number(this.params.chain || this.headers.chain) || 1] };

	onAuth() {
		return Promise.resolve(true);
	}

	waitBlockNumber({chain, host, blockNumber,timeout}:{chain?: ChainType, host: string, blockNumber: number, timeout?: number}) {
		return sync.waitBlockNumber(chain || this._web3().chain, host, blockNumber, timeout);
	}
}