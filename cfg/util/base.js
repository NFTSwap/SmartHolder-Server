
module.exports = {
	name: 'shs', // Smart Holder Server
	server: { // web服务端口监听配置
		host: process.env.SERVER_HOST || '0.0.0.0',
		port: Number(process.env.SERVER_PORT) || 8100,
		noCache: '\\.html$',
	},
	autoIndex: true,
	var: '/data/shs/var_v2', // `${__dirname}/var`,
	web3s: {}, // web3s 配置列表
	// 0单一模式：优先选择第一个节点,当第一个节点比第二个节点小16个块时切换到第二个节点
	// 1多模式：在多个节点中自动切换，当前一个节点出现故障时，会随机切换到下一个节点
	web3Mode: {}, // web3模式 default use kMultiple_Fixed
	web3PriceLimit: {},
	keys_auto_unlock: true,
	web3_tx_dequeue: false,
	enable_auth: true, // 启用web服务访问认证
	mbus: 'mqtt://mqtt.stars-mine.com:1883', // Disable mbus when empty, mbus为空时禁用消息总线
	mbus_auth: '', // user:password
	mbus_topic: 'shs_default',
	env: 'dev', // dev|prod, 正式服务器设置为 prod
	debug: true,
	apis: [`${__dirname}/../../src/api`],
	tests: [`${__dirname}/../../test/test`],
	watch_main: true, // 是否启用数据同步主服务,主服务只能有一个
	watch_indexer: true, // 索引人监控
	watch_meta: 'watch_main', // watch_main|watch_indexer, watch meta worker at watch main
	// root: '/data/apps/smart-dao/dist', // 前端程序路径,可为空
	root: '/data/apps/smart-dao/smart-dao', // 前端程序路径,可为空
	tx_api: 'https://dao.smartholder.jp/service-api',
	publicURL: 'https://dao.smartholder.jp',
	httpProxy: [
		// 资源下载服务器列表,这需服务器建议使用 cfg/glob_us_meta.js 中的配置
		'http://152.32.150.111:8001',
		'http://107.155.48.181:8001',
		'http://152.32.151.100:8001',
		'http://128.14.234.156:8001',//
		'http://152.32.150.90:8001',
		'http://152.32.182.155:8001',//
	],
	opensea_api_key: '2f6f419a083c46de9d83ce3dbe7db601',
	qiniu: {
		prefix: 'https://smart-dao-res.stars-mine.com',
		all_prefix: [
			'https://smart-dao-res.stars-mine.com', // 华北-河北桶域名
			'https://smart-dao-res-us.stars-mine.com', // 北美-洛杉矶桶域名
		],
		scope: 'smart-dao', // 华北-河北桶域名
		zone: 'huabei', // 华北
		accessKey: 'iiMyOZsCAMpDbj2t-JLnLvyEbGMGfRO78NTIUdrO',
		secretKey: 'HkaFTPPG8zdoUB-xxyYfGXZth2PCNX75oKPFJeL5',
	},
	moreLog: true,
	mysql: {
		host: '192.168.0.189', port: 22022, user: 'root', password: 'uzBGtlhlHnAQFtxdKj*Z', database: 'mvp', // dev
	},
	fastStart: false, // 是否快速启动,快速启动不检测数据库结构
	logs: { event: 1, sync: 1, block_no_resolve: 1, rpc: 0 }, // 日志输出开关
	redis: 'redis://127.0.0.1:6379/10', // redis cfg
	atomicLock: 'http://127.0.0.1:9802', // atomic lock service
	watchBlock: {
		mysql: { host: '', port: 0, user: '', password: '', database: '' },
		redis: '', // redis cfg
	},
	useRpc: false,
	secretKey: [], // private key For DAOs owner 
	salt: '',
};
