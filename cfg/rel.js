
var base = require('./util/base');
var rpc = require('./util/rpc');

module.exports = {
	...base,
	web3s: {
		GOERLI: rpc.GOERLI,
		ETHEREUM: rpc.ETHEREUM,
		MATIC: rpc.MATIC,
	},
	autoIndex: false,
	root: '/data/apps/smart-dao/smart-dao-new/out',
	publicURL: 'https://dao-rel.smartholder.jp',
	mbus: 'mqtt://127.0.0.1:1883',
	mbus_topic: 'shs_default_rel',
	enable_auth: true,
	watch_meta: 'watch_indexer',
	env: 'rel',
	moreLog: true,
	mysql: {
		host: '127.0.0.1', port: 3306, user: 'smartdao', password: 'smartdao', database: 'smartdao', // rel inner
	},
};