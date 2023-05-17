/**
 * @copyright © 2022 Copyright SmartHolder Server
 * @date 2022-07-18
 */

// import * as http from 'http';
// http.globalAgent.maxSockets = 1000;
// console.log('maxSockets', http.globalAgent.maxSockets);

import somes from 'somes';
import * as cfg from '../config'; somes.config = __dirname + '/..'; // set config dir
import * as cfg_ from 'bclib/cfg'; Object.assign(cfg, cfg_);

export default async function runWorker() {
	// await (await import('../src/sync/block')).testDB();

	await import('../src/uncaught');
	console.time('start');
	// var cfg = await import('../config');
	var env = await import('../src/env');
	var db = await import('../src/db');
	var msg = (await import('../src/message')).default;
	await (await import('bclib/init')).initialize(db.main_db, db.local_db); console.timeLog('bclib init');
	await (await import('../src/db')).initialize(); console.timeLog('SmartHolder-Server db');
	await (await import('../src/keys')).default.initialize(); console.timeLog('keys');
	await (await import('bclib/redis')).default.initialize(true); console.timeLog('redis');
	if (!env.disableWeb) {
		await (await import('../src/server')).default.start(); console.timeLog('server');
	}
	await (await import('../src/watch')).initialize(); console.timeLog('watch');

	//uncaught.abortOnUncaughtException(false);
	//console.timeLog('uncaught.abortOnUncaughtException(false)');

	console.timeEnd('start');

	// set api auth backdoor
	(await import('bclib/api')).setBackdoor(msg);
}
