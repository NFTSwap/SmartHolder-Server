
var base = require('./util/base');
var rpc = require('./util/rpc');

module.exports = {
	...base,
	web3s: {
		ETHEREUM: rpc.ETHEREUM,
		MATIC: rpc.MATIC,
		GOERLI: rpc.GOERLI,
		ARBITRUM_GOERLI: rpc.ARBITRUM_GOERLI,
	},
	autoIndex: false,
	root: '/data/apps/smart-dao/smart-dao',
	publicURL: 'https://dao.smartholder.jp',
	mbus: 'mqtt://172.16.3.114:1883',
	mbus_topic: 'shs_default_prod',
	enable_auth: true,
	moreLog: false,
	env: 'prod', // dev|prod
	atomicLock: 'http://172.16.3.114:9802', // atomic lock service
};
