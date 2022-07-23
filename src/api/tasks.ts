/**
 * @copyright © 2022 Copyright dphone.com
 * @date 2022-07-23
 */

import {RuleResult} from 'somes/router';
import ApiController from '../api';
import {MakeDAO, MakeDaoArgs} from '../task_dao';

const non_auth_apis = [
	'__makeDAONext__',
];

export default class extends ApiController {

	onAuth(info: RuleResult) {
		if (non_auth_apis.indexOf(info.action) == -1) { // not auth
			return super.onAuth(info);
		} else {
			return Promise.resolve(true);
		}
	}

	__makeDAONext__(args: any) {
		return MakeDAO.next(args);
	}

	makeDAO(args: MakeDaoArgs) {
		return MakeDAO.makeDAO(args, this.userName);
	}

}