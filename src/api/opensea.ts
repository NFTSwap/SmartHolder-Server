/**
 * @copyright © 2021 Copyright dphone.com
 * @date 2022-08-16
 */

import ApiController from '../api';
import {ChainType} from '../models/def';
import * as opensea from '../models/opensea';
import { OrderComponents } from "seaport-smart/types";

export default class extends ApiController {
	
	getOrderParameters({chain,token,tokenId,amount,time}: {chain: ChainType, token: string, tokenId: string, amount: string, time?: number}) {
		return opensea.getOrderParameters(chain,token,tokenId,amount,time);
	}

	createOrder({chain,order,signature}: {chain: ChainType, order: OrderComponents, signature: string}) {
		return opensea.createOrder(chain,order,signature);
	}

	getOrder({chain, token, tokenId}: {chain: ChainType, token: string, tokenId: string}) {
		return opensea.getOrder(chain,token,tokenId);
	}

	getOrderState({chain, token, tokenId}: {chain: ChainType, token: string, tokenId: string}) {
		return opensea.getOrderState(chain,token,tokenId);
	}

}