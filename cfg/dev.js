
var base = require('./util/base');
var rpc = require('./util/rpc');
var impl = require('./util/impl');

module.exports = {
	...base,
	web3s: {
		RINKEBY: rpc.RINKEBY,
	},
	contractImpls: impl,
	mvp_ser_api: 'https://mvp.stars-mine.com/service-api',
	// ssh -f -N -g -R 8002:0.0.0.0:8002 root@dttyd.stars-mine.com
	publicURL: 'https://smart-dao-dev.stars-mine.com',
	mbus: 'mqtt://mqtt-test.stars-mine.com:2883',
	mbus_auth: 'nft_hardware_test:nft_hardware_test', // user:password
	mbus_topic: 'shs_default_dev',
	enable_auth: true,
	env: 'dev',
	mysql: {
		host: '192.168.0.189', port: 3306, user: 'smartholder', password: 'C1fNdYiPk0Tw5A==smartholder', database: 'smartholder', // dev inner
		//host: 'ddata.stars-mine.com', port: 22022, user: 'chuxuewen', password: '%5KNRKDQXcvBq358DkWQxtunVN5Uu61', database: 'smartholder', // dev inner
	},
	fastStart: false,
};
