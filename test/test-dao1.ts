
import {ChainType} from '../src/models/define';
import {web3s} from '../src/web3+';
// import * as DAO from '../abi/DAO.json';

export default async function() {

	// let c1 = await web3s[ChainType.RINKEBY].createContract('0xa84E9A02d16E6f06Bdb038965ac4ffADA34917f2', DAO.abi as any);

	let web3 = web3s[ChainType.RINKEBY];

	let c = await web3.contract('0x283703CC092EC7621F286dE09De5Ca9279AE4F98');

	// web3.eth.abi.encodeParameters()

	let events = await c.getPastEvents('Change', {fromBlock: 11084585});

	return events;
}