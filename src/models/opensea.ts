/**
 * @copyright © 2022 Copyright smart holder
 * @date 2022-08-14
 */

import somes from 'somes';
import web3s from '../web3+';
import { ChainType, ContractInfo, ContractType } from "./def";
import { getContractInfo } from "./contract";
import errno from '../errno';
import { Seaport } from "seaport-smart";
import { OrderComponents, OrderStatus } from "seaport-smart/types";
import { ItemType, MAX_INT } from "seaport-smart/constants";
import { providers, Signer, BigNumberish } from "ethers";
import { Bytes, BytesLike } from "@ethersproject/bytes";

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
}

export interface Order {
	parameters: OrderComponents;
	signature: string;
}

export async function getOrderParameters(chain: ChainType, token: string, tokenId: string, amount: string, time?: number): Promise<OrderParametersAll> {
	let web3 = web3s(chain);
	let rpc = web3.provider.rpc;
	let info = await getContractInfo(token, chain) as ContractInfo;
	somes.assert(info && info.host, errno.ERR_DAO_HOST_NOT_FOUND);
	somes.assert(info.type == ContractType.AssetGlobal, errno.ERR_TOKEN_TYPE_NOT_MATCH);

	let methods = (await web3.contract(token)).methods;
	let owner = await methods.ownerOf(tokenId).call() as string;

	// TODO ...

	return {
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
		value: {} as any,
	};
}

export async function createOrder(order: Order): Promise<void> {
	// TODO ...
}

export async function getOrderState(chain: ChainType, token: string, tokenId: string): Promise<OrderStatus> {
	// TODO ... query opensea

	throw '';
}
