
var base = require('./util/base');
var rpc = require('./util/rpc');
var impl = require('./util/impl');

module.exports = {
	...base,
	web3s: {
		RINKEBY: rpc.RINKEBY,
		GOERLI: rpc.GOERLI,
	},
	contractImpls: impl,
	tx_api: 'http://127.0.0.1:8002/service-api',
	// ssh -f -N -g -R 8002:0.0.0.0:8002 root@dttyd.stars-mine.com
	publicURL: 'https://smart-dao-rel.stars-mine.com',
	mbus: 'mqtt://mqtt-test.stars-mine.com:2883',
	mbus_auth: 'nft_hardware_test:nft_hardware_test', // user:password
	mbus_topic: 'shs_default_rel',
	enable_auth: true,
	env: 'dev',
	mysql: {
		host: '192.168.1.83', port: 3306, user: 'smartholder', password: 'M5CpA/0hvk8IyD8QHViHsmartholder', database: 'smartholder', // dev inner
		// host: 'rdata.stars-mine.com', port: 22022, user: 'chuxuewen', password: '%5KNRKDQXcvBq358DkWQxtunVN5rel', database: 'smartholder',
	},
	fastStart: false,
};