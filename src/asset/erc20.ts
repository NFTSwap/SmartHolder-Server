/**
 * @copyright © 2021 Copyright ccl
 * @date 2021-12-28
 */

import {AssetFactory, formatHex} from './asset';
import {EventData} from 'web3-tx';
import {Transaction} from 'web3-core';
import {AbiInterface} from '../web3+';

export class AssetERC20 extends AssetFactory {

	events = {
		Transfer: {
			use: async (e: EventData, tx: Transaction)=>{
				var {from,to,value} = e.returnValues;
				var tokenId = formatHex('0x0', 32);
				var blockNumber = Number(tx.blockNumber) || 0;
				await this.assetTransaction(
					tx.hash, blockNumber, value, tokenId,
					[from, await this.balanceOf(from, tokenId)],
					[to, await this.balanceOf(to, tokenId)],
					tx.value,
				);
			},
			test: async(e: EventData, abi: AbiInterface)=>{
				var {to} = e.returnValues;
				var c = this.web3.createContract(this.address, abi.abi); // try eth erc721
				await c.methods.balanceOf(to).call();
				await c.methods.allowance(to, to).call();
			}
		}
	}

	get enableWatch() {
		return false;
	}

	async uri(id: string): Promise<string> {
		return '';
	}

	async balanceOf(owner: string, id: string): Promise<number> {
		var c = await this.contract();
		var balance = await c.methods.balanceOf(owner).call();
		return balance;
	}
}
