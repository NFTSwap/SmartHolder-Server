/**
 * @copyright © 2022 Copyright smart holder
 * @date 2022-08-14
 */

import somes from 'somes';
import web3s from '../web3+';
import { ChainType, Selling } from "./def";
import { Seaport } from "seaport-smart";
import { OrderComponents } from "seaport-smart/types";
import { ItemType, OrderType, CROSS_CHAIN_SEAPORT_ADDRESS, OPENSEA_CONDUIT_ADDRESS } from "seaport-smart/constants";
import { providers, VoidSigner, BigNumberish } from "ethers";
import { BytesLike } from "@ethersproject/bytes";
import * as abi from '../../abi/Asset.json';
import {rng} from 'somes/rng';
import {get as get_ ,post as post_} from '../utils';
import {Params,Result} from 'somes/request';
import {URL} from 'somes/path';
import errno from '../errno';
import {SeaportABI} from '../../abi/Seaport';
import * as cfg from '../../config';
import {scopeLock} from 'bclib/atomic_lock';
import * as redis from 'bclib/redis';
import db from '../db';

export {OrderComponents};

const seaports: Map<ChainType, Seaport> = new Map();
export {CROSS_CHAIN_SEAPORT_ADDRESS, OPENSEA_CONDUIT_ADDRESS};

export type TypedDataDomain = {
	name?: string;
	version?: string;
	chainId?: BigNumberish;
	verifyingContract?: string;
	salt?: BytesLike;
};

export type TypedDataField = {
	name: string;
	type: string;
};

export interface OrderParametersAll {
	primaryType: string;
	domain: TypedDataDomain;
	types: Record<string, Array<TypedDataField>>;
	value: OrderComponents;
	isApprovedForAll: boolean;
	OPENSEA_CONDUIT_ADDRESS: string;
}

function getPrefix(chain: ChainType) {
	if (chain == ChainType.ETHEREUM) {
		return { prefix: 'https://api.opensea.io/v2', network: 'ethereum' };
		// return { prefix: 'https://element-api.eossql.com/bridge/opensea/v2', network: 'ethereum' };
	} else {
		return { prefix: 'https://testnets-api.opensea.io/v2', network: 'rinkeby' };
		// return { prefix: 'https://element-api-test.eossql.com/bridge/opensea/v2', network: 'rinkeby' };
	}
}

function _handleStatusCode(r: Result) {
	r.data = r.data.toString('utf8');
	if (r.statusCode != 200) {
		if (r.statusCode == 404) {
			throw Error.new(errno.ERR_HTTP_STATUS_404).ext(r);
		} else if (r.statusCode == 400) { // logic error
			let data = JSON.parse(r.data);
			r.data = Array.isArray(data) ? data: [data];
			throw Error.new([errno.ERR_OPENSEA_API_ERROR, ...r.data]).ext({r, abort: true, ...data});
		}
		throw Error.new(errno.ERR_HTTP_STATUS_NO_200).ext(r);
	} else {
		r.data = JSON.parse(r.data);
	}
}

async function get<T = any>(chain: ChainType, path: string, params?: Params): Promise<T> {
	let {prefix, network} = getPrefix(chain);
	let url = new URL(`${prefix}/${String.format(path, network)}`);
	if (params)
		url.params = params;
	let r = await get_(url.href, {
		handleStatusCode: _handleStatusCode,
		headers: { 'X-API-KEY': cfg.opensea_api_key },
	}, false, 2);
	return r.data as any as T;
}

async function post<T = any>(chain: ChainType, path: string, params?: Params): Promise<T> {
	let {prefix, network} = getPrefix(chain);
	let r = await post_(`${prefix}/${String.format(path, network)}`, params, {
		handleStatusCode: _handleStatusCode,
		headers: { 'X-API-KEY': cfg.opensea_api_key },
	}, false, 2);
	return r.data as any as T;
}

class MySigner extends VoidSigner {
	async _signTypedData(domain: TypedDataDomain, types: Record<string, Array<TypedDataField>>, value: Record<string, any>) {
		return '0x';
	}
}

