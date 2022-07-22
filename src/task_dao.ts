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
import {web3s} from './web3+';

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

			let {data:address} = await mvpApi.post('keys/genSecretKeyFromPartKey', {part_key:'test'});

			console.log(address);

			this.next(null, address);
		});

		this.step(async (from: string)=>{
			debugger

			let web3 = web3s[ChainType.RINKEBY];

			// (await web3.contract('')).deploy

			let c = web3.createContract('0x45d9dB730bac2A2515f107A3c75295E3504faFF7', DAO.abi as any);

			let call = c.deploy({ data: DAO.bytecode, arguments: [] });

			let data = call.encodeABI();

			console.log(data);

			debugger;

			//await call.send({from});

			// deploy ContextProxyDAO
			// let receipt = await mvpApi.post<TransactionReceipt>('tx/sendSync', {
			// 	chain: args.chain,
			// 	tx: {
			// 		from: from,
			// 		// to: '0x0000000000000000000000000000000000000000',
			// 		data: DAO.bytecode,//data,
			// 		retry: 1,
			// 	}
			// });

			let receipt =  await web3.sendSignTransaction({
				from: '0x6Ac59A1e132f2408364e89e31c108881667d64Df',
				data: DAO.bytecode,//data,
			});

			console.log(receipt);

			debugger

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