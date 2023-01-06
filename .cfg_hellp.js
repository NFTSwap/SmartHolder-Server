
// 这里只是范例配置不要修改此文件

var base = require('./cfg/util/base');
var rpc = require('./cfg/util/rpc');

module.exports = {
	...base,
	web3s: { // web3 cfg
		RINKEBY: rpc.GOERLI,
	},
	mbus: 'mqtt://172.16.20.47:1883', // Disable mbus when empty, mbus为空时禁用消息总线
	mbus_auth: '', // user:password
	env: 'dev', // dev|prod, 正式服务器设置为 prod
	mysql: {
		host: '192.168.0.189', port: 3306, user: 'root', password: 'uzBGtlhlHnAQFtxdKj*Z', database: 'mvp', // dev inner
	},
	redis: 'redis://127.0.0.1:6379/0', // redis cfg
};
