
var base = require('./util/base');
var rpc = require('./util/rpc');

module.exports = {
	...base,
	web3s: {
		GOERLI: rpc.GOERLI.slice(1), // skip local
		ETHEREUM: rpc.ETHEREUM.slice(1,2), // only use local
	},
	autoIndex: false,
	root: '/data/apps/smart-dao/smart-dao-new/out',
	publicURL: 'https://dao-rel.smartholder.jp',
	mbus: 'mqtt://127.0.0.1:1883',
	mbus_auth: '', // user:password
	mbus_topic: 'shs_default_rel',
	enable_auth: true,
	watch_meta: 'watch_indexer',
	env: 'rel',
	mysql: {
		host: '127.0.0.1', port: 3306, user: 'smartdao', password: 'smartdao', database: 'smartdao', // rel inner
	},
	watchBlock: {
		mysql: {
			host: '172.16.2.46', port: 3306, user: 'smartdao', password: 'smartdao', database: 'smartdao',
		},
		redis: 'redis://172.16.3.114:6379/1', // redis cfg
	},
};