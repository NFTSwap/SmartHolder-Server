
var base = require('./util/base');
var rpc = require('./util/rpc');
var impl = require('./util/impl');

module.exports = {
	...base,
	web3s: {
		RINKEBY: rpc.RINKEBY,
	},
	contractImpls: impl,
	tx_api: 'http://127.0.0.1:8002/service-api',
	mbus: 'mqtt://192.168.0.189:1883',
	mbus_auth: 'nft_mqtt_dev:inmyshowD3', // user:password
	env: 'dev',
	mysql: {
		host: '192.168.0.189', port: 3306, user: 'root', password: '', database: 'mvp', // dev inner
	},
};
