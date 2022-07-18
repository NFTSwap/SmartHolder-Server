/**
 * @copyright © 2020 Copyright ccl
 * @date 2021-09-29
*/

export enum AssetType {
	INVALID = 0,
	ERC721 = 1,
	ERC1155,
	ERC20,
	INL_MATIC = 100, // 0x0000000000000000000000000000000000001010
	ERC721Proxy = (1 << 8) + 1,
	ERC1155Proxy,
}

export interface Asset {
	id: number;
	token: string;
	tokenId: string;
	count: string;
	uri: string;
	media: string;
	mediaOrigin: string;
	image: string;
	imageOrigin: string;
	type: AssetType;
	name: string;
	author: string;
	info: string; // description
	retry: number; // 抓取数据重试次数
	retryTime: number;
	syncTime: number;
	properties: any | null;
	contract?: AssetContract;
	chain: ChainType;
	externalLink: string;
	backgroundColor: string;
	// ext
	imageWidth: number;
	imageHeight: number;
	animationUrl: string;
	animationWidth: number;
	animationHeight: number;
	symbol: string;
	tokenMetadata: string;
	numVisitors: number;
	isCurated: boolean;
	isNsfw: boolean;
	frozenAt: string;
	decimals: number;
	usdSpotPrice: number;
	opensea_id: string;
	displayName: string;
	collection: string;
	favoritesCount: number;
	imageUrl: String;
	displayImageUrl: String;
	hasUnlockableContent: boolean;
	imagePreviewUrl: string;
	imageThumbnailUrl: string;
	isDelisted: boolean;
	isFavorite: boolean;
	isCurrentlyFungible: boolean;
	isListable: boolean;
	isFrozen: boolean;
	isEditable: boolean;
	isEditableByOwner: boolean;
	isFreezable: boolean;
	createdDate: number;
	modifiedDate: number;
	relayId: string;
	bestAsk: string; // 最低售价
	bestBid: string; // 最高出价
	lastSale: string; // 最后成交价格
}

export interface AssetJson {
	id: number;
	asset_id: number;
	json: any;
}

export interface SyncMetaFirst {
	id: number;
	address: string;
	info: string;
	status: number;
}

export interface AssetMy extends Asset {
	owner: string;
	ownerBase?: string; // 这个表示委托人,也是nft的真正持有者
	owners?: string[];
}

export interface AssetOwner {
	id: number;
	token: string;
	tokenId: string;
	owner: string;
	ownerBase?: string;
	count: string;
	chain: ChainType;
}

export interface AssetOrder {
	id: number;//           int    primary key auto_increment not null,
	txHash: string;//       char    (130)                     not null,  -- tx hash
	blockNumber: number;//  int                               not null,
	token: string;//        char    (42)                      not null,  -- 协约地址
	tokenId: string;//      char    (66)                      not null,  -- hash
	fromAddres: string;//   char    (42)                      not null,  -- from
	toAddress: string;//    char    (42)                      not null,  -- to
	count: string;//        varchar (66)                      not null,  -- asset 数量
	value: string;//        varchar (128)        default ('') not null,  -- tx value
	chain: ChainType;//     int                  default (0)  not null,  -- ETHEREUM|MATIC...
	description: string;//  varchar (1024)       default ('') not null,
	date: number;//         bigint               default (0)  not null
}

export interface AssetContract {
	id: number;
	address: string;
	name: string;
	symbol: string;
	openseaVersion: string;
	tokenStandard: string;
	isSharedStorefront: boolean;
	opensea_id: string;
	blockExplorerLink: string;
	chain: ChainType;
	createdDate: number;
	modifiedDate: number;
	relayId: string;
	state: number;
	type: AssetType;
	platform: string;
	sync_height: number;
	init_height: number;
	abi: string | null;
}

export enum ChainType {
	UNKNOWN = 0, // UNKNOWN
	ETHEREUM = 1, // ETHEREUM
	MATIC = 137, // MATIC
	KLAYTN = 8217, // KLAYTN
	XDAI = 100, // XDAI
	BSC = 56, // BSC
	FLOW = -2, // FLOW
	LOCAL = -1, // LOCAL
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
	FLOW = [ChainType.FLOW, 18, 'FLOW',];
	LOCAL = [ChainType.LOCAL, 18, 'LOCAL',];
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