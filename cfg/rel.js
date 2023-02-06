
var base = require('./util/base');
var rpc = require('./util/rpc');

module.exports = {
	...base,
	web3s: {
		GOERLI: rpc.GOERLI,
	},
	root: '/data/apps/smart-dao/dist',
	publicURL: 'https://dao.smartholder.jp',
	mbus: 'mqtt://172.16.3.114:1883',
	mbus_auth: '', // user:password
	mbus_topic: 'shs_default_rel',
	env: 'prod', // dev|prod
	enable_auth: true,
	env: 'dev',
	mysql: {
		// host: '192.168.1.83', port: 3306, user: 'smartholder', password: 'M5CpA/0hvk8IyD8QHViHsmartholder', database: 'smartholder', // rel inner
		host: '192.168.1.83', port: 3306, user: 'smartdao', password: 'smartdao', database: 'smartdao', // rel inner
	},
	fastStart: false,
	atomicLock: 'http://172.16.3.114:9802', // atomic lock service
};