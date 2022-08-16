
import {ChainType} from '../src/models/def';
import {getOrderParameters} from '../src/models/opensea';

export default async function() {
	return getOrderParameters(ChainType.RINKEBY, '0x7200CC8180DE111306D8A99E254381080dA48Fd7', '1', 1e16.toString());
}