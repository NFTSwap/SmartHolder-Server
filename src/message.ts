/**
 * @copyright © 2021 Copyright dphone.com
 * @date 2022-07-21
 */

import bus from 'bclib/message';
import {ChainType} from './models/def';

export enum Events {
	WatchBlock = 'WatchBlock',
}

export function broadcastWatchBlock(worker: number, blockNumber: number, chain: ChainType) {
	bus.post(Events.WatchBlock, { worker, blockNumber, chain });
}

export default bus;
