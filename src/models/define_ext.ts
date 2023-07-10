
import { DAO,AssetOrder,Asset, Member,AssetOwner } from './define';

export interface AssetOrderExt extends AssetOrder {
	asset?: Asset;
}

export interface AssetExt extends Asset {
	dao?: DAO;
	asset_owner?: AssetOwner;
}

export interface DAOExtend extends DAO {
	isMember?: boolean;
	isLike?: boolean;
	memberObjs?: Member[];
}