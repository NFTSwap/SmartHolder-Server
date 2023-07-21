
var base = require('./util/base');
var rpc = require('./util/rpc2');

module.exports = {
	...base,
	var: '/var/smart-dao/shs/var_v2', // `${__dirname}/var`,
	extendConfigPath: '/var/smart-dao/shs/config', // extend config file
	web3s: {
		ETHEREUM: rpc.ETHEREUM,
		MATIC: rpc.MATIC,
		GOERLI: rpc.GOERLI,
		// ARBITRUM_GOERLI: rpc.ARBITRUM_GOERLI,
	},
	autoIndex: false,
	root: '/var/smart-dao/public',
	publicURL: 'https://dao.smartholder.jp',
	mbus: 'mqtt://127.0.0.1:1883',
	mbus_topic: 'shs_default_prod',
	enable_auth: true,
	moreLog: false,
	block_full_sync: true,
	env: 'prod', // dev|prod
	atomicLock: 'http://127.0.0.1:9802', // atomic lock service
	redis: 'redis://127.0.0.1:6379/10', // redis cfg
	mysql: {
		host: '127.0.0.1', port: 3306, user: 'root', password: 'root', database: 'smartdao',
	},
};
