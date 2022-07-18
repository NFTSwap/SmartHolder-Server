
import * as cfg from '../config';
export * from 'bclib/env';

const ENV = process.env;

// export const sync_main    = 'MVP_SYNC_MAIN'    in ENV ? !!(Number(ENV.MVP_SYNC_MAIN)    || 0): cfg.sync_main;
// export const sync_meta    = 'MVP_SYNC_META'    in ENV ? !!(Number(ENV.MVP_SYNC_META)    || 0): cfg.sync_meta;
// export const sync_opensea = 'MVP_SYNC_OPENSEA' in ENV ? !!(Number(ENV.MVP_SYNC_OPENSEA) || 0): cfg.sync_opensea;
// export const noReceiveMsg = 'MVP_noReceiveMsg' in ENV ? !!(Number(ENV.MVP_noReceiveMsg) || 0): cfg.noReceiveMsg;