/**
 * @copyright © 2021 Copyright dphone.com
 * @date 2023-02-08
 */

import ApiController from '../api';
import * as asset from '../models/asset';
import { ChainType,State } from '../db';

export default class extends ApiController {

	getAssetAmountTotal({chain,host,owner,author,state,name,owner_not,author_not}: {
		chain: ChainType, host: string, owner?: string, author?: string,
		owner_not?: string, author_not?: string, state?: State, name?: string
	}) {
		return asset.getAssetAmountTotal(chain, host, owner, author, owner_not, author_not, state, name);
	}

}