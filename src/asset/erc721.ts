/**
 * @copyright © 2021 Copyright ccl
 * @date 2021-09-26
 */

import {AssetFactory, formatHex} from './asset';
import {EventData} from 'web3-tx';
import {Transaction} from 'web3-core';
import {AbiInterface} from '../web3+';
import somes from 'somes';

export class AssetERC721 extends AssetFactory {

	events = {
		Transfer: {
			use: async (e: EventData, tx: Transaction)=>{
				var {from, to} = e.returnValues;
				if (e.returnValues.tokenId) {
					var tokenId = formatHex(e.returnValues.tokenId, 32);
					var blockNumber = Number(e.blockNumber) || 0;
					await this.assetTransaction(e.transactionHash, blockNumber, '1', tokenId, [from, 0], [to, 1], tx.value);
				} else {
					console.warn(`AssetERC721#Transfer, token=${this.address}, returnValues.tokenId=`, e.returnValues.tokenId, e.returnValues);
				}
			},
			test: async (e: EventData, abi: AbiInterface)=>{
				somes.assert(e.returnValues.tokenId);
				var tokenId = formatHex(e.returnValues.tokenId, 32);
				var c = this.web3.createContract(this.address, abi.abi);
				await c.methods.tokenURI(tokenId).call();
				await c.methods.ownerOf(tokenId).call()
				await c.methods.getApproved(tokenId).call();
			}
		}
	}

	async uri(tokenId: string): Promise<string> {
		var c = await this.contract();
		var uri = await c.methods.tokenURI(tokenId).call() as string;
		return uri;
	}

	async balanceOf(owner: string, id: string): Promise<number> {
		var c = await this.contract();
		try {
			var _owner = await c.methods.ownerOf(id).call() as string;
			var balance = _owner == owner ? 1: 0;
			return balance;
		} catch (err: any) {
			if (err.message.indexOf('exist') != -1)
				return 0;
			throw err;
		}
	}
}