export function getSeaport(chain: ChainType) {
	let sea = seaports.get(chain);
	if (!sea) {
		let web3 = web3s(chain);
		const accountAddress = '0x45d9dB730bac2A2515f107A3c75295E3504faFF7';
		const provider = new providers.JsonRpcProvider(web3.provider.rpc);
		const signer = new MySigner(accountAddress, provider);
		seaports.set(chain, sea = new Seaport(signer));
	}
	return sea;
}

export async function getOrderParameters(chain: ChainType, token: string, tokenId: string, amount: string, time?: number): Promise<OrderParametersAll> {
	let web3 = web3s(chain);
	let now = Math.floor(Date.now() / 1e3);
	let lastTime = now + (time ? time / 1e3 : 30 * 24 * 3600);
	let methods = web3.createContract(token, abi.abi as any).methods;
	let owner = await methods.ownerOf(tokenId).call() as string;
	// let owner = '0x4ab17f69d1225eD66DE25A6C3c69f3F83766CBea';
	let id = BigInt(tokenId).toString(10);
	let isApprovedForAll = await methods.isApprovedForAll(owner, OPENSEA_CONDUIT_ADDRESS).call();

	// let sea = getSeaport(chain);

	let taxs = {
		'0x0000a26b00c1F0DF003000390027140000fAa719': 25, // opensea 2.5% 0x8De9C5A032463C561423387a9648c5C7BCC5BC90
		// '0xabb7635910c4d7e8a02bd9ad5b036a089974bf88': 70, // element 7%
	};

	let amount_ = BigInt(amount);
	let amountMy = amount_;
	let recipients: {amount: bigint; recipient: string; }[] = [
		...Object.entries(taxs).map(([recipient,tax])=>{
			let amount = BigInt(1000) * BigInt(tax);
			amountMy -= amount;
			return { recipient, amount };
		}),
		{ amount: amountMy, recipient: owner },
	];

	let data = {
		primaryType: 'OrderComponents',
		domain: {
			chainId: chain,
			name: "Seaport",
			verifyingContract: "0x00000000006c3852cbEf3e08E8dF289169EdE581",
			version: "1.1"
		},
		types: {
			"EIP712Domain": [
				{
					"name": "name",
					"type": "string"
				},
				{
					"name": "version",
					"type": "string"
				},
				{
					"name": "chainId",
					"type": "uint256"
				},
				{
					"name": "verifyingContract",
					"type": "address"
				}
			],
			"OrderComponents": [
				{
					"name": "offerer",
					"type": "address"
				},
				{
					"name": "zone",
					"type": "address"
				},
				{
					"name": "offer",
					"type": "OfferItem[]"
				},
				{
					"name": "consideration",
					"type": "ConsiderationItem[]"
				},
				{
					"name": "orderType",
					"type": "uint8"
				},
				{
					"name": "startTime",
					"type": "uint256"
				},
				{
					"name": "endTime",
					"type": "uint256"
				},
				{
					"name": "zoneHash",
					"type": "bytes32"
				},
				{
					"name": "salt",
					"type": "uint256"
				},
				{
					"name": "conduitKey",
					"type": "bytes32"
				},
				{
					"name": "counter",
					"type": "uint256"
				}
			],
			"OfferItem": [
					{
							"name": "itemType",
							"type": "uint8"
					},
					{
							"name": "token",
							"type": "address"
					},
					{
							"name": "identifierOrCriteria",
							"type": "uint256"
					},
					{
							"name": "startAmount",
							"type": "uint256"
					},
					{
							"name": "endAmount",
							"type": "uint256"
					}
			],
			"ConsiderationItem": [
					{
							"name": "itemType",
							"type": "uint8"
					},
					{
							"name": "token",
							"type": "address"
					},
					{
							"name": "identifierOrCriteria",
							"type": "uint256"
					},
					{
							"name": "startAmount",
							"type": "uint256"
					},
					{
							"name": "endAmount",
							"type": "uint256"
					},
					{
							"name": "recipient",
							"type": "address"
					}
			]
		},
		value: {
			offerer: owner,
			// zone: "0x00000000E88FE2628EbC5DA81d2b3CeaD633E89e",
			zone: '0x004c00500000ad104d7dbd00e3ae0a5c00560c00',
			zoneHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
			startTime: String(now),
			endTime: String(lastTime),
			orderType: OrderType.PARTIAL_RESTRICTED,
			offer: [
				{
					itemType: ItemType.ERC721,
					token: token,
					identifierOrCriteria: id,
					startAmount: "1",
					endAmount: "1"
				}
			],
			consideration: [
				...recipients.map(e=>({
					itemType: ItemType.NATIVE,
					token: '0x0000000000000000000000000000000000000000',
					identifierOrCriteria: '0',
					startAmount: e.amount.toString(10),
					endAmount: e.amount.toString(10),
					recipient: e.recipient,
				})),
			],
			totalOriginalConsiderationItems: "2",
			salt: BigInt('0x' + rng(16).toString('hex')).toString(10),// "36980727087255389",
			conduitKey: "0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000",
			counter: 0
		},
		isApprovedForAll,
		OPENSEA_CONDUIT_ADDRESS,
	};

	return data;
}

