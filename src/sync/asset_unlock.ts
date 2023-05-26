/**
 * @copyright © 2022 Copyright Smart Holder
 * @date 2023-05-10
 */

import db, { AssetUnlock, ChainType,ContractType,State } from '../db';
import _hash from 'somes/hash';
import {WatchCat} from 'bclib/watch';
import {web3s, MvpWeb3} from '../web3+';
import somes from 'somes';
import * as deployInfo from '../../deps/SmartHolder/deployInfo.json';
import * as erc20_cfg from '../../cfg/util/erc20';
import buffer, {IBuffer} from 'somes/buffer';
import * as cryptoTx from 'crypto-tx';
import * as aes from 'crypto-tx/aes';
import * as cfg from '../../config';
import {getAbiByType} from '../web3+';

export class AssetUnlockWatch implements WatchCat {
	readonly cattime = 10; // 60 seconds cat()
	readonly web3: MvpWeb3;
	readonly chain: ChainType;
	private _prevExec = 0;
	readonly ownerForDAOs: string[] = [];
	private _secretKey: IBuffer[];
	
	constructor(chain: ChainType) {
		this.web3 = web3s[chain];
		this.chain = chain;
		this._secretKey = (cfg.secretKey||[]).map((e)=>{
			let value = !cfg.salt ? buffer.from(e, 'hex'):
			buffer.from(aes.aes256cbcDecrypt(buffer.from(e, 'base64'), cfg.salt).plaintext_base64, 'base64')
			this.ownerForDAOs.push(cryptoTx.getAddress(value) as string);
			return value;
		});
	}

	private async call(addr: string, method: string, ...args: any[]) {
		let c = await this.web3.contract(addr);
		return await c.methods[method](...args).call(); // get locked item
	}

	private async getAssetUnlockData(DAOsAddress: string) {
		let disable = async (id: number, message = '', state = State.Disable)=>{
			let affectedRows = await db.update(`asset_unlock_${this.chain}`, {state,message}, {id});
			somes.assert(affectedRows == 1, '#AssetUnlockWatch.cat disable fail');
			console.log('#AssetUnlockWatch.getAssetUnlockData.disable()', DAOsAddress, id);
		};

		let ls = await db.select<AssetUnlock>(`asset_unlock_${this.chain}`, {state: 0}, {
			order: 'blockNumber', limit: 100,
		});

		let [from] = this.ownerForDAOs;

		interface Data {
			token: string,
			r: string, s: string, v: number,
			data: {
				id: number,
				tokenId: string; // LockedID
				from: string; //
				to: string; //
				source: string;  // payer source, opensea contract => sender
				erc20: string;   // erc20 token contract address, weth
				amount: string;  // amount value of erc20 token
				eth: string;     // erc20 exchange to eth amount value
			}[];
		}
		let dict: Dict<Data> = {};
		let length = 0;
		const addressZero = '0x0000000000000000000000000000000000000000';

		for (let {
			id,host,token,tokenId,toAddress,fromAddress,amount,erc20,source,blockNumber} of ls)
		{
			let it = dict[token] || { r:'',s:'',v:0,token, data: [] };

			let item = await this.call(token, 'lockedOf', tokenId,toAddress,fromAddress); // get locked item
			if (item.blockNumber != blockNumber) {
				await disable(id, 'lockedOf => item.blockNumber != blockNumber'); continue;
			}
			if (from != await this.call(host, 'unlockOperator')) {
				await disable(id, 'unlockOperator no match'); continue;
			}

			let eth = amount;

			if (addressZero != erc20) { // no eth
				// querying exchange rates from unswap
				if (this.chain == ChainType.GOERLI) {
					if (erc20.toLowerCase() != erc20_cfg.goerli_weth.toLowerCase()) { // no WETH
						// TODO ... querying exchange rates
					}
				} else if (this.chain == ChainType.ETHEREUM) {
					// TODO ...
				} else if (this.chain == ChainType.MATIC) {
					if (erc20.toLowerCase() == erc20_cfg.matic_weth.toLowerCase()) { // no MaticWETH
						// TODO ... querying exchange rates, matic => ETH
					}
				}
			}

			let c = await this.web3.contract(token);
			let seller_fee_basis_points = await c.methods.seller_fee_basis_points().call();
			let price = BigInt(eth) * BigInt(10_000) / BigInt(seller_fee_basis_points); // transfer price
			let min_price = BigInt(await c.methods.minimumPrice(tokenId).call()) * BigInt(item.count);
			if (price < min_price) {
				// revert PayableInsufficientAmount();
				await disable(id, `price < min_price`); continue;
			}

			length++;
			dict[token] = it;

			it.data.push({ id,tokenId,to:toAddress,from:fromAddress,amount,erc20,source, eth });
		}

		return {data: Object.values(dict), length};
	}

	async cat() {
		let network = ChainType[this.chain].toLowerCase() as 'goerli';
		let info = deployInfo[network];
		if (!info || this._secretKey.length == 0) return true;
		let DAOsAddress = info.DAOsProxy.address;
		let [from] = this.ownerForDAOs;
		let [key] = this._secretKey;

		let unlock = await this.getAssetUnlockData(DAOsAddress);
		if (unlock.length < 100) {
			if (unlock.length == 0 || Date.now() - this._prevExec < 1e3*3600/**24*/) { // 1 days
				return true; // skip
			}
		}

		let abi = (await getAbiByType(ContractType.AssetShell))!;
		let unlockForOperator = abi.abi.find(e=>e.name=='unlockForOperator')!;
		let arg0_t = unlockForOperator.inputs![0];

		// sign tx
		let data = unlock.data.map(e=>{
			let hash = cryptoTx.keccak(this.web3.eth.abi.encodeParameter(arg0_t, e.data)).data;
			let {recovery, signature} = cryptoTx.sign(buffer.from(hash), key);
			return {
				...e,
				r: '0x'+signature.slice(0,32).toString('hex'),
				s: '0x'+signature.slice(32,64).toString('hex'),
				v: recovery +27,
			};
		});

		// send data to block chain
		let DAOs = await this.web3.contract(DAOsAddress);
		let method = DAOs.methods.unlockAssetForOperator(data);
		await method.call({from}); // try call

		let tx = await this.web3.signTx({ from, to: DAOsAddress, data: method.encodeABI() }, {
			sign: async (message)=>cryptoTx.sign(message, key),
		});
		let receipt = await this.web3.sendSignedTransaction(tx.data);

		somes.assert(receipt.status, '#AssetUnlockWatch.cat() sendSignedTransaction fail, receipt.status==0');

		await db.transaction(async db=>{
			for (let i of data) {
				for (let j of i.data) {
					db.update(`asset_unlock_${this.chain}`, {state: State.Complete}, {id:j.id});
				}
			}
		});
		this._prevExec = Date.now();

		return true;
	}
}