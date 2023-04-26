/**
 * @copyright © 2022 Copyright smart holder
 * @date 2022-08-14
 */

import { Seaport } from "seaport-smart";
import { OrderComponents } from "seaport-smart/types";
import { OPENSEA_CONDUIT_ADDRESS, OPENSEA_CONDUIT_KEY,ItemType, OrderType } from 'seaport-smart/constants';

export const CROSS_CHAIN_SEAPORT_ADDRESS = "0x00000000000001ad428e4906aE43D8F9852d0dD6";

export {Seaport,OrderComponents,OPENSEA_CONDUIT_ADDRESS,OPENSEA_CONDUIT_KEY,ItemType, OrderType};

export const orderTypes = {
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
};