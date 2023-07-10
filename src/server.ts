
import {cfg,Server} from 'bclib/server';
import server from 'somes/server';
import * as config from '../config';

if (config.root) {
	cfg.root = [config.root, cfg.root] as any;
	cfg.tryFiles = '/index.html';
	cfg.trySuffixs = '.html';
}

var impl = new Server(cfg);

server.setShared(impl);

export default impl;