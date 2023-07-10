/**
 * @copyright © 2021 Copyright dphone.com
 * @date 2022-08-16
 */

import ApiController from '../api';
import {ChainType,AssetType} from '../models/define';
import * as opensea from '../models/opensea';
import * as order from '../models/order';
import {OrderComponents} from '../models/opensea_type';

export default class extends ApiController {
	
	getOrderParameters({
		chain,token,tokenId,unitPrice,owner,count,type,time
	}: {
		chain: ChainType, token: string, tokenId: string, unitPrice: string,
		owner: string, count: number, type: AssetType, time?: number
	}) {
		return opensea.getOrderParameters(chain,token,tokenId,unitPrice,owner,count,type,time);
	}

	createOrder({chain,order,signature}: {chain: ChainType, order: OrderComponents, signature: string}) {
		return opensea.createOrder(chain,order,signature);
	}

	getOrder({chain, token, tokenId}: {chain: ChainType, token: string, tokenId: string}) {
		return opensea.getOrder(chain,token,tokenId);
	}

	getOrders({chain, token, tokenIds}: {chain: ChainType, token: string, tokenIds: string[]}) {
		return opensea.getOrders(chain,token,tokenIds);
	}

	getOrderState({chain, token, tokenId}: {chain: ChainType, token: string, tokenId: string}) {
		return opensea.getOrderState(chain,token,tokenId);
	}

	get_CROSS_CHAIN_SEAPORT_ADDRESS() { // 取消出售合约地址 seaport
		return opensea.get_CROSS_CHAIN_SEAPORT_ADDRESS();
	}

	get_CROSS_CHAIN_SEAPORT_ABI() { // 取消出售合约abi seaport
		return opensea.get_CROSS_CHAIN_SEAPORT_ABI();
	}

	get_OPENSEA_CONDUIT_ADDRESS() { // 调用合约授权资产权限给opensea
		return opensea.get_OPENSEA_CONDUIT_ADDRESS();
	}

	maskOrderClose({chain, token, tokenId}: {chain: ChainType, token: string, tokenId: string}) {
		return order.maskSellOrderClose(chain, token, tokenId, BigInt(0), '');
	}

}