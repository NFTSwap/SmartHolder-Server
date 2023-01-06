
import {ChainType} from '../src/models/define';
import * as opensea from '../src/models/opensea';

export default async function() {
	// return getOrderParameters(ChainType.RINKEBY, '0x7200CC8180DE111306D8A99E254381080dA48Fd7', '1', 1e16.toString());
	return opensea.getOrders(ChainType.RINKEBY, '0x9D4C8Ee703BC7B7F269C8128487d1bB4ffD29454', 
		['0xb66f5506df99198f8b23ac37bda6818199cedc680899d778e573179bbcea3c6e', '0x16bea5fc6d583e061d1bffd8687b7544c877e9151e3dedc5837a9629f174eccf']
	);
}