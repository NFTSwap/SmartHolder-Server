/**
 * @copyright © 2021 Copyright ccl
 * @date 2021-09-17
 */

import {WatchCat} from 'bclib/watch';
import db, { AssetContract } from '../db';
import { update, insert } from '../models/contract';
import * as cfg from '../../config';
import center from '../request';
import {defaultAssetContract} from '../contracts';

export class StaticContractsSync implements WatchCat {
	readonly cattime = 10;
	private _initCfg = false;
	
	async cat() {

		if (!this._initCfg) {
			// write cfg contract address
			for (var ac of defaultAssetContract) {
				let {chain,address} = ac as AssetContract;
				if (await db.selectOne('asset_contract', { address, chain })) {
					await update({...ac, chain}, address, chain);
				} else {
					await insert({...ac, chain});
				}
			}
			this._initCfg = true;
		}

		// fetch center controller contract address
		if (cfg.center) {
			var acs = await center.post<AssetContract[]>('utils/assetContractsByPlatform', { platform: 'hard-chain' });
			for (let ac of acs.data) {
				var {sync_height, id, ...ac_} = ac;
				var chain = ac.chain;
				var row = await db.selectOne<AssetContract>('asset_contract', { address: ac.address, chain });
				if (row) {
					if (!row.sync_height)
						Object.assign(ac_, { sync_height: ac.init_height });
					await update({ ...ac_, chain: chain || row.chain, type: ac.type || row.type}, row.address, row.chain);
				} else {
					await insert({...ac_, sync_height: ac.init_height });
				}
			}
		}

		return true
	}

}