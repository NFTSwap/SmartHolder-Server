//SPDX-License-Identifier: MIT
// pragma solidity 0.8.17;

// Module type
export const Module_Type = 0x6b27a068; // bytes4(keccak256('initDepartment(address,string,address)'))
export const AssetShell_Type = 0x43234e95; // bytes4(keccak256('initAssetShell(address,string,address,string)'))
export const Asset_Type = 0x68ca456f; // bytes4(keccak256('initAsset(address,string,address,string)'))
export const DAO_Type = 0xc7b55336; // bytes4(keccak256('initDAO(string,address,address,address,address,address,address)'))
export const Ledger_Type = 0xf4c38e51; // bytes4(keccak256('initLedger(address,string,address)'))
export const Member_Type = 0x23fc76b9; // bytes4(keccak256('initMember(address,string,address)'))
export const VotePool_Type = 0x0ddf27bf; // bytes4(keccak256('initVotePool(address,string)'))

// Module indexed id
export const Module_DAO_ID = 0;
export const Module_MEMBER_ID = 1;
export const Module_LEDGER_ID = 2;
export const Module_ASSET_ID = 3;
export const Module_ASSET_First_ID = 4;
export const Module_ASSET_Second_ID = 5;

// Departments Change tag
export const Change_Tag_Common = 0;
export const Change_Tag_Description = 1;
export const Change_Tag_Operator = 2;
export const Change_Tag_Upgrade = 3;
export const Change_Tag_DAO_Mission = 4;
export const Change_Tag_DAO_Module = 5;
export const Change_Tag_Asset_set_seller_fee_basis_points = 6;
export const Change_Tag_Asset_set_fee_recipient = 7;
export const Change_Tag_Member_Set_Executor = 8;

// Action Permission defines
export const Action_Member_Create = 0x22a25870; // bytes4(keccak256('create(address,string memory,Info memory,uint256[] memory)'))
export const Action_VotePool_Create = 0xdc6b0b72; // bytes4(keccak256('create(Proposal memory)'))
export const Action_VotePool_Vote = 0x678ea396;  // bytes4(keccak256('vote(uint256,uint256,int256,bool)'))
export const Action_Asset_SafeMint = 0x59baef2a; // bytes4(keccak256('safeMint(address,uint256,string memory,bytes calldata)'))
export const Action_DAO_Settings = 0xd0a4ad96; // bytes4(keccak256('DAO::settings()'))
export const Action_DAO_SetModule = 0x5d29163; // bytes4(keccak256('setModule(uint256,address)'))
export const Action_Asset_set_seller_fee_basis_points = 0x91eb3dee; // bytes4(keccak256('set_seller_fee_basis_points(uint32)'))
export const Action_Asset_Shell_Withdraw = 0x2e1a7d4d; // bytes4(keccak256('withdraw(uint256)'))
export const Action_Ledger_Withdraw = 0xf108a7d2; // bytes4(keccak256('withdraw(uint256,address,string)'))

// contract Constants {}