/**
 * @copyright © 2022 Smart Holder Server
 * @date 2022-07-19
*/

export interface DAO {
	id: number;//           int primary key auto_increment,
	host: string;//         varchar (64)   not null, -- dao host or self address
	address: string;//      varchar (64)   not null,
	name: string;//         varchar (64)   not null,
	mission: string;//      varchar (1024) not null,
	describe: string;//     varchar (1024) not null,
	root: string;//         varchar (64)   not null,
	operator: string;//     varchar (64)   not null,
	member: string;//       varchar (64)   not null,
	ledger: string;//       varchar (64)   not null,
	assetGlobal: string;//  varchar (64)   not null,
	asset: string;//        varchar (64)   not null,
	time: number;//         bigint         not null,
	modify: number;//       bigint         not null
}

export interface Member {
	id: number;//           int primary key auto_increment,
	host: string;//         varchar (64)    not null, -- dao host
	token: string;//        varchar (64)    not null, -- address
	tokenId: string;//      varchar (72)    not null, -- id
	uri: string;//          varchar (512)   not null, -- uri
	owner: string;//        varchar (64)    not null, -- owner address
	name: string;//         varchar (64)    not null, -- member name
	describe: string;//     varchar (512)   not null, -- member describe
	avatar: string;//       varchar (512)   not null, -- member head portrait
	role: number;//         int default (0) not null, -- default 0
	votes: number;//        int default (0) not null, -- default > 0
	time: number;//         bigint          not null,
	modify: number;//       bigint          not null
}

export enum Selling { // 销售类型
	Unsell,  // 0未销售
	Opensea, // 1销售opensea
	Order,   // 2其它平台
}

export interface AssetGlobal {
	id: number;
	host: string;
	token: string;
	tokenId: string;
	uri: string;
	owner: string;
	selling: Selling;
	sellPrice: string;
	state: number; // 状态: 0正常,1删除
	time: number;
	modify: number;
}

export interface AssetExt extends AssetGlobal {
	media: string;
	mediaOrigin: string;
	image: string;
	imageOrigin: string;
	name: string;
	info: string; // description
	externalLink: string;
	properties: any | null;
}

export interface AssetOrder {
	id: number;//           int    primary key auto_increment not null,
	txHash: string;//       char    (130)                     not null,  -- tx hash
	blockNumber: number;//  int                               not null,
	token: string;//        char    (42)                      not null,  -- 协约地址
	tokenId: string;//      char    (66)                      not null,  -- hash
	fromAddres: string;//   char    (42)                      not null,  -- from
	toAddress: string;//    char    (42)                      not null,  -- to
	value: string;//        varchar (128)        default ('') not null,  -- tx value
	describe: string;   //  varchar (1024)       default ('') not null,
	time: number;//         bigint               default (0)  not null
}

export enum LedgerType {
	Reserved, // 0保留
	Receive, // 1进账-无名接收存入
	Deposit, // 2进账-存入
	Withdraw,// 3出账-取出
	Release,// 4出账-成员分成
}

export interface Ledger {
	id: number;//           int primary key auto_increment,
	host: string;//         varchar (64)                 not null, -- dao host
	address: string;//      varchar (64)                 not null, -- 合约地址
	txHash: string;//       varchar (72)                 not null, -- tx hash
	type: LedgerType;//     int             default (0)  not null, -- 0保留,1进账-无名接收存入,2进账-存入,3出账-取出,4出账-成员分成
	name: string;//         varchar (64)    default ('') not null, -- 转账名目
	describe: string;//     varchar (1024)  default ('') not null, -- 详细
	target: string;//       varchar (64)                 not null, -- 转账目标,进账为打款人,出账为接收人
	member: string;//       varchar (72)    default ('') not null, -- 成员出账id,如果为成员分成才会存在
	balance: string;//      varchar (72)                 not null, -- 金额
	time: number;//         bigint                       not null, -- 时间
	blockNumber: number;//  int                          not null  -- 区块
}

export interface VoteProposal {
	id: number;//           int primary key auto_increment,
	host: string;//         varchar (64)                 not null, -- dao host
	address: string;//      varchar (64)                 not null, -- 投票池合约地址
	proposal_id: string;//  varchar (72)                 not null, -- 提案id
	name: string;//         varchar (64)                 not null, -- 提案名称
	describe: string;//     varchar (1024)               not null, -- 提案描述
	origin: string;//       varchar (64)                 not null, -- 发起人
	target: string;//       varchar (64)                 not null, -- 执行目标合约地址
	data: string;//         text                         not null, -- 执行参数数据
	lifespan: number;//     bigint                       not null, -- 投票生命周期（minutes）
	expiry: number;//       bigint                       not null, -- 过期时间（区块链时间单位）
	voteRate: number;//     int                          not null, -- 投票率不小于全体票数50% (0-10000)
	passRate: number;//     int                          not null, -- 通过率不小于全体票数50% (0-10000)
	loop: number;//         int              default (0) not null, -- 执行循环次数: -1无限循环,0不循环
	loopTime: number;//     bigint           default (0) not null, -- 执行循环间隔时间
	voteTotal: number;//    bigint           default (0) not null, -- 投票总数
	agreeTotal: number;//   bigint           default (0) not null, -- 通过总数
	executeTime: number;//  bigint           default (0) not null, -- 上次执行的时间
	isAgree: boolean;//     bit              default (0) not null, -- 是否通过采用
	isClose: boolean;//     bit              default (0) not null, -- 投票是否截止
	isExecuted: boolean;//  bit              default (0) not null  -- 是否已执行完成
	time: number;//         bigint                       not null,
	modify: number;//       bigint                       not null,
	blockNumber: number;//  int                          not null
}

export interface Votes {
	id: number;//           int primary key auto_increment,
	proposal_id: string;//  varchar (72)                 not null, -- 提案id
	member_id: string;//    varchar (72)                 not null, -- 成员 id
	votes: number;//        int                          not null, -- 投票数量
	time: number;//         bigint                       not null,
	blockNumber: number;//  int                          not null
}

export interface Watch {
	id: number;//           int primary key auto_increment,
	address: string;//      varchar (64)                 not null,
	host: string;//         varchar (64)                 not null, -- dao host
	type: number;//         int          default (0)     nut null, -- contracts type
	state: number;//        int          default (0)     not null, -- 状态: 0启用, 1禁用
	time: number;//         bigint                       not null  -- 
}