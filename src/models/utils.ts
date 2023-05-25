/**
 * @copyright © 2022 Copyright ccl
 * @date 2022-07-21
 */

import somes from 'somes';
import { TokenURIInfo } from './define';
import {storage} from '../utils';
import redis from 'bclib/redis';

export const LIMIT_MAX = -235681;

export function getLimit(limit?: number|number[]) {
	if (LIMIT_MAX==limit)
		return [0,10000]; // not limit
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

export enum QueryType {
	kQuery, // query rows
	kQueryTotal, // query total
}

export function newQuery<Args extends {}, More extends {}, R>(
	handle: (args: Args, opts: {
		readonly type: QueryType;
		readonly out: string;
		readonly total: boolean;
		readonly orderBy?: string;
		readonly limit?: number | number[]
	}, more?: More)=>Promise<R>|R, name?: string, defaultCacheTime = 0
) {
	name = String(name || somes.random());

	return {
		query: newCache(
			(args: Args & { orderBy?: string, limit?: number | number[]}, more?: More)=>handle(args, {
				orderBy: args.orderBy, limit: args.limit, type: QueryType.kQuery, out: '*', total: false
			}, more),
			{ name, cacheTime: defaultCacheTime },
		),
		queryTotal: newCache(
			(args: Args, more?: More)=>handle(args, {
				type: QueryType.kQueryTotal, out: 'count(*) as __count', total: true
			}, more), {
			after: (r)=>{
				if (Array.isArray(r)) {
					if (r.length) {
						if ('__count' in  r[0]) {
							return r[0].__count as number;
						} else {
							return r.length;
						}
					} else {
						return 0;
					}
				}
				return 0;
			},
			name: name + '_total',
			cacheTime: Math.max(defaultCacheTime, 1e4),
		}),
	};
}

export function newCache<Args extends any[], R, R2>(
	handle: (...args: Args)=>Promise<R>|R,
	opts: {
		before?: (args: Args)=>void,
		after?: (r: R, args: Args)=>Promise<R2>|R2,
		cacheTime?: number,
		name?: string,
	} | number = {}
): ((...args: [...Args,number?])=>Promise<
	R2 extends object | number | bigint | string | boolean | void | null | undefined ? R2 : R
>) {
	opts = opts || {};
	if (typeof opts == 'number') {
		opts = {cacheTime: opts};
	}
	let hash = String(opts.name || somes.random()) + somes.random();
	let {before,after,cacheTime} = opts;

	if (typeof cacheTime != 'number')
		cacheTime = 1e4; // default cache time

	return async function(...args: [...Args,number?]) {
		let time = typeof args.indexReverse(0) == 'number' ? args.pop() : cacheTime;
		let args1 = args as any as Args;
		let key = `key_${hash}_${Object.hashCode(args1)}`;
		let val: any;

		if (!time || !(val = await redis.get(key))) {
			if (before)
				before(args1);
			let r = await handle(...args1) as any;
			if (after) {
				r = await after(r,args1);
			}
			if (time)
				await redis.set(key, [r], time);
			else if (cacheTime)
				await redis.set(key, [r], cacheTime);
			return r;
		} else {
			return val[0];
		}
	};
}

export function toDict<T extends any>(t: T[], k: keyof T) {
	let r = {} as Dict<T>;
 	for (let i of t) {
		r[String(i[k])] = i;
	}
	return r;
}

export function joinTable<A extends any, B extends any>(left: A[], join: keyof A, left_k: keyof A, right_k: keyof B, right: B[]) {
	let dict = toDict(right, right_k);
	for (let it of left) {
		it[join] = dict[String(it[left_k])] as any;
	}
}