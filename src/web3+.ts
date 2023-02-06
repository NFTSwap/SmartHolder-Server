
import bcweb3, {BcWeb3} from 'bclib/web3+';
import {Web3,Contract,MPSwitchMode,MultipleProvider,BaseProvider,JsonRpcResponse} from 'web3-tx';
import * as abi from 'bclib/abi';
import {ContractType,ChainType} from './models/define';
import * as cfg from '../config';
import somes from 'somes';
import {AbiInterface} from 'bclib/abi';
import * as contract from './models/contract';
import {WatchCat} from 'bclib/watch';
import { env } from './env';

export { Web3, BcWeb3, Contract, AbiInterface };

export enum Web3Mode {
	kMultiple_Random, // 0 每一次请求都会随机选择一个rpc地址
	kMultiple_Fixed,  // 1多模式：在多个节点中自动切换，当前一个节点出现故障时，会随机切换到下一个节点
	kSingle,          // 2单一模式：优先选择第一个节点,当第一个节点比第二个节点小16个块时切换到第二个节点
}

// export const mode: Web3Mode = Number(cfg.web3Mode) || 0;

abi.setSaveAbiToLocal(false);

abi.FetchAbiFunList.pop(); // delete default fetch fun

abi.FetchAbiFunList.push(async (addr, chain)=>{
	somes.assert(addr, '#shs#web3+#FetchAbiFunList fetchAbiFunList address Cannot be empty');
	var info = await contract.select(addr, chain);

	if (info && info.abi) {
		try {
			var abi: abi.AbiInterface = { address: addr, abi: JSON.parse(info.abi) };
			return abi;
		} catch(err:any) {
			console.warn('#shs#web3+#FetchAbiFunList', err.message);
		}
	}
	// use default abi
	if (info && info.type) {
		var abiI = await getAbiByType(info.type);
		// var abiI = await getAbiByType(1);
		if (abiI) {
			return {...abiI, address: addr};
		}
	}
});

export function isZeroAddress(addr: string) {
	return addr == '0x0000000000000000000000000000000000000000';
}

export function getAbiByType(type: ContractType) {
	return abi.getLocalAbi(`${__dirname}/../abi/${ContractType[type]}.json`);
}

export function isRpcLimitRequestAccount(web3: Web3, err: Error) {
	if (err.errno == -32005) {
		if (web3.provider.switchMode == MPSwitchMode.kFixed) {
			var rpc =  web3.provider.rpc;
			if (rpc.indexOf('maticvigil') != -1) {
				// "details": "Rate limit exceeded: 150000 per 1 day. Check response body for more details on backoff.",
				if (err.details && err.details.indexOf('Rate limit exceeded') != -1) {
					return true;
				}
			} else if (rpc.indexOf('infura.io') != -1) {
				if (err.message.indexOf('request rate limited') != -1) {
					return true;
				}/* else if (err.response && err.response.indexOf('account disabled') != -1) {
					// description: "Ethereum device failure"
					// response: "account disabled\n"
					// return true;
				}*/
			}
		}
	} else if (err.errno == 100235) {
		return true;
	}
	return false;
}

export function isRpcLimitDataSize(web3: Web3, err: Error) {
	if (err.errno == -32005) {
		if (web3.provider.switchMode == MPSwitchMode.kFixed) {
			var rpc =  web3.provider.rpc;
			// https://rinkeby.infura.io/v3/833b4e8323c6491ea584e1fcc0d31971
			// query returned more than
			// https://rpc-mumbai.maticvigil.com/v1/f9aa416097c89301b2a74b5ee9a48a3d49987463
			// Blockheight too far in the past: eth_getLogs. Range of blocks allowed for your plan: 1000
			if (rpc.indexOf('maticvigil') != -1) {
				if (err.message.indexOf('Range of blocks allowed for your plan: 1000') != -1) {
					return true;
				}
			} else if (rpc.indexOf('infura.io') != -1) {
				if (err.message.indexOf('query returned more than') != -1) {
					return true;
				}
			}
		}
	}
	return false;
}

class MvpMultipleProvider extends MultipleProvider {
	onResult(res: JsonRpcResponse, rpc: string) {
		if (res.error) {
			var err = Error.new(res.error);
			if (err.internalError && err.errno == 403 &&
				err.internalError.indexOf('Both rpc err and result are null') != -1) {
				res.result = null;
				res.error = undefined;
			}
		}
	}
}

