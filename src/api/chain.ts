
import _ from 'bclib/api/chain';
import {ChainType} from '../models/def';
import sync from '../sync';

export default class extends _ {
	waitBlockNumber({chain, blockNumber,timeout}:{chain?: ChainType, blockNumber: number, timeout?: number}) {
		return sync.waitBlockNumber(chain || this._web3().chain, blockNumber, timeout);
	}
}