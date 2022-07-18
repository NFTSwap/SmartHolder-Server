/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-29
 */

// import * as http from 'http';
// http.globalAgent.maxSockets = 1000;
// console.log('maxSockets', http.globalAgent.maxSockets);

import somes from 'somes';

somes.config = __dirname + '/..'; // set config dir

export default async function runWorker() {
	await import('../src/uncaught');
	console.time('start');

	var env = await import('../src/env');
	var db = await import('../src/db');
	var msg = (await import('../src/message')).default;
	await (await import('bclib/init')).initialize(db.main_db, db.local_db); console.timeLog('bclib init');
	await (await import('../src/db')).initialize(); console.timeLog('mvp-ser db');
	await (await import('../src/keys')).default.initialize(); console.timeLog('keys');
	await (await import('../src/redis')).initialize(); console.timeLog('redis');

	if (env.disableWeb) {
		// await (await import('../src/ethereum')).start(); console.timeLog('ethereum');
	} else {
		await (await import('../src/server')).default.start(); console.timeLog('server');
		// await (await import('../src/ethereum')).start(); console.timeLog('ethereum');
		(await import('../src/server')).initializeApi(); console.timeLog('initialize api');
	}
	await (await import('../src/watch')).initialize(); console.timeLog('watch');

	//uncaught.abortOnUncaughtException(false);
	//console.timeLog('uncaught.abortOnUncaughtException(false)');

	console.timeEnd('start');

	// set api auth backdoor
	(await import('bclib/api')).setBackdoor(msg);
}
