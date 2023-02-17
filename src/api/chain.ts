
// import _ from 'bclib/api/chain';
import {ChainType} from '../models/define';
import sync from '../sync';
import ApiController from '../api';
import web3s from 'bclib/web3+';

export default class extends ApiController {

	onAuth() {
		return Promise.resolve(true);
	}

	protected _web3() { return web3s[Number(this.params.chain || this.headers.chain || this.data.chain) || 1] };

	protected get _chain() {
		return this._web3().chain;
	}

	waitBlockNumber({chain, dao, blockNumber,timeout}:{chain?: ChainType, dao: string, blockNumber: number, timeout?: number}) {
		return sync.waitBlockNumber(chain || this._chain, dao, blockNumber, timeout);
	}

	getBlockSyncHeight({worker}:{worker:number}) {
		return sync.watchBlocks[this._chain].getBlockSyncHeight(worker);
	}

	getValidBlockSyncHeight() {
		return sync.watchBlocks[this._chain].getValidBlockSyncHeight();
	}

	getTransactionLogsFrom({startBlockNumber,endBlockNumber,info}:{
		startBlockNumber: number, endBlockNumber: number, info: {state: number, address: string}[]
	}) {
		return sync.watchBlocks[this._chain].getTransactionLogsFrom(startBlockNumber,endBlockNumber,info);
	}

	getTransaction({txHash}:{txHash: string}) {
		return sync.watchBlocks[this._chain].getTransaction(txHash);
	}
}