export async function createOrder(chain: ChainType, order: OrderComponents, signature: string): Promise<void> {

	/*
		curl 'https://element-api.eossql.com/bridge/opensea/v2/orders/ethereum/seaport/listings' \
		-H 'authority: element-api.eossql.com' \
		-H 'accept: application/json' \
		-H 'accept-language: en,en-US;q=0.9,zh-CN;q=0.8,zh;q=0.7,ja;q=0.6,zh-TW;q=0.5,da;q=0.4' \
		-H 'content-type: application/json' \
		-H 'dnt: 1' \
		-H 'origin: https://element.market' \
		-H 'referer: https://element.market/' \
		-H 'sec-ch-ua: "Chromium";v="104", " Not A;Brand";v="99", "Google Chrome";v="104"' \
		-H 'sec-ch-ua-mobile: ?0' \
		-H 'sec-ch-ua-platform: "macOS"' \
		-H 'sec-fetch-dest: empty' \
		-H 'sec-fetch-mode: cors' \
		-H 'sec-fetch-site: cross-site' \
		-H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36' \
		-H 'x-api-key: 2f6f419a083c46de9d83ce3dbe7db601' \
		--data-raw '{"parameters":{"offerer":"0x4ab17f69d1225ed66de25a6c3c69f3f83766cbea","zone":"0x004C00500000aD104D7DBd00e3ae0A5C00560C00","orderType":2,"startTime":"1661399993","endTime":"1662004792","zoneHash":"0x0000000000000000000000000000000000000000000000000000000000000000","salt":"38386380151470404","offer":[{"itemType":2,"token":"0x12073c130ee0612219a0b54e56582ce24155dfa8","identifierOrCriteria":"2202","startAmount":"1","endAmount":"1"}],"consideration":[{"itemType":0,"token":"0x0000000000000000000000000000000000000000","identifierOrCriteria":"0","startAmount":"905000000000000000","endAmount":"905000000000000000","recipient":"0x4ab17f69d1225ed66de25a6c3c69f3f83766cbea"},{"itemType":0,"token":"0x0000000000000000000000000000000000000000","identifierOrCriteria":"0","startAmount":"25000000000000000","endAmount":"25000000000000000","recipient":"0x0000a26b00c1F0DF003000390027140000fAa719"},{"itemType":0,"token":"0x0000000000000000000000000000000000000000","identifierOrCriteria":"0","startAmount":"70000000000000000","endAmount":"70000000000000000","recipient":"0xabb7635910c4d7e8a02bd9ad5b036a089974bf88"}],"conduitKey":"0x0000007b02230091a7ed01230072f7006a004d60a8d4e71d599b8104250f0000","counter":0,"totalOriginalConsiderationItems":3},"signature":"0xdeac9eb868515e06aa98b578fca4466cb18c92fb8a3ef5f72f8e7ff053e664f460296f705d7ac99a82a18e889c2a729b423d979e742b71930228463f4a82cf7c1b"}' \
		--compressed
	*/

	let token = order.offer[0].token;
	let tokenId = order.offer[0].identifierOrCriteria;
	let order0 = await getOrder(chain, token, tokenId);

	somes.assert(!order0, errno.ERR_OPENSEA_ORDER_EXIST);

	await post(chain, 'orders/{0}/seaport/listings', {
		parameters: order,
		signature,
	});

	let sellPrice = BigInt(0);
	for (let c of order.consideration) {
		sellPrice += BigInt(c.startAmount);
	}

	await maskOrderSelling(chain, token, tokenId, Selling.Opensea, sellPrice.toString());
}

