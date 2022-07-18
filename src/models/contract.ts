/**
 * @copyright © 2021 Copyright ccl
 * @date 2021-09-17
 */

import db, { AssetContract, ChainType } from '../db';
import * as redis from 'bclib/redis';

var isEnableCache = true;

export function enableCache(enable: boolean) {
	isEnableCache = !!enable;
}

export async function update(ac: Partial<AssetContract>, address: string, chain: ChainType) {
	var {address: _, chain: __, ...ac_} = ac
	var num = await db.update('asset_contract', ac_, { address, chain });
	if (isEnableCache) {
		await redis.del(`${address}_${chain}`);
	}
	return num;
}

export async function insert(ac_: Partial<AssetContract>) {
	var id = await db.insert('asset_contract', ac_);
	return id;
}

export async function getAssetContract(address: string, chain: ChainType): Promise<AssetContract | null> {
	if (isEnableCache) {
		var ac = await redis.get<AssetContract>(`${address}_${chain}`);
		if (!ac) {
			ac = await db.selectOne<AssetContract>('asset_contract', {address, chain});
			await redis.set(`${address}_${chain}`, ac);
		}
		return ac;
	} else {
		var ac = await db.selectOne<AssetContract>('asset_contract', {address, chain});
		return ac;
	}
}