/**
 * @copyright © 2021 Copyright dphone.com
 * @date 2021-08-03
 */

import ApiController from '../api';
import * as dao from '../models/dao';
import { ChainType } from '../db';

export default class extends ApiController {

	async getAllDAOs({chain,name,limit, owner,orderBy,memberObjs}: {
		chain: ChainType, name?: string, limit?: number | number[], owner?: string, orderBy?: string,memberObjs?: number}) {
		let user = await this.userNotErr();
		return await dao.getAllDAOs.query({chain,name, user_id: user?.id, owner,orderBy,memberObjs,limit});
	}

	getAllDAOsTotal({chain,name}: { chain: ChainType, name?: string}) {
		return dao.getAllDAOs.queryTotal({chain,name});
	}

	getDAOSummarys({chain,host}: { chain: ChainType, host: string}) {
		return dao.getDAOSummarys({chain,host});
	}

	getDAOsFromCreatedBy({chain, owner,createdBy,memberObjs}: {
		chain: ChainType, owner/*address string*/: string, createdBy?: string, memberObjs?: number}) {
		return dao.getDAOsFromCreatedBy.query({chain,createdBy: createdBy || owner, memberObjs});
	}

	getDAOsTotalFromCreatedBy({chain, owner,createdBy}: { chain: ChainType, owner: string,createdBy?: string}) {
		return dao.getDAOsFromCreatedBy.queryTotal({chain,createdBy: createdBy||owner});
	}

	getDAOsAddress({chain}: { chain: ChainType}) {
		return dao.getDAOsAddress(chain);
	}

}