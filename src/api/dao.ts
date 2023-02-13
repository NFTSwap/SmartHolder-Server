/**
 * @copyright © 2021 Copyright dphone.com
 * @date 2021-08-03
 */

import ApiController from '../api';
import * as dao from '../models/dao';
import { ChainType } from '../db';

export default class extends ApiController {

	async getAllDAOs({chain,name,limit, owner}: { chain: ChainType, name?: string, limit?: number | number[], owner?: string}) {
		let user = await this.user();
		return await dao.getAllDAOs(chain,name,limit, user.id, owner);
	}

	getAllDAOsTotal({chain,name}: { chain: ChainType, name?: string}) {
		return dao.getAllDAOsTotal(chain,name);
	}

	getDAOSummarys({chain,host}: { chain: ChainType, host: string}) {
		return dao.getDAOSummarys(chain,host);
	}

	getDAOsFromCreatedBy({chain, createdBy}: { chain: ChainType, name?: string, createdBy: string}) {
		return dao.getDAOsFromCreatedBy(chain,createdBy);
	}

	getDAOsTotalFromCreatedBy({chain, createdBy}: { chain: ChainType, name?: string, createdBy: string}) {
		return dao.getDAOsTotalFromCreatedBy(chain,createdBy);
	}

}