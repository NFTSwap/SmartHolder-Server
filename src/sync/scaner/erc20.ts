/**
 * @copyright © 2021 Copyright smart holder
 * @date 2023-05-09
 */

import {ContractScaner,HandleEventData} from '.';
import {escape} from 'somes/db';
import {ContractType,DAO} from '../../db';
import {AssetERC1155} from './asset';

// watch for weth unlock assets
export class ERC20 extends ContractScaner {
	// event Transfer(address indexed from, address indexed to, uint256 value);
	// event Approval(address indexed owner, address indexed spender, uint256 value);
	// event Deposit(address indexed dst, uint256 amount);
	// event Withdraw(address indexed src, uint256 amount);
	events = {
		Approval: { // ERC20.Approval
			handle: async ({event}: HandleEventData)=>{
				console.log('#ERC20.Approval event', event.returnValues);
			}
		},
		Deposit: { // WETH.Deposit
			handle: async ({event}: HandleEventData)=>{
				console.log('#ERC20.Deposit event', event.returnValues);
			}
		},
		Withdraw: { // WETH.Withdraw
			handle: async ({event}: HandleEventData)=>{
				console.log('#ERC20.Withdraw event', event.returnValues);
			}
		},
		Transfer: {
			handle: async ({event:e,blockNumber,tx}: HandleEventData)=>{
				// console.log('#WETH.Transfer event', event.returnValues);
				// unlock asset shell
				let to = e.returnValues.to; // if to address equal first or second then ref dao
				let dao = await this.db.selectOne<DAO>(`dao_${this.chain}`, `first=${escape(to)} or second=${escape(to)}`);
				if (!dao) return;

				await new AssetERC1155(to, ContractType.AssetShell, this.chain, this.db).onReceiveERC20({
					blockNumber,dao, amount: BigInt(e.returnValues.value),
					source: tx.to!, erc20: this.address, txHash: e.transactionHash
				});
			},
		},
	};
}
