/**
 * @copyright © 2021 Copyright dphone.com
 * @date 2022-07-25
 */

import ApiController from '../api';
import { ChainType, State,Selling } from '../db';
import * as utils from '../models/utils';
import * as qn from 'bclib/qn';
import {TokenURIInfo} from '../models/utils';

export default class extends ApiController {
	/**
	 * @method getDAO() 通过地址获取dao对像
	 * */ 
	getDAO({chain,address}: { chain: ChainType, address: string}) {
		return utils.getDAO(chain,address);
	}

	/**
	 * @method getDAONoEmpty() 通过地址获取dao对像,如果dao为空会抛出异常
	 * */ 
	getDAONoEmpty({chain,address}: { chain: ChainType, address: string}) {
		return utils.getDAONoEmpty(chain,address);
	}

	/**
	 * @method getDAOsFromOwner() 通过owner钱包地址获取dao列表
	 * */ 
	getDAOsFromOwner({chain,owner}: { chain: ChainType, owner: string}) {
		return utils.getDAOsFromOwner(chain,owner);
	}

	/**
	 * @method getMembersFrom() 通过dao地址与owner获取dao成员列表
	 * @param host string dao 地址
	 * */ 
	getMembersFrom({chain,host,owner,limit}: { chain: ChainType, host: string, owner?: string, limit?: number | number[]}) {
		return utils.getMembersFrom(chain,host,owner,limit);
	}

	/**
	 * @method getAssetFrom() 通过dao地址与owner获取资产列表
	 * */ 
	getAssetFrom({chain,host,owner,state,name,time,selling,limit}: {
		chain: ChainType, host: string, owner?: string, state?: State, name?: string, time?: [number,number], selling?: Selling, limit?: number | number[]
	}) {
		return utils.getAssetFrom(chain,host,owner,state,name,time,selling,limit);
	}

	/**
	 * @method setAssetState() 通过token、tokenId、设置资产状态默认为0
	 * */ 
	setAssetState({chain,token,tokenId,state}: { chain: ChainType, token: string, tokenId: string, state: State}) {
		return utils.setAssetState(chain,token,tokenId,state);
	}

	/**
	 * @method getAssetOrderFrom() 通过dao地址与fromAddres地址获订单列表
	 * */ 
	getAssetOrderFrom({chain,host,fromAddres,limit}: { chain: ChainType, host: string, fromAddres?: string, limit?: number | number[]}) {
		return utils.getAssetOrderFrom(chain,host,fromAddres,limit);
	}

	/**
	 * @method getLedgerItemsFromHost() 通过dao地址获取财务流水
	 * */ 
	getLedgerItemsFromHost({chain,host,limit}: { chain: ChainType, host: string, limit?: number | number[]}) {
		return utils.getLedgerItemsFromHost(chain,host,limit);
	}

	/**
	 * @method getVoteProposalFrom() 通过投票合约地址 address、proposal_id（可选） 获投票提案列表
	 * */ 
	getVoteProposalFrom({chain,address,proposal_id,limit}: { chain: ChainType, address: string, proposal_id?: string, limit?: number | number[]}) {
		return utils.getVoteProposalFrom(chain,address,proposal_id,limit);
	}

	/**
	 * @method getVotesFrom() 通过投票合约地址 address、proposal_id、成员id（可选） 获投票信息
	 * */ 
	getVotesFrom({chain,address,proposal_id,member_id,limit}: { chain: ChainType, address: string, proposal_id: string, member_id?: string, limit?: number | number[]}) {
		return utils.getVotesFrom(chain,address,proposal_id,member_id,limit);
	}

	getOpenseaContractJSON({host, chain}: {host: string, chain?: ChainType}) {
		return utils.getOpenseaContractJSON(host, chain);
	}

	qiniuToken() {
		return qn.uploadToken().token;
	}

	saveTokenURIInfo(info: TokenURIInfo) {
		return utils.saveTokenURIInfo(info);
	}

	addEventsItem({chain,host,title,description,created_member_id}: {
		chain: ChainType, host: string, title: string, description: string, created_member_id: string
	}) {
		return utils.addEventsItem(chain,host,title,description,created_member_id);
	}

	setEventsItem({id,title,description,state}: {
		id: number, title?: string, description?: string, state?: State
	}) {
		return utils.setEventsItem(id,title,description,state);
	}

	getEventsItems({chain, host, title, created_member_id, state, limit}:{
		chain: ChainType, host: string, title?: string, created_member_id?: string, state?: State, limit?: number | number[]
	}) {
		return utils.getEventsItems(chain, host, title, created_member_id, state, limit);
	}

	getEventsItemsTotal({chain, host, title, created_member_id,state}: {
		chain: ChainType, host: string, title?: string, created_member_id?: string, state?: State
	}) {
		return utils.getEventsItemsTotal(chain, host, title, created_member_id, state);
	}

	// -------------------------- Total -------------------------

	 getDAOsTotalFromOwner({chain,owner}: { chain: ChainType, owner: string}) {
		return utils.getDAOsTotalFromOwner(chain,owner);
	}

	getMembersTotalFrom({chain,host,owner}: { chain: ChainType, host: string, owner?: string}) {
		return utils.getMembersTotalFrom(chain,host,owner);
	}

	getAssetTotalFrom({chain,host,owner,state,name,time,selling}: { 
		chain: ChainType, host: string, owner?: string, state?: State, name?: string, time?: [number,number],selling?: Selling
	}) {
		return utils.getAssetTotalFrom(chain,host,owner,state,name,time,selling);
	}

	 getAssetOrderTotalFrom({chain,host,fromAddres}: { chain: ChainType, host: string, fromAddres?: string}) {
		return utils.getAssetOrderTotalFrom(chain,host,fromAddres);
	}

	getLedgerItemsTotalFromHost({chain,host}: { chain: ChainType, host: string}) {
		return utils.getLedgerItemsTotalFromHost(chain,host);
	}

	getVoteProposalTotalFrom({chain,address,proposal_id}: { chain: ChainType, address: string, proposal_id?: string}) {
		return utils.getVoteProposalTotalFrom(chain,address,proposal_id);
	}

	getVotesTotalFrom({chain,address,proposal_id,member_id}: { chain: ChainType, address: string, proposal_id: string, member_id?: string}) {
		return utils.getVotesTotalFrom(chain,address,proposal_id,member_id);
	}


}