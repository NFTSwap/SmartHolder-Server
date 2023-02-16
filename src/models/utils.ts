/**
 * @copyright © 2022 Copyright ccl
 * @date 2022-07-21
 */

import somes from 'somes';
import { TokenURIInfo } from './define';
import {storage} from '../utils';

export function getLimit(limit?: number|number[]) {
	if (limit==-1)
		return undefined; // not limit
	limit = limit ? limit: [0, 100];
	if (!Array.isArray(limit))
		limit = [0,limit];
	somes.assert(limit[0] < 10000, 'Limit offset must be less than 10000');
	somes.assert(limit[1] <= 100, 'Limit quantity can only be within 100');
	// limit[0] = Math.min(10000, limit[0]);
	// limit[1] = Math.min(100, limit[1]);
	return limit;
}

export async function saveTokenURIInfo(info: TokenURIInfo) {
	/*
	// {
	// 	"name": "Diva 007",
	// 	"description": "#007\nElement: air",
	// 	"external_link": "https://opensea.io/collection/naturedivas/",
	// 	"image": "https://lh3.googleusercontent.com/U61KH6g_g2sO7ZOz92ILJm-hAYzWdpQScWD9Kk3O78pJh4_39QV0qvzLlG_CmkC0N18r6brELJuvrrlarlu-LAAgDwAVxkwXYGux",
	// 	"animation_url": null
	// 	"images": [],
	// attributes: [
	// {
	// trait_type: "Bones",
	// value: "Emerald"
	// },
	// {
	// trait_type: "Clothes",
	// value: "None"
	// },
	// {
	// trait_type: "Mouth",
	// value: "None"
	// },
	// {
	// trait_type: "Eyes",
	// value: "None"
	// },
	// {
	// trait_type: "Hat",
	// value: "Confetti Party Hat"
	// },
	// {
	// trait_type: "Super Power",
	// value: "None"
	// }
	// ]
	// }
*/
	return await storage(JSON.stringify(info), '.json');
}
