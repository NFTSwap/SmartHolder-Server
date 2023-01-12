/**
 * @copyright © 2021 Copyright dphone.com
 * @date 2022-07-21
 */

import bus from 'bclib/message';
import {ChainType} from './models/define';

export const EventWatchBlock = 'WatchBlock';
export const EventNewIndexer = 'NewIndexer';
export const EventIndexerNextBlock = 'IndexerNextBlock';

export function postWatchBlock(worker: number, blockNumber: number, chain: ChainType) {
	bus.post(EventWatchBlock, { worker, blockNumber, chain });
}

export function postNewIndexer(chain: ChainType, indexer_id: number) {
	bus.post(EventNewIndexer, { chain, indexer_id });
}

export function postIndexerNextBlock(chain: ChainType, indexer_id: number, hash: string, blockNumber: number ) {
	bus.post(EventNewIndexer, { chain, indexer_id, hash, blockNumber });
}

export default bus;
