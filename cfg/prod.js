
var base = require('./util/base');
var rpc = require('./util/rpc');

module.exports = {
	...base,
	web3s: {
		RINKEBY: rpc.RINKEBY,
	},
	mbus: 'mqtt://192.168.0.189:1883',
	mbus_auth: 'nft_mqtt_dev:inmyshowD3', // user:password
	env: 'dev',
	mysql: {
		host: '192.168.0.189', port: 3306, user: 'root', password: 'uzBGtlhlHnAQFtxdKj*Z', database: 'mvp', // dev inner
	},
};
