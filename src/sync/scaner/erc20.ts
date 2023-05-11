/**
 * @copyright © 2021 Copyright smart holder
 * @date 2023-05-09
 */

import {ContractScaner,HandleEventData} from '.';
import {escape} from 'somes/db';
import {DAO,ContractType} from '../../db';
import sync from '..';
import somes from 'somes';
import {getAbiByType} from '../../web3+';

export class ERC20 extends ContractScaner {
	events = {
		Transfer: {
			handle: async (data: HandleEventData)=>{
				console.log('#ERC20.Transfer event', data.event.returnValues);
			}
		}
	}
}

// watch for weth unlock assets
export class WETH extends ContractScaner {
	// event Transfer(address indexed from, address indexed to, uint256 value);
	// event Approval(address indexed owner, address indexed spender, uint256 value);
	// event Deposit(address indexed dst, uint256 amount);
	// event Withdraw(address indexed src, uint256 amount);
	events = {
		Approval: {
			handle: async ({event}: HandleEventData)=>{
				// console.log('#WETH.Approval event', event.returnValues);
			}
		},
		Deposit: {
			handle: async ({event}: HandleEventData)=>{
				// console.log('#WETH.Deposit event', event.returnValues);
			}
		},
		Withdraw: {
			handle: async ({event}: HandleEventData)=>{
				// console.log('#WETH.Withdraw event', event.returnValues);
			}
		},
		Transfer: {
			handle: async ({event,blockNumber,tx}: HandleEventData)=>{
				// console.log('#WETH.Transfer event', event.returnValues);
				// unlock asset shell
				let to = event.returnValues.to;
				let DAOs = await this.db.selectCount(`dao_${this.chain}`, `first=${escape(to)} or second=${escape(to)}`);

				if (DAOs == 0) return;

				debugger

				let {blocks:[block]} = await sync.watchBlocks[this.chain]
					.getTransactionLogsFrom(blockNumber, blockNumber, [{address: to, state: 0}]);

				somes.assert(block, '#WETH.Transfer.handle no block');
				somes.assert(block.blockNumber == blockNumber, '#WETH.Transfer.handle blockNumber no match');

				let logs = block.logs[0].logs;
				// erc1155 events
				// 0xd713904ca4dede24d8ccd2773f9ce5ad16d546d39ab1bb0f7039c3cf790f8377 0xd713904c
				// event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)

				let abiI = (await getAbiByType(ContractType.AssetShell))!;
				let TransferSingle = abiI.abi.find(e=>e.name=='TransferSingle')!;
				let signature = this.web3.eth.abi.encodeEventSignature(TransferSingle);
				let logsCount = 0;

				for (let log of logs) {
					if (log.topic0 == signature) { // TransferSingle
						somes.assert(logsCount++ == 0, '#WETH.Transfer.handle logs length no match');

						let {from,to,id,value} = this.web3.eth.abi
							.decodeLog(TransferSingle.inputs!, log.data, [log.topic1,log.topic2,log.topic3]);
						let c = await this.web3.contract(log.address);
						try {
							var item = await c.methods.lockedOf(id,to,from).call(); // get locked item
						} catch(err) {
							if (!this.web3.isExecutionRevreted(err)) throw err;
						}

						if (item && item.blockNumber == blockNumber) {
							somes.assert(item.count == value, '#WETH.Transfer.handle item count no match');

							await this.db.insert(`asset_unlock_${this.chain}`, {
								host: await c.methods.host().call(), // get host address,
								token: log.address,
								tokenId: id,
								owner: to,
								previous: from,
								payType: 1, // kWETH
								payValue: event.returnValues.value,
								payBank: this.address,
								payer: tx.to,
								blockNumber: blockNumber,
								time: Date.now(),
							});
						}
					}
				} // for (let log of logs)
			},
		},
	};
}
