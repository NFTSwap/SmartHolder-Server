/**
 * @copyright © 2021 Copyright dphone.com
 * @date 2022-07-25
 */

import ApiController from '../api';
import { ChainType, State,Selling,LedgerType,TokenURIInfo } from '../db';
import * as utils from '../models/utils';
import * as dao from '../models/dao';
import * as asset from '../models/asset';
import * as events from '../models/events';
import * as member from '../models/member';
import * as ledger from '../models/ledger';
import * as vp from '../models/vote_pool';
import * as qn from 'bclib/qn';
import { RuleResult } from 'somes/router';

const non_auth_apis = ['printJSON'];

export default class extends ApiController {

	onAuth(info: RuleResult) {
		if (non_auth_apis.indexOf(info.action) == -1) { // not auth
			return super.onAuth(info);
		} else {
			return Promise.resolve(true);
		}
	}

	async printJSON(data: any) {
		let json = {} as Dict;
		for (let [k,v] of Object.entries<string>(data))
			json[k] = (
				v == 'true' ? true:
				v == 'false' ? false:
				v.match(/^\d+$/) ? Number(v):
				v.substring(0,3) == 'b64' ? Buffer.from(v.substring(3), 'base64').toString() :
				v.substring(0,3) == '0xs' ? Buffer.from(v.substring(3), 'hex').toString() :
				v.substring(0,4) == 'b64,' ? Buffer.from(v.substring(4), 'base64').toString() :
				v.substring(0,4) == 'hex,' ? Buffer.from(v.substring(4), 'hex').toString() :
				v
			);
		this.returnString(JSON.stringify(json), this.server.getMime('json'));
	}

	// ------------------------ more apis ------------------------

	/**
	 * @method getDAO() 通过地址获取dao对像
	 * */ 
	getDAO({chain,address}: { chain: ChainType, address: string}) {
		return dao.getDAO(chain,address);
	}

	/**
	 * @method getDAONoEmpty() 通过地址获取dao对像,如果dao为空会抛出异常
	 * */ 
	getDAONoEmpty({chain,address}: { chain: ChainType, address: string}) {
		return dao.getDAONoEmpty(chain,address);
	}

	/**
	 * @method getDAOsFromOwner() 通过owner钱包地址获取dao列表
	 * */ 
	getDAOsFromOwner({chain,owner,memberObjs}: { chain: ChainType, owner: string, memberObjs?: number}) {
		return dao.getDAOsFromOwner(chain,owner,memberObjs);
	}

	/**
	 * @method getMembersFrom() 通过dao地址与owner获取dao成员列表
	 * @param host string dao 地址
	 * */ 
	async getMembersFrom({chain,host,owner,time,orderBy,limit}: { 
		chain: ChainType, host: string, owner?: string, time?: number |number[], orderBy?: string, limit?: number | number[]
	}) {
		let ms = await member.getMembersFrom(chain,host,owner,time,orderBy,limit);
		return ms.map(e=>((e as any).avatar=e.image,e)); // Compatible with older versions
	}

	/**
	 * @method getAssetFrom() 通过dao地址与owner获取资产列表
	 * */ 
	getAssetFrom({chain,host,owner,author,state,name,time,selling,selling_not,orderBy,limit,owner_not,author_not}: {
		chain: ChainType, host?: string, owner?: string, author?: string, 
		owner_not?: string, author_not?: string, state?: State,
		name?: string, time?: [number,number], selling?: Selling, selling_not?: Selling, orderBy?: string, limit?: number | number[]
	}) {
		return asset.getAssetFrom(chain,host,owner,author,
			owner_not,author_not,state,name,time,selling,selling_not,orderBy,limit);
	}

	/**
	 * @method setAssetState() 通过token、tokenId、设置资产状态默认为0
	 * */ 
	setAssetState({chain,token,tokenId,state}: { chain: ChainType, token: string, tokenId: string, state: State}) {
		return asset.setAssetState(chain,token,tokenId,state);
	}

	/**
	 * @method getAssetOrderFrom() 通过dao地址与fromAddres地址获订单列表
	 * */ 
	getAssetOrderFrom({chain,host,tokenId,fromAddres,toAddress,name,time,limit,orderBy}: {
		chain: ChainType, host: string, fromAddres?: string,
		toAddress?: string, tokenId?: string, name?: string, time?: [number,number], limit?: number | number[], orderBy?: string
	}) {
		return asset.getAssetOrderFrom(chain,host,fromAddres,toAddress,tokenId,name,time,orderBy,limit);
	}

	getOrderTotalAmount({chain,host,tokenId,fromAddres,toAddress,name,time}: {
		chain: ChainType, host: string, fromAddres?: string,
		toAddress?: string, tokenId?: string, name?: string, time?: [number,number]
	}) {
		return asset.getOrderTotalAmount(chain,host,fromAddres, toAddress, tokenId, name,time);
	}

	getAssetTotalFrom({chain,host,owner,author,state,name,time,selling,selling_not,owner_not,author_not}: {
		chain: ChainType, host?: string, 
		owner?: string, author?: string, 
		owner_not?: string, author_not?: string,
		state?: State, name?: string, time?: [number,number],selling?: Selling,selling_not?:Selling
	}) {
		return asset.getAssetTotalFrom(chain,host,owner,author,owner_not,author_not,state,name,time,selling,selling_not);
	}

