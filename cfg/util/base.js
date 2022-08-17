
module.exports = {
	name: 'shs', // Smart Holder Server
	server: { // web服务端口监听配置
		host: process.env.SERVER_HOST || '0.0.0.0',
		port: Number(process.env.SERVER_PORT) || 8002,
	},
	var: '/data/shs/var', // `${__dirname}/var`,
	web3s: {}, // web3s 配置列表
	// 0单一模式：优先选择第一个节点,当第一个节点比第二个节点小16个块时切换到第二个节点
	// 1多模式：在多个节点中自动切换，当前一个节点出现故障时，会随机切换到下一个节点
	web3Mode: {}, // web3模式 default use kMultiple_Fixed
	web3PriceLimit: {},
	contractImpls: {},
	keys_auto_unlock: true,
	web3_tx_dequeue: false,
	mvp_ser_api: 'https://mvp.stars-mine.com/service-api',
	enable_auth: true, // 启用web服务访问认证
	mbus: 'mqtt://mqtt.stars-mine.com:1883', // Disable mbus when empty, mbus为空时禁用消息总线
	mbus_auth: '', // user:password
	mbus_topic: 'shs_default',
	env: 'dev', // dev|prod, 正式服务器设置为 prod
	apis: [`${__dirname}/../../src/api`],
	tests: [`${__dirname}/../../test/test`],
	sync_main: true, // 是否启用数据同步主服务,主服务只能有一个
	root: '/data/apps/smart-dao/dist', // 前端程序路径,可为空
	publicURL: 'https://smartholder.stars-mine.com',
	httpProxy: [
		// 资源下载服务器列表,这需服务器建议使用 cfg/glob_us_meta.js 中的配置
		'http://152.32.150.111:8001',
		'http://107.155.48.181:8001',
		'http://152.32.151.100:8001',
		'http://128.14.234.156:8001',//
		'http://152.32.150.90:8001',
		'http://152.32.182.155:8001',//
	],
	qiniu: {
		prefix: 'https://mvp-img.stars-mine.com',
		all_prefix: [
			'https://mvp-img.stars-mine.com', // hd 华东桶域名
			'https://nftmvp-img.stars-mine.com', // bm 北美桶域名
		],
		scope: 'nftmvp', // 华东桶名
		zone: 'huadong', // 华东
		accessKey: 'iiMyOZsCAMpDbj2t-JLnLvyEbGMGfRO78NTIUdrO',
		secretKey: 'HkaFTPPG8zdoUB-xxyYfGXZth2PCNX75oKPFJeL5',
	},
	mysql: {
		host: '192.168.0.189', port: 22022, user: 'root', password: 'uzBGtlhlHnAQFtxdKj*Z', database: 'mvp', // dev
	},
	fastStart: false, // 是否快速启动,快速启动不检测数据库结构
	logs: { event: 1, sync: 1, block_no_resolve: 1, rpc: 0 }, // 日志输出开关
	redis: 'redis://127.0.0.1:6379/0', // redis cfg
};
