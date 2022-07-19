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

export * from './models/def';

export const storage = new Storage();

// "animation_url": "https://storage.opensea.io/files/059b00a2e3443f5579742e8ae5392b9d.mp4"

export const main_db: DatabaseTools = cfg.mysql ? new MysqlTools(cfg.mysql as any): new sqlite.SQLiteTools(`${paths.var}/shs.db`);
export const local_db: DatabaseTools = new sqlite.SQLiteTools(`${paths.var}/shs-local.db`); // local db

if (pool) {
	pool.CHAREST_NUMBER = Charsets.UTF8MB4_UNICODE_CI;
}

async function load_main_db() {
	await main_db.load(`
		create table if not exists dao (
			id           int primary key auto_increment,
			host         varchar (64)   not null, -- dao host or self address
			address      varchar (64)   not null,
			name         varchar (64)   not null,
			mission      varchar (1024) not null,
			describe     varchar (1024) not null,
			root         varchar (64)   not null,
			operator     varchar (64)   not null,
			member       varchar (64)   not null,
			ledger       varchar (64)   not null,
			assetGlobal  varchar (64)   not null,
			asset        varchar (64)   not null,
			time         bigint         not null,
			modify       bigint         not null
		);

		create table if not exists member (
			id           int primary key auto_increment,
			host         varchar (64)    not null, -- dao host
			token        varchar (64)    not null, -- address
			tokenId      varchar (72)    not null, -- id
			uri          varchar (512)   not null, -- uri
			owner        varchar (64)    not null, -- owner address
			name         varchar (64)    not null, -- member name
			describe     varchar (512)   not null, -- member describe
			avatar       varchar (512)   not null, -- member head portrait
			role         int default (0) not null, -- default 0
			votes        int default (0) not null, -- default > 0
			time         bigint          not null,
			modify       bigint          not null
		);

		create table if not exists asset_global (
			id           int primary key auto_increment,
			host         varchar (64)    not null, -- dao host
			token        varchar (64)    not null, -- address
			tokenId      varchar (72)    not null,
			uri          varchar (512)   not null,
			owner        varchar (64)    not null,
			selling      int             not null, -- 销售类型: 0未销售,1销售opensea,2其它平台
			sellPrice    varchar (72)    not null, -- 销售价格
			state        int default (0) not null, -- 状态: 0正常,1删除
			time         bigint          not null,
			modify       bigint          not null
		);

		create table if not exists asset_order (      -- 资产订单 asset from -> to
			id           int    primary key auto_increment not null,
			txHash       char    (72)                      not null,  -- tx hash
			blockNumber  int                               not null,
			token        char    (42)                      not null,  -- 协约地址
			tokenId      char    (66)                      not null,  -- hash
			fromAddres   char    (42)                      not null,  -- from
			toAddress    char    (42)                      not null,  -- to
			value        varchar (66)         default ('') not null,  -- tx value
			describe     varchar (1024)       default ('') not null,
			time         bigint               default (0)  not null
		);

		create table if not exists ledger ( -- 财务记录
			id           int primary key auto_increment,
			host         varchar (64)                 not null, -- dao host
			address      varchar (64)                 not null, -- 合约地址
			txHash       varchar (72)                 not null, -- tx hash
			type         int             default (0)  not null, -- 0保留,1进账-无名接收存入,2进账-存入,3出账-取出,4出账-成员分成
			name         varchar (64)    default ('') not null, -- 转账名目
			describe     varchar (1024)  default ('') not null, -- 详细
			target       varchar (64)                 not null, -- 转账目标,进账为打款人,出账为接收人
			member       varchar (72)    default ('') not null, -- 成员出账id,如果为成员分成才会存在
			balance      varchar (72)                 not null, -- 金额
			time         bigint                       not null, -- 时间
			blockNumber  int                          not null  -- 区块
		);

		create table if not exisis ledger_release_log ( -- 成员分成日志
			id           int primary key auto_increment,
			operator     varchar (64)                 not null,
			log          varchar (1024)               not null,
			time         bigint                       not null,
			blockNumber  int                          not null
		);

		create table if not exisis vote_proposal ( -- 投票提案
			id           int primary key auto_increment,
			host         varchar (64)                 not null, -- dao host
			address      varchar (64)                 not null, -- 投票池合约地址
			proposal_id  varchar (72)                 not null, -- 提案id
			name         varchar (64)                 not null, -- 提案名称
			describe     varchar (1024)               not null, -- 提案描述
			origin       varchar (64)                 not null, -- 发起人
			target       varchar (64)                 not null, -- 执行目标合约地址
			data         text                         not null, -- 执行参数数据
			lifespan     bigint                       not null, -- 投票生命周期（minutes）
			expiry       bigint                       not null, -- 过期时间（区块链时间单位）
			voteRate     int                          not null, -- 投票率不小于全体票数50% (0-10000)
			passRate     int                          not null, -- 通过率不小于全体票数50% (0-10000)
			loop         int              default (0) not null, -- 执行循环次数: -1无限循环,0不循环
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

		create table if not exisis votes ( -- 投票
			id           int primary key auto_increment,
			proposal_id  varchar (72)                 not null, -- 提案id
			member_id    varchar (72)                 not null, -- 成员 id
			votes        int                          not null, -- 投票数量
			time         bigint                       not null,
			blockNumber  int                          not null
		);

		create table if not exists watch (
			id           int primary key auto_increment,
			address      varchar (64)                 not null,
			host         varchar (64)                 not null, -- dao host
			type         int          default (0)     nut null, -- contracts type
			state        int          default (0)     not null, -- 状态: 0启用, 1禁用
			time         bigint                       not null  -- 
		);
	`, [], [
		// member
		'create         index member_idx0           on member                 (host)',
		'create         index member_idx1           on member                 (token)',
		'create         index member_idx2           on member                 (token,owner)',
		'create         index member_idx3           on member                 (owner)',
		'create         index member_idx4           on member                 (name)',
		// asset global
		'create         index asset_global_idx0     on asset_global           (token)',
		'create         index asset_global_idx1     on asset_global           (token,owner)',
		// order
		'create         index asset_order_idx0      on asset_order            (token)',
		'create         index asset_order_idx1      on asset_order            (token,tokenId)',
		'create         index asset_order_idx2      on asset_order            (token,fromAddres)',
		'create         index asset_order_idx3      on asset_order            (token,toAddres)',
		// ledger
		'create         index ledger_idx0           on ledger                 (address)',
		'create         index ledger_idx1           on ledger                 (address,target)',
		'create         index ledger_idx2           on ledger                 (address,type)',
		'create         index ledger_idx3           on ledger                 (address,target,type)',
		// vote_proposal
		'create         index vote_proposal_idx0    on vote_proposal          (address)',
		'create unique  index vote_proposal_idx1    on vote_proposal          (address,proposal_id)',
		'create         index vote_proposal_idx2    on vote_proposal          (address,origin)',
		// votes
		'create         index votes_idx0            on votes                  (address,proposal_id)',
		'create unique  index votes_idx1            on votes                  (address,proposal_id,member_id)',
		'create         index votes_idx2            on votes                  (address,member_id)',
	], 'shs');
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