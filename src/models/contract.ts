/**
 * @copyright © 2022 Copyright ccl
 * @date 2022-07-21
 */

import db, { ContractInfo, ChainType } from '../db';
import redis from 'bclib/redis';
import {hash} from '../utils';

export let isEnableCache = true;

export async function setCache(enable: boolean) {
	isEnableCache = !!enable;
	if (!isEnableCache) {
		await redis.fulushAll();
	}
}

export async function update(info: Partial<ContractInfo>, address: string, chain: ChainType) {
	let {address: _, addressNumber: __, ...info_} = info;
	let num = await db.update(`contract_info_${chain}`, info_, { address });
	if (isEnableCache) {
		await redis.del(`${address}_${chain}`);
	}
	return num;
}

export async function insert(info: Partial<ContractInfo>, chain: ChainType) {
	let addressNumber = hash(info.address!).number;
	var id = await db.insert(`contract_info_${chain}`, {...info,addressNumber});
	return id;
}

export async function select(address: string, chain: ChainType, noCache?: boolean): Promise<ContractInfo | null> {
	if (isEnableCache && !noCache) {
		var info = await redis.get<ContractInfo>(`contract_info_${address}_${chain}`);
		if (!info) {
			info = await db.selectOne<ContractInfo>(`contract_info_${chain}`, {address});
			await redis.set(`contract_info_${address}_${chain}`, info);
		}
		return info;
	} else {
		var info = await db.selectOne<ContractInfo>(`contract_info_${chain}`, {address});
		return info;
	}
}