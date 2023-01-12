
var base = require('./util/base');
var rpc = require('./util/rpc');

module.exports = {
	...base,
	web3s: {
		GOERLI: rpc.GOERLI,
	},
	tx_api: 'http://127.0.0.1:8002/service-api',
	// ssh -f -N -g -R 8002:0.0.0.0:8002 root@dttyd.stars-mine.com
	publicURL: 'https://smart-dao-rel-v2.stars-mine.com',
	mbus: 'mqtt://mqtt-test.stars-mine.com:2883',
	mbus_auth: 'nft_hardware_test:nft_hardware_test', // user:password
	mbus_topic: 'shs_default_rel_v2',
	enable_auth: true,
	env: 'dev',
	mysql: {
		// host: '192.168.1.83', port: 3306, user: 'smartholder', password: 'M5CpA/0hvk8IyD8QHViHsmartholder', database: 'smartholder', // rel inner
		host: '192.168.1.83', port: 3306, user: 'smartdao', password: 'smartdao', database: 'smartdao', // rel inner
	},
	fastStart: false,
};