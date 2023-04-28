
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

export interface DAOSummarys {
	membersTotal: number;      // members total
	voteProposalTotal: number; // all proposals total
	voteProposalPendingTotal: number; // ongoing proposals
	voteProposalExecutedTotal: number; // resolutions complete executed
	voteProposalResolveTotal: number; // resolve total
	voteProposalRejectTotal: number; // reject total
	assetTotal: number;            // asset total
	assetMinimumPriceTotal: string; // asset total amount value
	assetOrderTotal: number;       // Asset order total
	assetOrderAmountTotal: string; // Asset order total amount value
	assetLedgerIncomeTotal: string; // Asset Ledger total Income value
}
