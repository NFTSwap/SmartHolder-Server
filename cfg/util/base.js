
module.exports = {
	name: 'shd-ser',
	server: { // web服务端口监听配置
		host: process.env.SERVER_HOST || '0.0.0.0',
		port: Number(process.env.SERVER_PORT) || 8002,
	},
	var: '/data/SmartHolder-Server/var', // `${__dirname}/var`,
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
	env: 'dev', // dev|prod, 正式服务器设置为 prod
	apis: [`${__dirname}/../../src/api`],
	tests: [`${__dirname}/../../test/test`],
	root: '/data/HC/dphotos/SmartHolder-Server/out/public', // 前端程序路径,可为空
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
	yunpian: { // 云片
		// 海外服务器地址 https://us.yunpian.com/v2
		prefix: 'https://sms.yunpian.com/v2',
		apikey: 'dde639c949db3d5667662382018e8f8f',
		// 验证码短信模板,这个模板必需在云片注册
		tpl: '【哈稀】您正在使用 Hashii 服务进行短信认证， 您的验证码是#code#，请在10分钟内完成验证。',
		timeout: 6e5, /*10m*/ // 短信验证码超时时间
	},
	mysql: {
		host: '192.168.0.189', port: 22022, user: 'root', password: 'uzBGtlhlHnAQFtxdKj*Z', database: 'mvp', // dev
	},
	fastStart: false, // 是否快速启动,快速启动不检测数据库结构
	logs: { event: 1, sync: 1, block_no_resolve: 1, rpc: 0 }, // 日志输出开关
	redis: 'redis://127.0.0.1:6379/0', // redis cfg
};
