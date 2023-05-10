/**
 * @copyright © 2022 Copyright Smart Holder
 * @date 2023-05-10
 */

import db, { AssetUnlock, ChainType,State } from '../db';
import _hash from 'somes/hash';
import {WatchCat} from 'bclib/watch';
import {web3s, MvpWeb3} from '../web3+';
import somes from 'somes';
import * as deployInfo from '../../deps/SmartHolder/deployInfo.json';
import buffer, {IBuffer} from 'somes/buffer';
import * as cryptoTx from 'crypto-tx';
import * as aes from 'crypto-tx/aes';
import * as cfg from '../../config';
import errno from 'web3-tx/errno';

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

	private is_EXECUTION_REVERTED(err: any) {
		if (err.errno == errno.ERR_EXECUTION_REVERTED[0] ||
			err.errno == errno.ERR_EXECUTION_Returned_Values_Invalid[0]) return true;
		return false;
	}

	private async tryCall(addr: string, method: string, ...args: any[]) {
		let c = await this.web3.contract(addr);
		try {
			return await c.methods.lockedOf(...args).call(); // get locked item
		} catch(err) {
			if (this.is_EXECUTION_REVERTED(err)) {
				return false;
			}
			throw err;
		}
	}

	private async getAssetUnlockData(DAOsAddress: string) {
		let disable = async (id: number)=>{
			let affectedRows = await db.update(`asset_unlock_${this.chain}`, {state: State.Disable}, {id});
			somes.assert(affectedRows == 1, '#AssetUnlockWatch.cat disable fail');
			console.log('#AssetUnlockWatch.getAssetUnlockData.disable()', DAOsAddress, id);
		};

		let ls = await db.select<AssetUnlock>(`asset_unlock_${this.chain}`, {state: 0}, {
			order: 'blockNumber', limit: 100,
		});

		interface Data {
			token: string, valueInt: bigint, value: string,
			data: {
				id: number,
				lock: {tokenId: string,owner: string,previous: string},
				payType: string, payValue: string,payBank: string,payer: string
			}[];
		}
		let dict: Dict<Data> = {};
		let length = 0;

		for (let {
			id,host,token,tokenId,owner,previous,payType,payValue,payBank,payer,blockNumber} of ls)
		{
			let it = dict[token];
			if (!dict[token]) {
				it = { token, valueInt: BigInt(0), value: '0', data: [] };
			}

			let item = await this.tryCall(token, 'lockedOf', tokenId,owner,previous); // get locked item
			if (!item && item.blockNumber != blockNumber) {
				await disable(id); continue;
			}
			let unlockOperator = await this.tryCall(host, 'unlockOperator');
			if (!unlockOperator || DAOsAddress != unlockOperator) {
				await disable(id); continue;
			}

			length++;

			it.valueInt = it.valueInt + BigInt(payValue);
			it.data.push({
				id,lock: {tokenId,owner,previous}, payType,payValue,payBank,payer
			});

			dict[token] = it;
		}

		let data = Object.values(dict).map(e=>(e.value = e.valueInt + '', e));

		return {data, length};
	}

	async cat() {
		let network = ChainType[this.chain].toLowerCase() as 'goerli';
		let info = deployInfo[network];
		if (!info || this._secretKey.length == 0) return true;
		let DAOsAddress = info.DAOsProxy.address;
		let [from] = this.ownerForDAOs;
		let [key] = this._secretKey;

		let {data,length} = await this.getAssetUnlockData(DAOsAddress);

		if (length < 100) {
			if (length == 0 || Date.now() - this._prevExec < 1e3*3600*24) { // 1 days
				return true; // skip
			}
		}

		// send data to block chain
		let DAOs = await this.web3.contract(DAOsAddress);
		let method = DAOs.methods.unlockAssetForOperator(data);

		await method.call({from}); // try call

		let tx = await this.web3.signTx({ to: DAOsAddress, data: method.encodeABI() }, {
			sign: async (message)=>cryptoTx.sign(message, key),
		});
		let receipt = await this.web3.sendSignedTransaction(tx.data);

		if (receipt.status) {
			await db.transaction(async db=>{
				for (let i of data) {
					for (let j of i.data) {
						db.update(`asset_unlock_${this.chain}`, {state: 1}, {id:j.id});
					}
				}
			});
			this._prevExec = Date.now();
		}

		return true;
	}
}