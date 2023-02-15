/**
 * @copyright © 2021 Copyright dphone.com
 * @date 2021-08-03
 */

import ApiController from '../api';
import * as dao from '../models/dao';
import { ChainType } from '../db';

export default class extends ApiController {

	async getAllDAOs({chain,name,limit, owner,orderBy}: {
		chain: ChainType, name?: string, limit?: number | number[], owner?: string, orderBy?: string}) {
		let user = await this.user();
		return await dao.getAllDAOs(chain,name,user.id, owner,orderBy,limit);
	}

	getAllDAOsTotal({chain,name}: { chain: ChainType, name?: string}) {
		return dao.getAllDAOsTotal(chain,name);
	}

	getDAOSummarys({chain,host}: { chain: ChainType, host: string}) {
		return dao.getDAOSummarys(chain,host);
	}

	getDAOsFromCreatedBy({chain, owner}: { chain: ChainType, owner/*address string*/: string}) {
		return dao.getDAOsFromCreatedBy(chain,owner);
	}

	getDAOsTotalFromCreatedBy({chain, owner}: { chain: ChainType, owner: string}) {
		return dao.getDAOsTotalFromCreatedBy(chain,owner);
	}

}