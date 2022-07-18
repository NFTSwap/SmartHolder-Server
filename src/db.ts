/**
 * @copyright © 2020 Copyright ccl
 * @date 2021-06-28
*/

import * as sqlite from 'bclib/sqlite';
import paths from 'bclib/paths';
import {Storage} from 'bclib/storage';
import {DatabaseTools} from 'somes/db';
import {MysqlTools} from 'somes/mysql';
import pool from 'somes/mysql/pool';
import {Charsets} from 'somes/mysql/constants';
import * as cfg from '../config';
import cfg2 from 'bclib/cfg';

export * from './models/def';

export const storage = new Storage();

// "animation_url": "https://storage.opensea.io/files/059b00a2e3443f5579742e8ae5392b9d.mp4"

export const main_db: DatabaseTools = cfg.mysql ? new MysqlTools(cfg.mysql as any): new sqlite.SQLiteTools(`${paths.var}/SmartHolder-Server.db`);

if (pool) {
	pool.CHAREST_NUMBER = Charsets.UTF8MB4_UNICODE_CI;
}

function load_main_db() {
	return main_db.load(`
	`, [
	], [
	], 'SmarhHolder-Server');
}

export async function initialize() {

	if (cfg2.fastStart) {
		await main_db.load(``, [], [], 'SmarhHolder-Server');
	} else {
		await load_main_db();
	}

	await storage.initialize(main_db);
}

export default main_db;