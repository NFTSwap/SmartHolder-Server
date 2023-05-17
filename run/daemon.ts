/**
 * @copyright © 2022 Copyright SmartHolder Server
 * @date 2022-07-18
 */

import somes from 'somes';
import * as cfg from '../config'; somes.config = __dirname + '/..'; // set config dir
import cfg_ from 'bclib/cfg'; Object.assign(cfg, cfg_);

import uncaught from '../src/uncaught';
import local_storage from 'bclib/storage';
import * as db from '../src/db';
import {Daemon} from 'bclib/daemon';

import * as net from 'net';

const ENV   = process.env;
const debug = 'DEUBG' in ENV ? !!(Number(ENV.DEUBG) || 0): !!cfg.debug;

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
				let port_ = (somes.random(0, daemons.length * 1e3) % daemons.length) + port + 1;
				let socket2 = net.createConnection(port_, '127.0.0.1', ()=>{
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

	for (var i = 0, port = cfg.server.port; i < workers; i++) {
		var dea = new Daemon(`shs-web_${i}`);
		await dea.start(process.execPath, [...(debug?[`--inspect=${port+1000+i}`]:[]), `${__dirname}/../`], {
			__WORKERS: workers, __WORKER: i,
			PROC_TYPE: 'web', RUN_DAEMON: '',
			SERVER_HOST: '127.0.0.1',
			SERVER_PORT: port + 1 + i,
			WATCH_MAIN: 0, WATCH_INDEXER: 0,
		});
		daemons.push(dea);
	}
}

export async function startWatch(workers?: number) {
	workers =  workers || (cfg.env == 'dev' ? 2: 8);
	workers = Math.pow(2, Math.ceil(Math.log2(workers)));
	await initialize();

	for (var i = 0, port = cfg.server.port; i < workers; i++) {
		var dea = new Daemon(`shs-watch_${i}`);
		// `--max-heap-size=2048`, // 2048MB
		// `--trace-gc`, 
		await dea.start(process.execPath, [...(debug?[`--inspect=${port+1100+i}`]:[]), `${__dirname}/../`], {
			__WORKERS: workers, __WORKER: i,
			PROC_TYPE: 'watch', RUN_DAEMON: '',
			DISABLE_WEB: 1, WATCH_MAIN: 1, WATCH_INDEXER: 0,
		});
		daemons.push(dea);
	}
}

export async function startIndexer(workers?: number) {
	workers =  workers || (cfg.env == 'dev' ? 2: 8);
	workers = Math.pow(2, Math.ceil(Math.log2(workers)));
	await initialize();

	for (var i = 0, port = cfg.server.port; i < workers; i++) {
		var dea = new Daemon(`shs-indexer_${i}`);
		await dea.start(process.execPath, [...(debug?[`--inspect=${port+1200+i}`]:[]), `${__dirname}/../`], {
			__WORKERS: workers, __WORKER: i,
			PROC_TYPE: 'indexer', RUN_DAEMON: '',
			DISABLE_WEB: 1, WATCH_MAIN: 0, WATCH_INDEXER: 1,
		});
		daemons.push(dea);
	}
}

export async function startWeb3TxDequeue(workers?: number) {
	workers = workers || (cfg.env == 'dev' ? 2: 8);
	await initialize();

	for (var i = 0, port = cfg.server.port; i < workers; i++) {
		var dea = new Daemon(`shs-tx_${i}`);
		await dea.start(process.execPath, [...(debug?[`--inspect=${port+1300+i}`]:[]), `${__dirname}/../`], {
			__WORKERS: workers, __WORKER: i,
			PROC_TYPE: 'tx', RUN_DAEMON: '',
			DISABLE_WEB: 1, WATCH_MAIN: 0, WATCH_INDEXER: 0, WEB3_TX_DEQUEUE: 1,
		});
		daemons.push(dea);
	}
}