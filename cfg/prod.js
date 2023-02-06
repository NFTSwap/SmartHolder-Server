
var base = require('./util/base');
var rpc = require('./util/rpc');

module.exports = {
	...base,
	web3s: {
		GOERLI: rpc.GOERLI,
		ETHEREUM: rpc.ETHEREUM,
	},
	root: '/data/apps/smart-dao/smart-dao',
	publicURL: 'http://dao.smartholder.jp',
	mbus: 'mqtt://172.16.3.114:1883',
	mbus_auth: '', // user:password
	mbus_topic: 'shs_default_prod',
	enable_auth: true,
	env: 'dev', // dev|prod
	mysql: {
		host: '172.16.2.46', port: 3306, user: 'smartdao', password: 'smartdao', database: 'smartdao',
	},
	redis: 'redis://172.16.3.114:6379/1', // redis cfg
	atomicLock: 'http://172.16.3.114:9802', // atomic lock service
};
