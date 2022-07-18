/**
 * @copyright © 2021 Copyright ccl
 * @date 2021-09-26
 */

import {AssetFactory, formatHex} from './asset';
import {EventData} from 'web3-tx';
import {Transaction} from 'web3-core';
import {AbiInterface} from '../web3+';
import sync from '../sync';

export class AssetERC1155 extends AssetFactory {

	private async _Test(to: string, id: string, abi: AbiInterface) {
		var tokenId = formatHex(id, 32);
		var c = this.web3.createContract(this.address, abi.abi);
		await c.methods.uri(tokenId).call();
		await c.methods.balanceOf(to, tokenId).call()
		await c.methods.balanceOfBatch([to], [tokenId]).call();
	}

	events = {
		TransferSingle: {
			use: async (e: EventData, tx: Transaction)=>{ // emit Transfer(operator, from, to, id, amount);
				var {from, to, value} = e.returnValues;
				var tokenId = formatHex(e.returnValues.id, 32);
				var blockNumber = Number(e.blockNumber) || 0;
				await this.assetTransaction(
					e.transactionHash, blockNumber, value, tokenId,
					[from, await this.balanceOf(from, tokenId)],
					[to,   await this.balanceOf(to, tokenId)],
					tx.value,
				);
			},
			test: (e: EventData, abi: AbiInterface)=>this._Test(e.returnValues.to, e.returnValues.id, abi),
		},
		TransferBatch: { // TransferSingleAfter
			use: async (e: EventData, tx: Transaction)=>{ // emit TransferBatch(operator, from, to, ids, amounts);
				var {from, to, values} = e.returnValues;
				var ids = e.returnValues.ids
				var i = 0;
				for (var id of ids) {
					var tokenId = formatHex(id, 32);
					var blockNumber = Number(e.blockNumber) || 0;
					await this.assetTransaction(
						e.transactionHash, blockNumber, values[i++], tokenId,
						[from, await this.balanceOf(from, tokenId)],
						[to,   await this.balanceOf(to, tokenId)],
						tx.value + (ids.length > 1 ? '>?': ''), // batch
					);
				}
			},
			test: (e: EventData, abi: AbiInterface)=>this._Test(e.returnValues.to, e.returnValues.ids[0], abi),
		},
		URI: {
			use: async (e: EventData)=>{ // event URI(string value, uint256 indexed id);
				var {id} = e.returnValues;
				var tokenId = formatHex(id, 32);
				sync.assetMetaDataSync.fetch(this.address, tokenId, this.type, this.chain, true);
			},
		}
	};

	private static _Uri_time_0x495f947276749Ce646f68AC8c248420045cb7b5e = 0;
	private static _Uri_0x495f947276749Ce646f68AC8c248420045cb7b5e = '';

	async uri(id: string): Promise<string> {
		if (this.address == '0x495f947276749Ce646f68AC8c248420045cb7b5e') {
			if (!AssetERC1155._Uri_0x495f947276749Ce646f68AC8c248420045cb7b5e || 
				AssetERC1155._Uri_time_0x495f947276749Ce646f68AC8c248420045cb7b5e + 1e3 * 60 * 2 < Date.now()) { // 2 minute cache
					var c = await this.contract();
					AssetERC1155._Uri_0x495f947276749Ce646f68AC8c248420045cb7b5e = await c.methods.uri(id).call() as string;
					AssetERC1155._Uri_time_0x495f947276749Ce646f68AC8c248420045cb7b5e = Date.now();
			}
			return AssetERC1155._Uri_0x495f947276749Ce646f68AC8c248420045cb7b5e;
		}
		var c = await this.contract();
		var uri = await c.methods.uri(id).call() as string; // 可能会失败
		return uri;
	}

	async balanceOf(owner: string, id: string): Promise<number> {
		var c = await this.contract();
		try {
			var balance = BigInt(owner) ? Number(await c.methods.balanceOf(owner, id).call()): 0;
			return balance;
		} catch(err: any) {
			if (err.message.indexOf('exist') != -1)
				return 0;
			throw err;
		}
	}

}