/**
 * @copyright © 2021 Copyright dphone.com
 * @date 2022-07-25
 */

import ApiController from '../api';
import db, {DAO, ChainType, Member, Asset, State, AssetOrder, AssetExt, Ledger, Votes, VoteProposal} from '../db';
import * as utils from '../models/utils';

export default class extends ApiController {
	getDAO({chain,address}: { chain: ChainType, address: string}) {
		return utils.getDAO(chain,address);
	}

	getDAONoEmpty({chain,address}: { chain: ChainType, address: string}) {
		return utils.getDAONoEmpty(chain,address);
	}

	getDAOsFromOwner({chain,owner}: { chain: ChainType, owner: string}) {
		return utils.getDAOsFromOwner(chain,owner);
	}

	getMembersFrom({chain,host,owner,limit}: { chain: ChainType, host: string, owner?: string, limit?: number | number[]}) {
		return utils.getMembersFrom(chain,host,owner,limit);
	}

	getAssetFromHost({chain,host,limit}: { chain: ChainType, host: string, limit?: number | number[]}) {
		return utils.getAssetFromHost(chain,host,limit);
	}

	setAssetState({chain,token,tokenId,state}: { chain: ChainType, token: string, tokenId: string, state: State}) {
		return utils.setAssetState(chain,token,tokenId,state);
	}

	getAssetExt({chain,token,tokenId}: { chain: ChainType, token: string, tokenId: string}) {
		return utils.getAssetExt(chain,token,tokenId);
	}

	getAssetOrderFrom({chain,host,fromAddres,limit}: { chain: ChainType, host: string, fromAddres?: string, limit?: number | number[]}) {
		return utils.getAssetOrderFrom(chain,host,fromAddres,limit);
	}

	getLedgerItemsFromHost({chain,host,limit}: { chain: ChainType, host: string, limit?: number | number[]}) {
		return utils.getLedgerItemsFromHost(chain,host,limit);
	}

	getVoteProposalFrom({chain,address,proposal_id,limit}: { chain: ChainType, address: string, proposal_id?: string, limit?: number | number[]}) {
		return utils.getVoteProposalFrom(chain,address,proposal_id,limit);
	}

	getVotesFrom({chain,address,proposal_id,member_id,limit}: { chain: ChainType, address: string, proposal_id: string, member_id?: string, limit?: number | number[]}) {
		return utils.getVotesFrom(chain,address,proposal_id,member_id,limit);
	}

}