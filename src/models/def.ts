/**
 * @copyright © 2022 Smart Holder Server
 * @date 2022-07-19
*/

export class Entity<T> {
	readonly value: T;
	constructor(value: T) {
		this.value = value;
	}
}

export interface DAO {
	id: number;//           int primary key auto_increment,
	host: string;//         varchar (64)   not null, -- dao host or self address
	address: string;//      varchar (64)   not null,
	name: string;//         varchar (64)   not null,
	mission: string;//      varchar (1024) not null,
	description: string;//     varchar (1024) not null,
	root: string;//         varchar (64)   not null,
	operator: string;//     varchar (64)   not null,
	member: string;//       varchar (64)   not null,
	ledger: string;//       varchar (64)   not null,
	assetGlobal: string;//  varchar (64)   not null,
	asset: string;//        varchar (64)   not null,
	time: number;//         bigint         not null,
	modify: number;//       bigint         not null
	blockNumber: number;//  int            not null,
	assetIssuanceTax: number;//    int default (0)   not null, // 发行税
	assetCirculationTax: number;// int default (0)   not null, // 流转税
	defaultVoteRate: number;//     int default (0)   not null, // 默认最小参与率
	defaultVotePassRate: number;// int default (0)   not null  // 默认最小投票率
	defaultVoteTime: number; // bigint         default (0)    not null,
	memberBaseName: string; // varchar (32)   default ('')   not null,
	memberTotalLimit: number; // int          default (0)    not null
}

export interface Member {
	id: number;//           int primary key auto_increment,
	host: string;//         varchar (64)    not null, -- dao host
	token: string;//        varchar (64)    not null, -- address
	tokenId: string;//      varchar (72)    not null, -- id
	uri: string;//          varchar (512)   not null, -- uri
	owner: string;//        varchar (64)    not null, -- owner address
	name: string;//         varchar (64)    not null, -- member name
	description: string;//     varchar (512)   not null, -- member description
	avatar: string;//       varchar (512)   not null, -- member head portrait
	role: number;//         int default (0) not null, -- default 0
	votes: number;//        int default (0) not null, -- default > 0
	time: number;//         bigint          not null,
	modify: number;//       bigint          not null
}

export enum Selling { // 销售类型
	UnsellOrUnknown  = 0,  // 0未销售or未知
	Order   = 1 << 0,   // 2其它平台
	Opensea = 1 << 1, // 1销售opensea
}

export enum State {
	Enable,
	Disable,
}

export interface Asset {
	id: number;
	token: string; // 合约地址
	tokenId: string; // id
	uri: string; // tokenURI
	owner: string; // 属主
	author: string; // 作者地址
	selling: Selling; // 销售类型: 0未销售,1销售opensea,2其它平台
	sellPrice: string; // 销售价格
	state: State; // 状态: 0正常,1删除
	time: number; // 数据入库时间
	modify: number; // 修改时间（非链上数据修改）
	name: string;//                   varchar (256)  default ('') not null,  -- 名称
	imageOriign: string;//            varchar (512)  default ('') not null,  -- origin image uri
	mediaOrigin: string;//            varchar (512)  default ('') not null,  -- origin media uri
	description: string;//            varchar (2048) default ('') not null,  -- 详细信息
	externalLink: string;//           varchar (512)  default ('') not null,  -- 外部链接
	properties: any | null;//         json                            null,  -- 附加信息
	blockNumber: number;//            int            default (0)  not null,  -- 创建区块号
	created_member_id: string;//      varchar (72)   default ('') not null,  -- 创建人成员id
	backgroundColor: string;//        varchar (32)   default ('') not null,  -- 背景
	categorie: number;//              int            default (0)  not null,  -- 类别
	retry: number;//                  int            default (0)  not null   -- 抓取数据重试次数, sync uri data retry count
	retryTime: number;//              bigint         default (0)  not null,  -- 抓取数据最后重试时间
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
	description: string;   //  varchar (1024)       default ('') not null,
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
	description: string;//     varchar (1024)  default ('') not null, -- 详细
	target: string;//       varchar (64)                 not null, -- 转账目标,进账为打款人,出账为接收人
	member_id: string;//    varchar (72)    default ('') not null, -- 成员出账id,如果为成员分成才会存在
	balance: string;//      varchar (72)                 not null, -- 金额
	time: number;//         bigint                       not null, -- 时间
	blockNumber: number;//  int                          not null  -- 区块
	state: State;
}

export interface LedgerReleaseLog {
	id: number;//           int primary key auto_increment,
	address: string;//      varchar (64)                 not null, -- 合约地址
	operator: string;//     varchar (64)                 not null,
	txHash: string;//       varchar (72)                 not null, -- tx hash
	log: string;//          varchar (1024)               not null,
	balance: string;//      varchar (72)                 not null, -- 金额
	time: number;//         bigint                       not null,
	blockNumber: number;//  int                          not null
}

export interface VoteProposal {
	id: number;//           int primary key auto_increment,
	host: string;//         varchar (64)                 not null, -- dao host
	address: string;//      varchar (64)                 not null, -- 投票池合约地址
	proposal_id: string;//  varchar (72)                 not null, -- 提案id
	name: string;//         varchar (64)                 not null, -- 提案名称
	description: string;//     varchar (1024)               not null, -- 提案描述
	origin: string;//       varchar (64)                 not null, -- 发起人
	target: string;//       varchar (64)                 not null, -- 执行目标合约地址
	data: string;//         text                         not null, -- 执行参数数据
	lifespan: number;//     bigint                       not null, -- 投票生命周期（minutes）
	expiry: number;//       bigint                       not null, -- 过期时间（区块链时间单位）
	voteRate: number;//     int                          not null, -- 投票率不小于全体票数50% (0-10000)
	passRate: number;//     int                          not null, -- 通过率不小于全体票数50% (0-10000)
	loopCount: number;//    int              default (0) not null, -- 执行循环次数: -1无限循环,0不循环
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
	address: string;//      varchar (64)                 not null, -- 投票池合约地址
	proposal_id: string;//  varchar (72)                 not null, -- 提案id
	member_id: string;//    varchar (72)                 not null, -- 成员 id
	votes: number;//        int                          not null, -- 投票数量
	time: number;//         bigint                       not null,
	blockNumber: number;//  int                          not null
}

