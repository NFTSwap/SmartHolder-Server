/**
 * @copyright © 2021 Copyright dphone.com
 * @date 2023-04-25
 */

import ApiController from '../api';
import * as ledger from '../models/ledger';
import {ChainType,SaleType,LedgerType,State} from '../db';

export default class extends ApiController {

	getLedgerAssetIncomeFrom({
		chain,host,fromAddress,fromAddress_not,toAddress,toAddress_not,type,time,orderBy,limit
	}:{
		chain: ChainType, host: string,
		fromAddress?: string, toAddress?: string,
		fromAddress_not?: string, toAddress_not?: string,
		type?: SaleType,
		time?: [number,number],
		orderBy?: string, limit?: number | number[]
	}) {
		return ledger.getLedgerAssetIncomeFrom.query({
			chain,host,fromAddress,fromAddress_not,toAddress,toAddress_not,type,time,orderBy,limit});
	}

	getLedgerAssetIncomeTotalFrom({
		chain,host,fromAddress,fromAddress_not,toAddress,toAddress_not,type,time
	}:{
		chain: ChainType, host: string,
		fromAddress?: string, toAddress?: string,
		fromAddress_not?: string, toAddress_not?: string,
		type?: SaleType,
		time?: [number,number],
	}) {
		return ledger.getLedgerAssetIncomeFrom.queryTotal({
			chain,host,fromAddress,fromAddress_not,toAddress,toAddress_not,type,time});
	}

	getLedgerSummarys({chain,host,type,time,state}: {
		chain: ChainType, host: string, type?: LedgerType, time?: [number,number], state?: State}) {
		return ledger.getLedgerSummarys({chain,host,type,time,state});
	}

}