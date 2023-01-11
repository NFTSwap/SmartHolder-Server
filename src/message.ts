/**
 * @copyright © 2021 Copyright dphone.com
 * @date 2022-07-21
 */

import bus from 'bclib/message';
import {ChainType} from './models/define';

export const EventWatchBlock = 'WatchBlock';
export const EventNewIndexer = 'NewIndexer';

export function postWatchBlock(worker: number, blockNumber: number, chain: ChainType) {
	bus.post(EventWatchBlock, { worker, blockNumber, chain });
}

export function postNewIndexer(chain: ChainType, id: number) {
	bus.post(EventNewIndexer, { chain, id });
}

export default bus;