export enum ContractType {
	Invalid,
	ERC721,
	DAO,
	Member,
	Ledger,
	VotePool,
	Asset,
	AssetGlobal,
}

export interface ContractInfo {
	id: number;//           int primary key auto_increment,
	host: string;
	address: string;//      varchar (64)                 not null,
	type: ContractType;//   int          default (0)     nut null, -- contracts type
	blockNumber: number;//  合约部署高度
	abi: string | null; //  abi
	state: State; //        int          default (0)     not null, -- 状态: 0启用, 1禁用
	time: number; //        bigint                       not null  -- 
}

export enum ChainType {
	UNKNOWN = 0, // UNKNOWN
	ETHEREUM = 1, // ETHEREUM
	MATIC = 137, // MATIC
	KLAYTN = 8217, // KLAYTN
	XDAI = 100, // XDAI
	BSC = 56, // BSC
	ROPSTEN = 3, // ROPSTEN
	RINKEBY = 4, // RINKEBY
	MUMBAI = 80001, // MUMBAI
	BAOBAB = 1001, // BAOBAB
	BSC_TESTNET = 97, // BSC_TESTNET
	GOERLI = 5, // GOERLI
	HCETH = 64, // hard-chain ETHEREUM
	BSN_TEST = 5555,
	BSN = 5555,
	HASHII_TEST = 6666,
	HASHII = 6667,
}

// Network Name: Klaytn Cypress
// New RPC URL: (Default: https://public-node-api.klaytnapi.com/v1/cypress)
// Block Explorer URL: https://scope.klaytn.com/
// Chain ID: 8217

// Network Name: Klaytn Baobab
// New RPC URL: https://api.baobab.klaytn.net:8651 (Default: http://localhost:8551)
// Block Explorer URL: https://baobab.scope.klaytn.com/
// Chain ID: 1001

// Network Name: Gnosis Chain
// New RPC URL: https://rpc.xdaichain.com/
// Chain ID: 0x64
// Symbol: xDai
// Block Explorer URL: https://blockscout.com/xdai/mainnet

// Network Name: BSC
// New RPC URL: https://bsc-dataseed.binance.org/
// ChainID: 56
// Symbol: BNB
// Block Explorer URL: https://bscscan.com

// Network Name: BSC Testnet
// New RPC URL: https://data-seed-prebsc-1-s1.binance.org:8545/
// ChainID: 97
// Symbol: BNB
// Block Explorer URL: https://testnet.bscscan.com

export class ChainTraits {
	UNKNOWN = [ChainType.UNKNOWN, 0, 'UNK'];
	ETHEREUM = [ChainType.ETHEREUM, 18, 'ETH'];
	MATIC = [ChainType.MATIC, 18, 'MATIC'];
	KLAYTN = [ChainType.KLAYTN, 18, 'KLAY'];
	XDAI = [ChainType.XDAI, 18, 'XDAI'];
	BSC = [ChainType.BSC, 18, 'BNB'];
	ROPSTEN = [ChainType.ROPSTEN, 18, 'ROPSTEN'];
	RINKEBY = [ChainType.RINKEBY, 18, 'RINKEBY'];
	MUMBAI = [ChainType.MUMBAI, 18, 'MUMBAI'];
	BAOBAB = [ChainType.BAOBAB, 18, 'BAOBAB'];
	BSC_TESTNET = [ChainType.BSC_TESTNET, 18, 'BNB_TEST'];
	GOERLI = [ChainType.GOERLI, 18, 'GOERLI'];
	HCETH = [ChainType.HCETH, 18, 'ETH'];
	BSN_TEST = [ChainType.BSN_TEST, 18, 'BSN_TEST'];
	BSN = [ChainType.BSN, 18, 'BSN'];
	HASHII_TEST = [ChainType.HASHII_TEST, 18, 'HASHII_TEST'];
	HASHII = [ChainType.HASHII, 18, 'HASHII'];
}

export const chainTraits = new ChainTraits();

export interface Tasks<Args = any> {
	id: number;//           int primary        key auto_increment, -- 主键id
	name: string;//         varchar (64)                 not null, -- 任务名称
	args: Args;//            json,                                  -- 执行参数
	data: any;
	step: number;//         int        default (0)       not null, -- 当前执行步骤
	stepTime: number;//     int          default (0)     not null, -- 当前执行步骤
	user: string; //        varchar (64) default ('')    not null, -- 与用户的关联,完成后可以通知到客户端
	state: number;//        int        default (0)       not null, -- 0进行中,1完成,2失败
	time: number;//         bigint                       not null,
}

export interface EventsItem {
	id: string;//                   int primary        key auto_increment, -- 主键id
	host: string; //                varchar (64)                 not null,
	title: string;//                varchar (64)                 not null, --
	description: string;//          varchar (4096)               not null,
	created_member_id: string;//    varchar (72)    default ('') not null,  -- 创建人成员id
	chain: ChainType;//             int                          not null,
	state: number;//                int             default (0)  not null, -- 0正常,1删除
	time: number;//                 bigint                       not null,
	modify: number;//               bigint                       not null
}

export interface AssetJson {
	id: number;
	asset_id: number;
	json_data: any;
}
