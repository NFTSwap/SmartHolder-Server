SmartHolder-Server
========================

## 同步以及初始子依赖仓库

先切换到目标发行版本 `tag`

然后运行 

```sh
git submodule update --init --recursive
```

## 编译

编译前先安装依赖项 `make install` 或 `npm i --unsafe-perm`

指定配置文件编译，编译完成后依然可以修改配置文件 => `out/shd-ser/config.js`

默认配置在`cfg`目录中

```sh
ENV=dev make
```

编译完成后目标见 `out/shd-ser` 目录

编译完成后还需要重新安装依赖项目，运行 `make install` 或 `npm i --unsafe-perm`


## 配置

配置文件在`cfg`目录中，有几个重要配置项目需要说明下

`cfg.web3s` 区块链数据监控配置,在cfg/util/rpc.js文件中有默认服务器配置
`cfg.web3Mode` 区块链数据监控配置中rpc的使用模式，`Web3Mode`模式默认使用`kMultiple_Fixed`模式，详情见 `src/web3+.ts`中注释

看下面例子：


```js
{
	web3s: {
		ETHEREUM: [
			'5/http://192.168.1.248:8545', // hard-chain节点,使用权重5
			'https://mainnet.infura.io/v3/52963da6ae3a4e68a7506f982c196701', // 默认使用权重1
		],
		RINKEBY: [
			'http://152.32.172.175:8545',
			'https://rinkeby.infura.io/v3/eb482df3997d45599d7b1798be60fec9',
		]
	},
	web3Mode: {
		ETHEREUM: 0, // use kMultiple_Random
	},
}
```


理详细的配置可参考 `cfg/util/base.js` 与 `cfg_hello.js` 文件中的注释


## 启动守护程序

守护程序中的环境变量会覆盖config中的某些配置

数据监控守护程序模式会禁用web服务

web监控守护程序模式会禁用所有的监控服务

```sh
export RUN_DAEMON=1      # 启动为web守护模式
export RUN_TARGET=watch  # 监控数据模式,可选为 web|watch
export RUN_WORKERS=8     # workers 数量

node ./index.js

```

`shd-watch.sh` 或 `shd-web.sh` 可直接调用

`shd-watch.service` 或 `shd-web.service` systemd 配置




## SmartHolder-Server Worker TODO

1. 部署完成后把实现逻辑写入到配置文件

2. 实现一个部署系列上下文代理合约的逻辑并且入库

3. 系列上下文代理合约需要使用队列方式部署，减少部署出错概率
