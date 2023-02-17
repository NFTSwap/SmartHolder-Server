
import * as cfg from '../config';
export * from 'bclib/env';

const ENV = process.env;

export const watch_main    = 'WATCH_MAIN'      in ENV ? !!(Number(ENV.WATCH_MAIN)     || 0): !!cfg.watch_main;
export const watch_indexer = 'WATCH_INDEXER'   in ENV ? !!(Number(ENV.WATCH_INDEXER)  || 0): !!cfg.watch_indexer;