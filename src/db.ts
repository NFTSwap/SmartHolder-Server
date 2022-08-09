/**
 * @copyright © 2022 Smart Holder Server
 * @date 2022-07-19
*/

import * as sqlite from 'bclib/sqlite';
import paths from 'bclib/paths';
import {Storage} from 'bclib/storage';
import {DatabaseTools} from 'somes/db';
import {MysqlTools} from 'somes/mysql';
import pool from 'somes/mysql/pool';
import {Charsets} from 'somes/mysql/constants';
import * as cfg from '../config';
import {ChainType} from './models/def';

export * from './models/def';

export const storage = new Storage();

// "animation_url": "https://storage.opensea.io/files/059b00a2e3443f5579742e8ae5392b9d.mp4"

export const main_db: DatabaseTools = cfg.mysql ? new MysqlTools(cfg.mysql as any): new sqlite.SQLiteTools(`${paths.var}/shs.db`);
export const local_db: DatabaseTools = new sqlite.SQLiteTools(`${paths.var}/shs-local.db`); // local db

if (pool) {
	pool.CHAREST_NUMBER = Charsets.UTF8MB4_UNICODE_CI;
}

async function load_main_db() {

	for ( let [k] of Object.entries(cfg.web3s)) {
		let chain = ChainType[k as any];
		await main_db.load(`

			create table if not exists dao_${chain} (
				id           int primary key auto_increment,
				host         varchar (64)                       not null, -- dao host or self address
				address      varchar (64)                       not null,
				name         varchar (64)                       not null,
				mission      varchar (1024)                     not null,
				description  varchar (1024)                     not null,
				root         varchar (64)                       not null,
				operator     varchar (64)                       not null,
				member       varchar (64)                       not null,
				ledger       varchar (64)                       not null,
				assetGlobal  varchar (64)                       not null,
				asset        varchar (64)                       not null,
				time         bigint                             not null,
				modify       bigint                             not null,
				blockNumber  int                                not null,
				assetIssuanceTax    varchar (32) default ('')   not null,
				assetCirculationTax varchar (32) default ('')   not null,
				defaultVoteRate     varchar (32) default ('')   not null,
				defaultVotePassRate varchar (32) default ('')   not null
			);

			create table if not exists member_${chain} (
				id           int primary key auto_increment,
				host         varchar (64)               not null, -- dao host
				token        varchar (64)               not null, -- address
				tokenId      varchar (72)               not null, -- id
				uri          varchar (512)              not null, -- uri
				owner        varchar (64)               not null, -- owner address
				name         varchar (64)               not null, -- member name
				description  varchar (512)              not null, -- member description
				avatar       varchar (512)              not null, -- member head portrait
				role         int           default (0)  not null, -- default 0
				votes        int           default (0)  not null, -- default > 0
				time         bigint                     not null,
				modify       bigint                     not null
			);

			create table if not exists asset_${chain} (
				id           int primary key auto_increment,
				token        varchar (64)               not null, -- address
				tokenId      varchar (72)               not null,
				uri          varchar (512)              not null,
				owner        varchar (64)  default ('') not null,
				author       varchar (64)  default ('') not null,
				selling      int           default (0)  not null, -- 销售类型: 0未销售,1销售opensea,2其它平台
				sellPrice    varchar (72)  default ('') not null, -- 销售价格
				state        int           default (0)  not null, -- 状态: 0正常,1删除
				time         bigint                     not null,
				modify       bigint                     not null
			);

			create table if not exists asset_order_${chain} (      -- 资产订单 asset from -> to
				id           int    primary key auto_increment not null,
				txHash       char    (72)                      not null,  -- tx hash
				blockNumber  int                               not null,
				token        char    (42)                      not null,  -- 协约地址
				tokenId      char    (66)                      not null,  -- hash
				fromAddres   char    (42)                      not null,  -- from
				toAddress    char    (42)                      not null,  -- to
				value        varchar (66)   default ('')       not null,  -- tx value
				description  varchar (1024) default ('')       not null,
				time         bigint         default (0)        not null
			);

			create table if not exists ledger_${chain} ( -- 财务记录
				id           int primary key auto_increment,
				host         varchar (64)                 not null, -- dao host
				address      varchar (64)                 not null, -- 合约地址
				txHash       varchar (72)                 not null, -- tx hash
				type         int             default (0)  not null, -- 0保留,1进账-无名接收存入,2进账-存入,3出账-取出,4出账-成员分成
				name         varchar (64)    default ('') not null, -- 转账名目
				description  varchar (1024)  default ('') not null, -- 详细
				target       varchar (64)                 not null, -- 转账目标,进账为打款人,出账为接收人
				member_id    varchar (72)    default ('') not null, -- 成员出账id,如果为成员分成才会存在
				balance      varchar (72)                 not null, -- 金额
				time         bigint                       not null, -- 时间
				blockNumber  int                          not null  -- 区块
			);

			create table if not exists ledger_release_log_${chain} ( -- 成员分成日志
				id           int primary key auto_increment,
				address      varchar (64)                 not null, -- 合约地址
				operator     varchar (64)                 not null,
				txHash       varchar (72)                 not null, -- tx hash
				log          varchar (1024)               not null,
				balance      varchar (72)                 not null, -- 金额
				time         bigint                       not null,
				blockNumber  int                          not null
			);

			create table if not exists vote_proposal_${chain} ( -- 投票提案
				id           int primary key auto_increment,
				host         varchar (64)                 not null, -- dao host
				address      varchar (64)                 not null, -- 投票池合约地址
				proposal_id  varchar (72)                 not null, -- 提案id
				name         varchar (64)                 not null, -- 提案名称
				description  varchar (1024)               not null, -- 提案描述
				origin       varchar (64)                 not null, -- 发起人
				target       varchar (64)                 not null, -- 执行目标合约地址
				data         text                         not null, -- 执行参数数据
				lifespan     bigint                       not null, -- 投票生命周期(minutes)
				expiry       bigint                       not null, -- 过期时间（区块链时间单位）
				voteRate     int                          not null, -- 投票率不小于全体票数50% (0-10000)
				passRate     int                          not null, -- 通过率不小于全体票数50% (0-10000)
				loopCount    int              default (0) not null, -- 执行循环次数: -1无限循环,0不循环
				loopTime     bigint           default (0) not null, -- 执行循环间隔时间
				voteTotal    bigint           default (0) not null, -- 投票总数
				agreeTotal   bigint           default (0) not null, -- 通过总数
				executeTime  bigint           default (0) not null, -- 上次执行的时间
				isAgree      bit              default (0) not null, -- 是否通过采用
				isClose      bit              default (0) not null, -- 投票是否截止
				isExecuted   bit              default (0) not null, -- 是否已执行完成
				time         bigint                       not null,
				modify       bigint                       not null,
				blockNumber  int                          not null
			);

			create table if not exists votes_${chain} ( -- 投票
				id           int primary key auto_increment,
				address      varchar (64)                 not null, -- 投票池合约地址
				proposal_id  varchar (72)                 not null, -- 提案id
				member_id    varchar (72)                 not null, -- 成员 id
				votes        int                          not null, -- 投票数量
				time         bigint                       not null,
				blockNumber  int                          not null
			);

			create table if not exists contract_info_${chain} (
				id           int primary key auto_increment,
				host         varchar (64)    default ('') not null,
				address      varchar (64)                 not null,
				type         int             default (0)  not null, -- contracts type
				blockNumber  int                          not null,
				abi          text,                                  -- 协约abi json,为空时使用默认值
				state        int             default (0) not null, -- 状态: 0启用, 1禁用
				time         bigint                      not null  --
			);

		`, [
			`alter table dao_${chain}  add assetIssuanceTax      varchar (32)  default ('')  not null`,
			`alter table dao_${chain}  add assetCirculationTax   varchar (32)  default ('')  not null`,
			`alter table dao_${chain}  add defaultVoteRate       varchar (32)  default ('')  not null`,
			`alter table dao_${chain}  add defaultVotePassRate   varchar (32)  default ('')  not null`,
		], [
			// dao
			`create  unique index dao_${chain}_idx0              on dao_${chain}                    (address)`,
			`create         index dao_${chain}_idx1              on dao_${chain}                    (name)`,
			// member
			`create         index member_${chain}_idx1           on member_${chain}                 (token)`,
			`create unique  index member_${chain}_idx2           on member_${chain}                 (token,tokenId)`,
			`create         index member_${chain}_idx3           on member_${chain}                 (token,owner)`,
			`create         index member_${chain}_idx4           on member_${chain}                 (owner)`,
			`create         index member_${chain}_idx5           on member_${chain}                 (name)`,
			// asset
			`create         index asset_${chain}_idx0            on asset_${chain}                  (token)`,
			`create  unique index asset_${chain}_idx1            on asset_${chain}                  (token,tokenId)`,
			`create         index asset_${chain}_idx2            on asset_${chain}                  (token,owner)`,
			// asset ordr
			`create         index asset_order_${chain}_idx0      on asset_order_${chain}            (token,tokenId)`,
			`create         index asset_order_${chain}_idx1      on asset_order_${chain}            (fromAddres)`,
			`create         index asset_order_${chain}_idx2      on asset_order_${chain}            (toAddress)`,
			`create         index asset_order_${chain}_idx3      on asset_order_${chain}            (txHash)`,
			`create unique  index asset_order_${chain}_idx4      on asset_order_${chain}            (txHash,token,tokenId)`,
			`create         index asset_order_${chain}_idx6      on asset_order_${chain}            (token)`,
			`create         index asset_order_${chain}_idx7      on asset_order_${chain}            (token,fromAddres)`,
			// ledger
			`create         index ledger_${chain}_idx0           on ledger_${chain}                 (address)`,
			`create         index ledger_${chain}_idx1           on ledger_${chain}                 (address,target)`,
			`create         index ledger_${chain}_idx2           on ledger_${chain}                 (address,type)`,
			`create         index ledger_${chain}_idx3           on ledger_${chain}                 (address,target,type)`,
			`create         index ledger_${chain}_idx4           on ledger_${chain}                 (address,txHash,type,member_id)`,
			// ledger_release_log
			`create unique  index ledger_release_log_${chain}_idx0  on ledger_release_log_${chain}  (address,txHash)`,
			// vote_proposl
			`create         index vote_proposal_${chain}_idx0    on vote_proposal_${chain}          (address)`,
			`create unique  index vote_proposal_${chain}_idx1    on vote_proposal_${chain}          (address,proposal_id)`,
			`create         index vote_proposal_${chain}_idx2    on vote_proposal_${chain}          (address,origin)`,
			// vots
			`create         index votes_${chain}_idx0            on votes_${chain}                  (address,proposal_id)`,
			`create unique  index votes_${chain}_idx1            on votes_${chain}                  (address,proposal_id,member_id)`,
			`create         index votes_${chain}_idx2            on votes_${chain}                  (address,member_id)`,
			// contract_info
			`create unique  index contract_info_${chain}_idx0    on contract_info_${chain}          (address)`,
		], `shs_${chain}`);
	}

	await main_db.load(`
		create table if not exists tasks (
			id           int primary        key auto_increment, -- 主键id
			name         varchar (64)                 not null, -- 任务名称, MekeDAO#Name
			args         json,                                  -- 执行参数数据
			data         json,                                  -- 成功或失败的数据 {data, error}
			step         int          default (0)     not null, -- 当前执行步骤
			stepTime     bigint       default (0)     not null, -- 当前执行步骤的超时时间,可用于执行超时检查
			user         varchar (64) default ('')    not null, -- 与用户的关联,完成后可以通知到客户端
			state        int          default (0)     not null, -- 0进行中,1完成,2失败
			time         bigint                       not null
		);
		`, [], [
		`create         index tasks_idx0    on    tasks          (name,state)`,
		`create         index tasks_idx1    on    tasks          (name)`,
		`create         index tasks_idx2    on    tasks          (state)`,
		`create         index tasks_idx3    on    tasks          (user)`,
	], `shs`);
}

export async function initialize() {
	if (cfg.fastStart) {
		await main_db.load(``, [], [], 'shs');
	} else {
		await load_main_db();
	}
	await storage.initialize(main_db);
}

export default main_db;