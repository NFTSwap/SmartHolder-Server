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
import {ChainType} from './models/define';

export * from './models/define';

export const storage = new Storage();

// "animation_url": "https://storage.opensea.io/files/059b00a2e3443f5579742e8ae5392b9d.mp4"

export const main_db: DatabaseTools = cfg.mysql ? new MysqlTools(cfg.mysql as any): new sqlite.SQLiteTools(`${paths.var}/shs.db`);
export const local_db: DatabaseTools = new sqlite.SQLiteTools(`${paths.var}/mvp-ser-local.db`); // local db

if (pool) {
	pool.CHAREST_NUMBER = Charsets.UTF8MB4_UNICODE_CI;
}

async function load_main_db() {

	for ( let [k] of Object.entries(cfg.web3s)) {
		let chain = ChainType[k as any];
		await main_db.load(`

			create table if not exists dao_${chain} (
				id           int primary key auto_increment,
				host         varchar (42)                       not null, -- dao host or self address
				address      varchar (42)                       not null,
				name         varchar (64)                       not null,
				mission      varchar (1024)                     not null,
				description  varchar (1024)                     not null,
				root         varchar (42)                       not null,
				operator     varchar (42)                       not null,
				executor     varchar (66)        default ('')   not null,
				member       varchar (42)                       not null,
				ledger       varchar (42)                       not null,
				first        varchar (42)                       not null, -- opensea first
				second       varchar (42)                       not null, -- opensea second
				asset        varchar (42)                       not null,
				time         bigint                             not null,
				modify       bigint                             not null,
				blockNumber  int                                not null,
				assetIssuanceTax    int          default (0)    not null,
				assetCirculationTax int          default (0)    not null,
				defaultVoteTime     bigint       default (0)    not null,
				memberBaseName      varchar (32) default ('')   not null,
				memberTotalLimit    int          default (0)    not null
			);

			create table if not exists member_${chain} (
				id           int primary key auto_increment,
				host         varchar (64)               not null, -- dao host
				token        varchar (64)               not null, -- address
				tokenId      varchar (72)               not null, -- id
				owner        varchar (64)               not null, -- owner address
				name         varchar (64)               not null, -- member name
				description  varchar (512)              not null, -- member description
				image        varchar (512)              not null, -- member head portrait
				votes        int           default (0)  not null, -- default > 0
				time         bigint                     not null,
				modify       bigint                     not null,
				permissions  json                           null
			);

			create table if not exists asset_${chain} (
				id           int primary key auto_increment,
				token        varchar (64)               not null, -- address
				tokenId      varchar (72)               not null, -- id
				uri          varchar (512)              not null, -- tokenURI
				owner        varchar (64)  default ('') not null, -- 持有人
				author       varchar (64)  default ('') not null, -- 作者地址
				selling      int           default (0)  not null, -- 销售类型: 0未销售,1其它平台,2销售opensea
				sellPrice    varchar (72)  default ('') not null, -- 销售价格
				state        int           default (0)  not null, -- 状态: 0正常,1删除
				time         bigint                     not null, -- 数据入库时间
				modify       bigint                     not null, -- 修改时间（非链上数据修改）
				name                   varchar (256)  default ('') not null,  -- 名称
				imageOrigin            varchar (512)  default ('') not null,  -- origin image uri
				mediaOrigin            varchar (512)  default ('') not null,  -- origin media uri
				description            varchar (2048) default ('') not null,  -- 详细信息
				externalLink           varchar (512)  default ('') not null,  -- 外部链接
				properties             json                            null,  -- 附加信息
				blockNumber            int            default (0)  not null,  -- 创建区块号
				created_member_id      varchar (72)   default ('') not null,  -- 创建人成员id
				backgroundColor        varchar (32)   default ('') not null,  -- 背景
				categorie              int            default (0)  not null,  -- 类别
				retry                  int            default (0)  not null,  -- 抓取数据重试次数, sync uri data retry count
				retryTime              bigint         default (0)  not null   -- 抓取数据最后重试时间
			);

			create table if not exists asset_json_${chain} (
				id                     int    primary key auto_increment not null,
				asset_id               int    not null,
				json_data              json       null
			);

			create table if not exists asset_order_${chain} (           -- 资产订单 asset from -> to
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
				price        varchar (72)                 not null, -- 成交价格
				time         bigint                       not null, -- 时间
				blockNumber  int                          not null, -- 区块
				state        int             default (0)  not null,
				assetIncome_id int           default (0)  not null  -- ext data
			);

			create table if not exists ledger_asset_income_${chain} ( -- 财务记录-资产销售收
				id           int primary key auto_increment,
				ledger_id    int                          not null, -- ledger_id
				token        varchar (64)                 not null, -- 原始资产合约地址
				tokenId      char    (66)                 not null, -- 原始资产id
				source       varchar (64)                 not null, -- 进账来源
				balance      varchar (72)                 not null, -- 金额
				toAddress    varchar (64)                 not null, -- 资产转移目标地址
				saleType     int             default (0)  not null,
				blockNumber  int                          not null, -- 区块
				time         bigint                       not null  -- 时间
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
				originId     varchar (72)                 not null, -- 发起人成员id (member id),如果为0表示匿名成员
				target       json                             null, -- 目标合约,决议执行合约地址列表
				data         json                             null, -- 调用方法与实参列表
				lifespan     bigint                       not null, -- 投票生命周期(minutes)
				expiry       bigint                       not null, -- 过期时间（区块链时间单位）
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

			create table if not exists contract_info_${chain} (   -- 合约,监控数据源
				id           int primary key auto_increment,
				host         varchar (64)    default ('') not null,
				address      varchar (64)                 not null,
				type         int             default (0)  not null, -- contracts type
				blockNumber  int                          not null,
				abi          text,                                  -- 协约abi json,为空时使用默认值
				state        int             default (0)  not null, -- 状态: 0启用, 1禁用
				time         bigint                       not null  --
			);

			create table if not exists transaction_${chain} (
				id                int primary key auto_increment,
				nonce             int                          not null,
				blockNumber       int                          not null, -- input
				fromAddress       char (42)                    not null,
				toAddress         char (42)                    not null,
				value             varchar (66)                 not null,
				gasPrice          varchar (66)                 not null,
				gas               varchar (66)                 not null, -- gas limit
				-- data              text                             null, -- input data hex format
				blockHash         char (66)                    not null, -- receipt
				transactionHash   char (66)                    not null,
				transactionIndex  int                          not null,
				gasUsed           varchar (66)                 not null, -- use gasd
				cumulativeGasUsed varchar (66)                 not null,
				effectiveGasPrice varchar (66)                 not null,
				-- logsBloom         varchar (514)                not null,
				contractAddress   char (42)                        null, -- created contract address
				status            bit                          not null,
				logsCount         int                          not null -- logs count
			);

			create table if not exists transaction_log_${chain} (
				id                int primary key auto_increment,
				tx_id             int                          not null,
				address           char (42)                    not null,
				topic0            varchar (66)                 not null,
				topic1            varchar (66)  default ('')   not null,
				topic2            varchar (66)  default ('')   not null,
				topic3            varchar (66)  default ('')   not null,
				data              text                         null,
				logIndex          int                          not null,
				transactionIndex  int                          not null,
				transactionHash   char (66)                    not null,
				blockHash         char (66)                    not null,
				blockNumber       int                          not null
			);

		`, [
			// dao
			`alter table dao_${chain}  add assetIssuanceTax      int          default (0)  not null`,
			`alter table dao_${chain}  add assetCirculationTax   int          default (0)  not null`,
			`alter table dao_${chain}  add defaultVoteTime       bigint       default (0)  not null`,
			`alter table dao_${chain}  add memberBaseName        varchar (32) default ('') not null`,
			`alter table dao_${chain}  add first                 varchar (42) default ('')  not null`,
			`alter table dao_${chain}  add second                varchar (42) default ('')  not null`,
			`alter table dao_${chain}  add executor              varchar (66) default ('')  not null`,
			// asset
			`alter table asset_${chain} add name                 varchar (256)  default ('') not null  -- 名称`,
			`alter table asset_${chain} add imageOrigin          varchar (512)  default ('') not null  -- origin image uri`,
			`alter table asset_${chain} add mediaOrigin          varchar (512)  default ('') not null  -- origin media uri`,
			`alter table asset_${chain} add description          varchar (2048) default ('') not null  -- 详细信息`,
			`alter table asset_${chain} add externalLink         varchar (512)  default ('') not null  -- 外部链接`,
			`alter table asset_${chain} add properties           json                            null  -- 附加信息`,
			`alter table asset_${chain} add blockNumber          int            default (0)  not null  -- 创建区块号`,
			`alter table asset_${chain} add created_member_id    varchar (72)   default ('') not null  -- 创建人成员id`,
			`alter table asset_${chain} add backgroundColor      varchar (32)   default ('') not null  -- 背景`,
			`alter table asset_${chain} add categorie            int            default (0)  not null  -- 类别`,
			`alter table asset_${chain} add retry                int            default (0)  not null  -- 抓取数据重试次数, sync uri data retry count`,
			`alter table asset_${chain} add retryTime            bigint         default (0)  not null  -- 抓取数据最后重试时间`,
			// ledger
			`alter table ledger_${chain} add state               int            default (0)  not null`,
			`alter table ledger_${chain} add assetIncome_id      int            default (0)  not null`,
		], [
			// dao
			`create  unique index dao_${chain}_idx0              on dao_${chain}                    (address)`,
			`create         index dao_${chain}_idx1              on dao_${chain}                    (name)`,
			`create         index dao_${chain}_idx2              on dao_${chain}                    (asset)`,
			`create         index dao_${chain}_idx3              on dao_${chain}                    (first)`,
			`create         index dao_${chain}_idx4              on dao_${chain}                    (second)`,
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
			// ledger_asset_income
			`create unique  index ledger_asset_income_${chain}_idx0   on ledger_asset_income_${chain}  (ledger_id)`,
			`create         index ledger_asset_income_${chain}_idx1   on ledger_asset_income_${chain}  (token)`,
			`create         index ledger_asset_income_${chain}_idx2   on ledger_asset_income_${chain}  (token,tokenId)`,
			`create         index ledger_asset_income_${chain}_idx3   on ledger_asset_income_${chain}  (source)`,
			// ledger_release_log
			`create unique  index ledger_release_log_${chain}_idx0  on ledger_release_log_${chain}  (address,txHash)`,
			// vote_proposl
			`create         index vote_proposal_${chain}_idx0    on vote_proposal_${chain}          (address)`,
			`create unique  index vote_proposal_${chain}_idx1    on vote_proposal_${chain}          (address,proposal_id)`,
			`create         index vote_proposal_${chain}_idx2    on vote_proposal_${chain}          (address,origin)`,
			// votes
			`create         index votes_${chain}_idx0            on votes_${chain}                  (address,proposal_id)`,
			`create unique  index votes_${chain}_idx1            on votes_${chain}                  (address,proposal_id,member_id)`,
			`create         index votes_${chain}_idx2            on votes_${chain}                  (address,member_id)`,
			// contract_info
			`create unique  index contract_info_${chain}_idx0    on contract_info_${chain}          (address)`,
			// transaction
			`create unique  index transaction_${chain}_0         on transaction_${chain}            (transactionHash)`,
			`create         index transaction_${chain}_1         on transaction_${chain}            (blockHash)`,
			`create         index transaction_${chain}_2         on transaction_${chain}            (blockNumber)`,
			`create         index transaction_${chain}_3         on transaction_${chain}            (blockNumber,fromAddress)`,
			`create         index transaction_${chain}_4         on transaction_${chain}            (blockNumber,toAddress)`,
			`create         index transaction_${chain}_5         on transaction_${chain}            (fromAddress)`,
			`create         index transaction_${chain}_6         on transaction_${chain}            (toAddress)`,
			//transaction_log
			`create unique  index transaction_log_${chain}_0     on transaction_log_${chain}        (transactionHash,logIndex)`,
			`create         index transaction_log_${chain}_1     on transaction_log_${chain}        (transactionHash)`,
			`create         index transaction_log_${chain}_2     on transaction_log_${chain}        (blockNumber)`,
			`create         index transaction_log_${chain}_3     on transaction_log_${chain}        (blockNumber,address)`,
			`create         index transaction_log_${chain}_4     on transaction_log_${chain}        (address)`,
			`create         index transaction_log_${chain}_5     on transaction_log_${chain}        (address,topic0)`,
			`create         index transaction_log_${chain}_6     on transaction_log_${chain}        (address,topic0,topic1)`,
			`create         index transaction_log_${chain}_7     on transaction_log_${chain}        (address,topic0,topic1,topic2)`,
			`create         index transaction_log_${chain}_8     on transaction_log_${chain}        (address,topic0,topic1,topic2,topic3)`,
		], `shs_${chain}`);
	}

	await main_db.load(`
		create table if not exists events (
			id                   int primary        key auto_increment, -- 主键id
			host                 varchar (64)                 not null, -- dao host or self address
			title                varchar (64)                 not null, --
			description          varchar (4096)               not null,
			created_member_id    varchar (72)    default ('') not null,  -- 创建人成员id
			chain                int                          not null,
			state                int             default (0)  not null, -- 0正常,1删除
			time                 bigint                       not null,
			modify               bigint                       not null
		);
		`, [], [
		`create         index events_idx0    on   events         (chain,host,title)`,
	], `shs_0`);
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