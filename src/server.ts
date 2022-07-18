
import {cfg} from 'bclib/server';
import server, {ServerIMPL} from 'somes/server';
import * as config from '../config';

if (config.root) {
	cfg.root = [config.root, cfg.root] as any;
	(cfg as any).tryFiles = '/index.html';
}

export * from 'bclib/server';

var impl = new ServerIMPL(cfg);

server.setShared(impl);

export default impl;