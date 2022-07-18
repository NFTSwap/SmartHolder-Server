/**
 * @copyright © 2021 Copyright dphone.com
 * @date 2021-08-03
 */

import ApiController from '../api';
import auth from '../auth';
import {RuleResult} from 'somes/router';

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

	setUser(opts: {pkey?: string, key2?: string, ref?: string}) {
		return auth.setAuthorizationUserNoCheck(this.userName, opts);
	}

}