	 getAssetOrderTotalFrom({chain,host,fromAddres,toAddress,tokenId,name,time}: {
		chain: ChainType, host: string, fromAddres?: string,toAddress?: string, tokenId?: string, name?: string, time?: [number,number]
	}) {
		return asset.getAssetOrderTotalFrom(chain,host,fromAddres,toAddress,tokenId,name,time);
	}

	/**
	 * @method getLedgerItemsFromHost() 通过dao地址获取财务流水
	 * */ 
	getLedgerItemsFromHost({chain,host,type,time,state,limit,orderBy}: {
		chain: ChainType, host: string, type?: LedgerType, time?: [number,number], state?: State, limit?: number | number[], orderBy?: string
	}) {
		return ledger.getLedgerItemsFromHost(chain,host,type,time,state,orderBy,limit);
	}

	getLedgerItemsTotalFromHost({chain,host,type,time,state}: { chain: ChainType, host: string, type?: LedgerType, time?: [number,number], state?: State}) {
		return ledger.getLedgerItemsTotalFromHost(chain,host,type,time,state);
	}

	getLedgerTotalAmount({chain,host,type,time,state}: {chain: ChainType, host: string, type?: LedgerType, time?: [number,number], state?: State}) {
		return ledger.getLedgerTotalAmount(chain,host,type,time,state);
	}

	/**
	 * @method setLedgerState() 设置财务记录状态
	 * */ 
	setLedgerState({chain,id,state}:{chain: ChainType, id: number, state: State}) {
		return ledger.setLedgerState(chain, id, state);
	}
	
	/**
	 * @method getVoteProposalFrom() 通过投票合约地址 address、proposal_id（可选） 获投票提案列表
	 * @param target {string} target='[]' 表示普通提案
	 * */ 
	getVoteProposalFrom({
		chain,address,proposal_id, name, isAgree,isClose, isExecuted, target, limit,orderBy}: {
		chain: ChainType, address: string, proposal_id?: string,
		name?: string, isAgree?: boolean,isClose?: boolean, isExecuted?: boolean, target?: string,
		limit?: number | number[], orderBy?: string}) {
		return vp.getVoteProposalFrom(chain,address,proposal_id, name, isAgree,isClose, isExecuted, target,orderBy,limit);
	}

	/**
	 * @method getVotesFrom() 通过投票合约地址 address、proposal_id、成员id（可选） 获投票信息
	 * */ 
	getVotesFrom({chain,address,proposal_id,member_id,limit,orderBy}: {
		chain: ChainType, address: string, proposal_id: string, member_id?: string, limit?: number | number[], orderBy?: string}) {
		return vp.getVotesFrom(chain,address,proposal_id,member_id,orderBy,limit);
	}

	/**
	 * @method qiniuToken() 获取七牛上传Token
	 * */ 
	qiniuToken() {
		return qn.uploadToken().token;
	}

	/**
	 * @method saveTokenURIInfo() 保存TokenURIInfo并返回保存后的URI
	 * */ 
	saveTokenURIInfo(info: TokenURIInfo) {
		return utils.saveTokenURIInfo(info);
	}

	addEventsItem({chain,host,title,description,created_member_id}: {
		chain: ChainType, host: string, title: string, description: string, created_member_id: string
	}) {
		return events.addEventsItem(chain,host,title,description,created_member_id);
	}

	setEventsItem({id,title,description,state}: {
		id: number, title?: string, description?: string, state?: State
	}) {
		return events.setEventsItem(id,title,description,state);
	}

	getEventsItems({chain, host, title, created_member_id, member, time, state, limit}:{
		chain: ChainType, host: string, title?: string,
		created_member_id?: string, member?: string, time?: [number, number], state?: State, limit?: number | number[]
	}) {
		return events.getEventsItems(chain, host, title, created_member_id, member, time, state, limit);
	}

	getEventsItemsTotal({chain, host, title, created_member_id,member,time,state}: {
		chain: ChainType, host: string, title?: string, created_member_id?: string, member?: string, time?: [number, number], state?: State
	}) {
		return events.getEventsItemsTotal(chain, host, title, created_member_id, member, time, state);
	}

	getDAOsTotalFromOwner({chain,owner}: { chain: ChainType, owner: string}) {
		return dao.getDAOsTotalFromOwner(chain,owner);
	}

	getMembersTotalFrom({chain,host,owner,time}: { chain: ChainType, host: string, owner?: string, time?:number| number[]}) {
		return member.getMembersTotalFrom(chain,host,owner,time);
	}

	getVoteProposalTotalFrom({chain,address,proposal_id,name, isAgree, isClose, isExecuted, target}: {
		chain: ChainType, address: string, proposal_id?: string,
		name?: string, isAgree?: boolean, isClose?: boolean, isExecuted?: boolean, target?: string
	}) {
		return vp.getVoteProposalTotalFrom(chain,address,proposal_id,name, isAgree, isClose, isExecuted, target);
	}

	getVotesTotalFrom({chain,address,proposal_id,member_id}: { chain: ChainType, address: string, proposal_id: string, member_id?: string}) {
		return vp.getVotesTotalFrom(chain,address,proposal_id,member_id);
	}

}