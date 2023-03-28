/**
 * @copyright © 2021 Copyright dphone.com
 * @date 2021-08-03
 */

import {RuleResult} from 'somes/router';
import ApiController from '../api';
import auth from '../auth';
import * as user from '../models/user';
import {User,ChainType} from '../models/define';

const non_auth_apis = [
	'authUser',
	'register',
];

export default class extends ApiController {

	onAuth(info: RuleResult) {
		if (non_auth_apis.indexOf(info.action) == -1) { // not auth
			return super.onAuth(info);
		} else {
			return Promise.resolve(true);
		}
	}

	authUser() {
		return this.userNotErr();
	}

	register(opts:{name: string, pkey: string, ref?: string}) {
		return auth.register(opts.name, opts.pkey || (opts as any).key, opts.ref);
	}

	setAuthUser(opts: {pkey?: string, key2?: string, ref?: string}) {
		return auth.setAuthorizationUserNoCheck(this.userName, opts);
	}
	
	async getUser() {
		let auth = await this.userNotErr();
		return await user.getUser(auth?.id);
	}

	async setUser(opts: Partial<User>) {
		let auth = await this.user();
		await user.setUser(auth.id, opts);
	}

	async addLikeDAO({dao,chain}:{dao: number, chain: ChainType}) {
		let auth = await this.user();
		await user.addLikeDAO(auth.id, dao, chain);
	}

	async deleteLikeDAO({dao,chain}:{dao: number, chain: ChainType}) {
		let auth = await this.user();
		await user.deleteLikeDAO(auth.id, dao, chain);
	}

	async getUserLikeDAOs({chain,memberObjs}: {chain?: ChainType, memberObjs?: number}) {
		let auth = await this.user();
		return await user.getUserLikeDAOs(auth.id, chain, memberObjs);
	}

}