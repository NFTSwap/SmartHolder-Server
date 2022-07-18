
import { AssetContract, AssetType, ChainType } from './models/def';

export const defaultAssetContract: Partial<AssetContract>[] = [
	// rinkeby
	{ address: '0xb57C79944EE0E33F24E90213AD6E4D04CE4d2ED7', type: AssetType.ERC721, chain: ChainType.RINKEBY, platform: 'opensea' },
	{ address: '0xeFb839f7a22e40aF0a22B0854D74428481ceA714', type: AssetType.ERC721, chain: ChainType.RINKEBY, platform: 'opensea' },
	{ address: '0x88B48F654c30e99bc2e4A1559b4Dcf1aD93FA656', type: AssetType.ERC1155, chain: ChainType.RINKEBY, platform: 'opensea' },
	// rinkeby proxy
	{ address: '0x8c51a0B1Fe8995E7f5b968b0e9b1AD4f50b91B68', type: AssetType.ERC721Proxy, chain: ChainType.RINKEBY, platform: 'mvp' }, // old
	{ address: '0xf5c7c334257e4F2514Ab34DD1620Bc8B9d4911B8', type: AssetType.ERC1155Proxy, chain: ChainType.RINKEBY, platform: 'mvp' }, // old
	{ address: '0xD7697b54A2285F859b373a6A7990e1B89810DC4B', type: AssetType.ERC721Proxy, chain: ChainType.RINKEBY, platform: 'mvp' },
	{ address: '0x23e58Cef10Fdd4CAb805F167b8FC64fedc27F6BE', type: AssetType.ERC1155Proxy, chain: ChainType.RINKEBY, platform: 'mvp' },
];
