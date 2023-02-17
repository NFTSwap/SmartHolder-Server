
import {ChainType} from '../src/models/define';
import {getOrderState,getOrder} from '../src/models/opensea';

export default async function() {
	return getOrderState(ChainType.RINKEBY, '0x7200CC8180DE111306D8A99E254381080dA48Fd7', '1');
}