export async function maskOrderSelling(chain: ChainType, token: string, tokenId: string, selling: Selling = Selling.UnsellOrUnknown, sellPrice = '') {
	await db.update(`asset_${chain}`, { selling: selling, sellPrice }, { token, tokenId: '0x' + BigInt(tokenId).toString(16) });
}

export async function maskOrderClose(chain: ChainType, token: string, tokenId: string) {
	await maskOrderSelling(chain, token, tokenId, Selling.UnsellOrUnknown, '');
}

export async function getOrder(chain: ChainType, token: string, tokenId: string) {
	let orders = await getOrders(chain, token, [tokenId]);
	return orders[0];
}

export async function getOrders(chain: ChainType, token: string, tokenIds: string[], cacheTime?: number) {
		// https://api.opensea.io/v2/orders/ethereum/seaport/listings
	// rinkeby/seaport/listings?limit=1
	// asset_contract_address=
	// limit=
	// token_ids=1&token_ids=209
	let key = `Opensea_getOrders_${chain}_${token}_${tokenIds}`;
	return scopeLock(key, async()=>{
		if (cacheTime) {
			let orders_0 = await redis.get<OrderComponents[]>(key);
			if (orders_0)
				return orders_0;
		}
		let api = `orders/{0}/seaport/listings?asset_contract_address=${token}&limit=${tokenIds.length}`;
		for (let it of tokenIds)
			api += `&token_ids=${BigInt(it)}`;
		let {orders} = await get(chain, api);
		let ls = [] as OrderComponents[];

		// maskOrderSelling close
		for (let it of tokenIds) 
			await maskOrderSelling(chain, token, it, Selling.UnsellOrUnknown, '');

		for (let it of orders) {
			let order = it?.protocol_data?.parameters as OrderComponents;
			if (order) {
				let tokenId = '0x' + BigInt(order.offer[0].identifierOrCriteria).toString(16);
				let sellPrice = BigInt(0);
				for (let c of order.consideration) {
					sellPrice += BigInt(c.startAmount);
				}
				await maskOrderSelling(chain, token, tokenId, Selling.Opensea, sellPrice.toString());
				ls.push(order);
			}
		}
		if (cacheTime)
			await redis.set(key, ls, cacheTime);
		return ls;
	});
}

export async function getOrderState(chain: ChainType, token: string, tokenId: string) {
	let order = await getOrder(chain, token, tokenId);
	if (!order) return null;
	let sea = getSeaport(chain);
	let hash = sea.getOrderHash(order);
	let status = await sea.getOrderStatus(hash);

	return {
		isCancelled: status.isCancelled,
		isValidated: status.isValidated,
		totalFilled: status.totalFilled.toHexString(),
		totalSize: status.totalSize.toHexString(),
	};
}

export function get_CROSS_CHAIN_SEAPORT_ADDRESS() { // 取消出售合约地址 seaport
	return CROSS_CHAIN_SEAPORT_ADDRESS;
}

export function get_CROSS_CHAIN_SEAPORT_ABI() {
	return SeaportABI;
}

export function get_OPENSEA_CONDUIT_ADDRESS() { // 调用合约授权资产权限给opensea
	return OPENSEA_CONDUIT_ADDRESS;
}
