/**
 * @copyright © 2022 Smart Holder Server
 * @date 2022-07-21
 */

import {Task} from './task';
import {Tasks} from './models/def';
import {ChainType} from './models/def';
import {mvpApi} from './request';
import {TransactionReceipt } from 'web3-core';
import * as DAO from '../abi/DAO.json';

// make new dao tasks

export interface MakeDaoArgs {
	name: string;
	mission: string;
	description: string;
	operator: string;
	chain: ChainType;
}

export class MakeDAO extends Task<MakeDaoArgs> {

	constructor(tasks: Tasks<MakeDaoArgs>) {
		super(tasks);
	}

	exec(args: MakeDaoArgs) {

		this.step(async ()=>{
			// await mvpApi.post('keys/unlock', {pwd: '0000'});
			await mvpApi.post('keys/setUnlock', {pwd: '0000'});
			let {data:address} = await mvpApi.post('keys/genSecretKeyFromPartKey', {part_key: 'test'});
			// console.log(address);
			this.next(null, address);
		});

		this.step(async (from: string)=>{
			// deploy ContextProxyDAO
			let {data: receipt} = await mvpApi.post<TransactionReceipt>('tx/sendSync', {
				chain: args.chain,
				tx: {
					from: from,
					data: DAO.bytecode,//data,
				}
			});
			// console.log(receipt);
			this.next(null, receipt);
		});

		this.step(async (receipt: TransactionReceipt)=>{
			// TODO ...
			// deploy dao
			// this.next(null, {});

			console.log('step2', receipt);

			debugger;

			this.next();
			
		});

	}
}