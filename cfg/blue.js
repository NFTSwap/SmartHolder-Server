
var base = require('./util/base');
var rpc = require('./util/rpc');

module.exports = {
	...base,
	var: '/var/smart-dao/shs/var', // `${__dirname}/var`,
	extendConfigPath: '',
	web3s: {
		ETHEREUM: rpc.ETHEREUM,
		MATIC: rpc.MATIC,
		GOERLI: rpc.GOERLI,
	},
	autoIndex: false,
	root: '/var/smart-dao/web',
	publicURL: 'https://dao.smartholder.jp',
	mbus: 'mqtt://127.0.0.1:1883',
	mbus_topic: 'shs_default_prod',
	enable_auth: true,
	moreLog: false,
	env: 'prod', // dev|prod
	atomicLock: 'http://127.0.0.1:9802', // atomic lock service
	redis: 'redis://127.0.0.1:6379/10', // redis cfg
	mysql: {
		host: '127.0.0.1', port: 22022, user: 'root', password: 'root', database: 'smartdao', // dev
	},
};
