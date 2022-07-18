
import * as cfg from '../config';
export * from 'bclib/env';

const ENV = process.env;

export const sync_main    = 'WATCH_SYNC_MAIN'    in ENV ? !!(Number(ENV.WATCH_SYNC_MAIN)    || 0): !!cfg.sync_main;