export class MvpWeb3 extends BcWeb3 {
	private _HasSupportGetTransactionReceiptsByBlock: boolean | undefined;

	readonly chain: ChainType;

	readonly mode: Web3Mode;

	cattime = 10; // 1 minute call cat()

	constructor(chain: ChainType, _cfg: string[] | string) {
		super(chain);

		_cfg = typeof _cfg == 'string' ? [_cfg]: _cfg;

		for (let i = 0; i < _cfg.length; i++) {
			let j = somes.random(0, _cfg.length - 1);
			let a = _cfg[i];
			_cfg[i] = _cfg[j]; // swap
			_cfg[j] = a;
		}
		
		var chain_str = ChainType[chain];
		this.chain = chain;
		this.mode = (chain_str in cfg.web3Mode) ?
			(cfg.web3Mode[chain_str] || Web3Mode.kMultiple_Random): Web3Mode.kMultiple_Fixed;
		var switchMode = (this.mode == Web3Mode.kMultiple_Random ? MPSwitchMode.kRandom: MPSwitchMode.kFixed);
		this.gasPriceLimit = Number(cfg.web3PriceLimit[chain_str]) || 0;
		this.setProvider(new MvpMultipleProvider(_cfg, undefined, switchMode));
		if (cfg.logs.rpc || env == 'dev')
			this.provider.printLog = true;
	}

	private setProviderByIdx(idx: number) {
		if (this.provider.setProviderIndex(idx)) {
			this._HasSupportGetTransactionReceiptsByBlock = undefined;
		}
	}

	swatchRpc() {
		if (this.mode === Web3Mode.kMultiple_Fixed) { // kMultiple_Fixed
			this.provider.setRandomProviderIndex(true);
		}
	}

	getTransactionReceiptsByBlock(block: number) {
		return somes.timeout(this.provider.request({
			method: 'eth_getTransactionReceiptsByBlock',
			params:  [`0x${block.toString(16)}`]
		}), 3e4); // 30s
	}

	async hasSupportGetTransactionReceiptsByBlock() {
		if (this._HasSupportGetTransactionReceiptsByBlock === undefined) {
			try {
				await this.getTransactionReceiptsByBlock(1);
				this._HasSupportGetTransactionReceiptsByBlock = true;
			} catch(err: any) {
				if (!err.httpErr)
					this._HasSupportGetTransactionReceiptsByBlock = false;
			}
		}
		return !!this._HasSupportGetTransactionReceiptsByBlock;
	}

	private _blockNumber(provider: BaseProvider) {
		return somes.timeout(new MultipleProvider(provider).request<number>({
			method: 'eth_blockNumber',
		}), 3e4); // 10s
	}

	async cat() {
		super.cat();
		if (this.provider.size < 2)
			return true;

		if (this.mode == Web3Mode.kMultiple_Random) {
			// ..
		} else if (this.mode === Web3Mode.kMultiple_Fixed) { // MULTIPLE Fixed
			try {
				await somes.timeout(this.eth.getBlockNumber(), 1e4); // 10s
				// await this.hasSupportGetTransactionReceiptsByBlock();
			} catch(err: any) { // fault
				//if (isRpcLimitRequestAccount(this, err)) { // Restrict access
				this.swatchRpc();
				//}
			}
		} else { // SINGLE
			try {
				var num = await this._blockNumber(this.provider.baseProviders[0]);
				var num1 = await this._blockNumber(this.provider.baseProviders[1]);
				this.setProviderByIdx(num + 16 < num1 ? 1: 0);
			} catch(err) {}
		}
		return true;
	}
}

export const web3s: Dict<MvpWeb3> = {};

export async function initialize(addWatch: (watch: WatchCat)=>void) {
	for (var [k,v] of Object.entries(cfg.web3s)) {
		var chain: ChainType = (ChainType as any)[k];
		somes.assert(chain, `ChainType no match "${k}"`);
		var web3 = new MvpWeb3(chain, v as string[]);
		await web3.cat();
		web3s[chain] = web3;
		bcweb3[chain] = web3;
		addWatch(web3);
		addWatch(web3.tx);
		web3.tx.cattime = 10;
	}
}

export default function(type: ChainType) {
	var web3 = web3s[type];
	somes.assert(web3, `web3 lib ${type} undefined, This network is not supported`);
	return web3;
}