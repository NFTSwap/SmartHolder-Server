
import { DAO } from './define';

export interface DAOExtend extends DAO {
	isMember: boolean;
	isLike: boolean;
}

export interface DAOSummarys {
	membersTotal: number;
	voteProposalTotal: number; // all proposals total
	voteProposalPendingTotal: number; // ongoing proposals
	voteProposalExecutedTotal: number; // resolutions complete executed
	voteProposalResolveTotal: number; // resolve total
	voteProposalRejectTotal: number; // reject total
	assetTotal: number;
	assetAmountTotal: string;
	assetOrderTotal: number;
	assetOrderAmountTotal: string; // Asset order Amount
	assetLedgerIncomeTotal: string; // Asset Ledger Income
}