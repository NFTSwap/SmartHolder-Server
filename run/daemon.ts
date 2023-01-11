/**
 * @copyright © 2022 Copyright SmartHolder Server
 * @date 2022-07-18
 */

import uncaught from '../src/uncaught';
import somes from 'somes';
import local_storage from 'bclib/storage';
import * as db from '../src/db';
import {Daemon} from 'bclib/daemon';
import * as cfg from '../config';
import * as net from 'net';

somes.config = __dirname + '/..'; // set config dir

var daemons: Daemon[] = [];

async function initialize() {
	// uncaught.abortOnUncaughtException(true);
	await local_storage.initialize(db.local_db); // init local db
	await db.initialize(); // init db;
	// uncaught.abortOnUncaughtException(false);
}

function runWebForwardServer() {
	return somes.promise<void>((resolve)=>{
		var {host, port} = cfg.server;
		net.createServer((socket: net.Socket) => {
			if (daemons.length) { // forward port
				var port = somes.random(0, daemons.length * 1e3) % daemons.length + 8320;
				var socket2 = net.createConnection(port, '127.0.0.1', ()=>{
					socket.pipe(socket2);
					socket.resume();
				});
				socket.pause();
				socket2.pipe(socket);
				socket.on('error', ()=>socket2.destroy());
				socket2.on('error', ()=>socket.destroy());
			} else {
				socket.destroy();
			}
		}).listen(port, host, resolve);
	});
}

export async function startWeb(workers?: number) {
	workers = workers || (cfg.env == 'dev' ? 2: 8);
	await initialize();
	await runWebForwardServer();

	for (var i = 0; i < workers; i++) {
		var dea = new Daemon(`shs-web_${i}`);
		await dea.start(process.execPath, [`--inspect=${9320+i}`, `${__dirname}/../`], {
			__WORKERS: workers,
			__WORKER: i,
			RUN_DAEMON: '',
			SERVER_HOST: '127.0.0.1',
			SERVER_PORT: 8320 + i,
			PROC_TYPE: 'web',
			WATCH_MAIN: 0,
		});
		daemons.push(dea);
	}
}

export async function startWatch(workers?: number) {
	workers =  workers || (cfg.env == 'dev' ? 2: 8);
	workers = Math.pow(2, Math.ceil(Math.log2(workers)));
	await initialize();

	for (var i = 0; i < workers; i++) {
		var dea = new Daemon(`shs-watch_${i}`);
		// `--max-heap-size=2048`, // 2048MB
		// `--trace-gc`, 
		// Scavenge
		var args = [`${__dirname}/../`];
		//if (!i)
		args.unshift(`--inspect=${9330+i}`); 
		await dea.start(process.execPath, args, {
			__WORKERS: workers,
			__WORKER: i,
			PROC_TYPE: 'watch',
			RUN_DAEMON: '',
			DISABLE_WEB: true,
		});
		daemons.push(dea);
	}
}

export async function startWeb3TxDequeue(workers?: number) {
	workers = workers || (cfg.env == 'dev' ? 2: 8);
	await initialize();

	for (var i = 0; i < workers; i++) {
		var dea = new Daemon(`shs-tx_${i}`);
		await dea.start(process.execPath, [`--inspect=${9340+i}`, `${__dirname}/../`], {
			__WORKERS: workers,
			__WORKER: i,
			PROC_TYPE: 'tx',
			RUN_DAEMON: '',
			WATCH_MAIN: 0,
			DISABLE_WEB: true,
			WEB3_TX_DEQUEUE: true,
		});
		daemons.push(dea);
	}
}