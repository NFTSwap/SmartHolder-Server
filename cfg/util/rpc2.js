
var buffer = require('somes/buffer').default;

function proxy(e) {
	return e[0] != '*'? e:
		`https://dao.smartholder.jp/files/security/${buffer.from(e.slice(1)).toString('base58')}`;
}

module.exports = {
	GOERLI: [
		// 'https://goerli.infura.io/v3/6b4f3897597e41d1adc12b7447c84767', // louis.tru@gmail.com
		// -----------
		'https://goerli.infura.io/v3/eb482df3997d45599d7b1798be60fec9', // third-party@hard-chain.cn
		'https://goerli.infura.io/v3/52963da6ae3a4e68a7506f982c196701', // zhuce@stars-mine.com
		'https://goerli.infura.io/v3/84456ff83aca4daa9e8d5da84d7dd6fb', // chuxuewen@hard-chain.cn
		'https://goerli.infura.io/v3/295cc6a3082a464cbf5c77562c0d78d7', // louistru@hotmail.com
		'https://goerli.infura.io/v3/5fad8ac4c3c946f489e0a5fec628d40e', // louistru@live.com
		'https://goerli.infura.io/v3/1ad04dd9dfa3421ca28519a575c959d9', // jfm.s@163.com
		'https://goerli.infura.io/v3/dde6a07efab74ec2998d48ff4a77ec03', // 97071932@qq.com
		'https://goerli.infura.io/v3/09e23dcd17934ab0b88c9e091789193e', // 2357779577@qq.com
		'https://goerli.infura.io/v3/faf06a5d35454aeaad87969b0aba90a8', // louistru@tom.com
		'https://goerli.infura.io/v3/96af19f43a3d4e7cac531d93c431f5cf', // louistru2@tom.com
		'https://goerli.infura.io/v3/81e184a58fd04f8ea6c7d026f26c34d5', // yuyongpeng@hotmail.com
		//'https://goerli.infura.io/v3/ccab5917a2b84bb4a64d1bc8e5c07fd1', // moqi.reg@gmail.com, account disable
		'https://goerli.infura.io/v3/12c4da3c5080480db4ae34fec7cf7d2c', // yuyongpeng@hard-chain.cn
		// -----------
		// 'https://eth-goerli.g.alchemy.com/v2/lwDFslNRvhCjzogUVLPtPzGIN4ZZDa8I',
	],
	ARBITRUM_GOERLI: [
		'https://arbitrum-goerli.infura.io/v3/6b4f3897597e41d1adc12b7447c84767' // louis.tru@gmail.com
	],
	ETHEREUM: [
		// 'https://mainnet.infura.io/v3/6b4f3897597e41d1adc12b7447c84767', // louis.tru@gmail.com
		// -----------
		// '*https://mainnet.infura.io/v3/eb482df3997d45599d7b1798be60fec9', // third-party@hard-chain.cn
		// '*https://mainnet.infura.io/v3/52963da6ae3a4e68a7506f982c196701', // zhuce@stars-mine.com
		// '*https://mainnet.infura.io/v3/84456ff83aca4daa9e8d5da84d7dd6fb', // chuxuewen@hard-chain.cn
		// '*https://mainnet.infura.io/v3/295cc6a3082a464cbf5c77562c0d78d7', // louistru@hotmail.com
		// '*https://mainnet.infura.io/v3/5fad8ac4c3c946f489e0a5fec628d40e', // louistru@live.com
		// '*https://mainnet.infura.io/v3/1ad04dd9dfa3421ca28519a575c959d9', // jfm.s@163.com
		// '*https://mainnet.infura.io/v3/dde6a07efab74ec2998d48ff4a77ec03', // 97071932@qq.com
		// '*https://mainnet.infura.io/v3/09e23dcd17934ab0b88c9e091789193e', // 2357779577@qq.com
		// '*https://mainnet.infura.io/v3/faf06a5d35454aeaad87969b0aba90a8', // louistru@tom.com
		// '*https://mainnet.infura.io/v3/96af19f43a3d4e7cac531d93c431f5cf', // louistru2@tom.com
		// '*https://mainnet.infura.io/v3/81e184a58fd04f8ea6c7d026f26c34d5', // yuyongpeng@hotmail.com
		// // 'https://mainnet.infura.io/v3/ccab5917a2b84bb4a64d1bc8e5c07fd1', // moqi.reg@gmail.com, account disable
		// '*https://mainnet.infura.io/v3/12c4da3c5080480db4ae34fec7cf7d2c', // yuyongpeng@hard-chain.cn
		// -----------
		'*https://eth-mainnet.g.alchemy.com/v2/jwLMO_t2Vd8LXMW5kBImmFtHNiwDf8kM', // louis.tru@gmail.com
		'*https://eth-mainnet.g.alchemy.com/v2/GowKUhfgb_dUokKbJd25fCQmu_Rh4OOQ', // louistru@hotmail.com
		'*https://eth-mainnet.g.alchemy.com/v2/J4tBWySG0aJCAfwYZuIeB47Bp6qkMvsE', // louistru@live.com
		'*https://eth-mainnet.g.alchemy.com/v2/qbTtSHsUsB8EJKhLxKP97XjWUwSAGz0Z', // louistru@tom.com
		// -----------
		'https://eth-mainnet.g.alchemy.com/v2/jwLMO_t2Vd8LXMW5kBImmFtHNiwDf8kM', // louis.tru@gmail.com
		'https://eth-mainnet.g.alchemy.com/v2/GowKUhfgb_dUokKbJd25fCQmu_Rh4OOQ', // louistru@hotmail.com
		'https://eth-mainnet.g.alchemy.com/v2/J4tBWySG0aJCAfwYZuIeB47Bp6qkMvsE', // louistru@live.com
		'https://eth-mainnet.g.alchemy.com/v2/qbTtSHsUsB8EJKhLxKP97XjWUwSAGz0Z', // louistru@tom.com
		// -----------
		'https://eth-mainnet.gateway.pokt.network/v1/lb/fd666b7e', // louistru@hotmail.com github
		'https://eth-mainnet.gateway.pokt.network/v1/lb/03270cd5', // louistru@live.com
		'https://eth-mainnet.gateway.pokt.network/v1/lb/21a9f75f', // jfm.s@163.com
		'https://eth-mainnet.gateway.pokt.network/v1/lb/3a99a740', // louistru@tom.com
		'https://eth-mainnet.gateway.pokt.network/v1/lb/6e0c2cdb', // louistru2@tom.com
		'https://eth-mainnet.gateway.pokt.network/v1/lb/ffcd4e2c', // louis.tru@gmail.com
	].map(proxy),
	ARBITRUM: [
		'https://arbitrum-mainnet.infura.io/v3/6b4f3897597e41d1adc12b7447c84767' // louis.tru@gmail.com
	],
	MATIC: [
		// 'https://polygon-mainnet.infura.io/v3/6b4f3897597e41d1adc12b7447c84767', // louis.tru@gmail.com
		// -----------
		'*https://rpc-mainnet.maticvigil.com/v1/2db5bb18b8b1b3f1b47a080e4c9ce6d2c7a5128c', // louistru@live.com
		'*https://rpc-mainnet.maticvigil.com/v1/a20a1a70e42a8e7a1e20dbec5bce46adcd36cdab', // louis.tru@gmail.com
		'*https://rpc-mainnet.maticvigil.com/v1/dfd0568eb46b0f97a31bbddd83ccc9dd80c6ef08', // chuxuewen@hard-chain.cn
		'*https://rpc-mainnet.maticvigil.com/v1/f9aa416097c89301b2a74b5ee9a48a3d49987463', // yuyongpeng@hotmail.com
		'*https://rpc-mainnet.maticvigil.com/v1/4ea0aeeeb8f8b2d8899acfc89e9852a361bf5b13', // louistru@hotmail.com
		'*https://rpc-mainnet.maticvigil.com/v1/e5092d150f5bf03f3db004c01499a0786dc0f580', // yuyongpeng@hard-chain.cn
		'*https://rpc-mainnet.maticvigil.com/v1/930f643c173725dadaf2d1b881c1b9743b8bbf62', // third-party@hard-chain.cn
		'*https://rpc-mainnet.maticvigil.com/v1/ef8f16191b474bb494f33283a81a38487e4dc245', // louistru@tom.com
		'*https://rpc-mainnet.maticvigil.com/v1/b706532e6bd03d1b5c93ba66d91a50aebf212dde', // louistru2@tom.com
		'*https://rpc-mainnet.maticvigil.com/v1/368d0a19a1108e223d0dca757a342716f403dbb6', // moqi.reg@gmail.com
		// -----------
		'https://rpc-mainnet.maticvigil.com/v1/2db5bb18b8b1b3f1b47a080e4c9ce6d2c7a5128c', // louistru@live.com
		'https://rpc-mainnet.maticvigil.com/v1/a20a1a70e42a8e7a1e20dbec5bce46adcd36cdab', // louis.tru@gmail.com
		'https://rpc-mainnet.maticvigil.com/v1/dfd0568eb46b0f97a31bbddd83ccc9dd80c6ef08', // chuxuewen@hard-chain.cn
		'https://rpc-mainnet.maticvigil.com/v1/f9aa416097c89301b2a74b5ee9a48a3d49987463', // yuyongpeng@hotmail.com
		'https://rpc-mainnet.maticvigil.com/v1/4ea0aeeeb8f8b2d8899acfc89e9852a361bf5b13', // louistru@hotmail.com
		'https://rpc-mainnet.maticvigil.com/v1/e5092d150f5bf03f3db004c01499a0786dc0f580', // yuyongpeng@hard-chain.cn
		'https://rpc-mainnet.maticvigil.com/v1/930f643c173725dadaf2d1b881c1b9743b8bbf62', // third-party@hard-chain.cn
		'https://rpc-mainnet.maticvigil.com/v1/ef8f16191b474bb494f33283a81a38487e4dc245', // louistru@tom.com
		'https://rpc-mainnet.maticvigil.com/v1/b706532e6bd03d1b5c93ba66d91a50aebf212dde', // louistru2@tom.com
		'https://rpc-mainnet.maticvigil.com/v1/368d0a19a1108e223d0dca757a342716f403dbb6', // moqi.reg@gmail.com
		// -----------
	].map(proxy),
	MUMBAI: [
		'https://rpc-mumbai.maticvigil.com/v1/2db5bb18b8b1b3f1b47a080e4c9ce6d2c7a5128c', // louistru@live.com
		'https://rpc-mumbai.maticvigil.com/v1/a20a1a70e42a8e7a1e20dbec5bce46adcd36cdab', // louis.tru@gmail.com
		'https://rpc-mumbai.maticvigil.com/v1/dfd0568eb46b0f97a31bbddd83ccc9dd80c6ef08', // chuxuewen@hard-chain.cn
		'https://rpc-mumbai.maticvigil.com/v1/f9aa416097c89301b2a74b5ee9a48a3d49987463', // yuyongpeng@hotmail.com
		'https://rpc-mumbai.maticvigil.com/v1/4ea0aeeeb8f8b2d8899acfc89e9852a361bf5b13', // louistru@hotmail.com
		'https://rpc-mumbai.maticvigil.com/v1/e5092d150f5bf03f3db004c01499a0786dc0f580', // yuyongpeng@hard-chain.cn
		'https://rpc-mumbai.maticvigil.com/v1/930f643c173725dadaf2d1b881c1b9743b8bbf62', // third-party@hard-chain.cn
		'https://rpc-mumbai.maticvigil.com/v1/ef8f16191b474bb494f33283a81a38487e4dc245', // louistru@tom.com
		'https://rpc-mumbai.maticvigil.com/v1/b706532e6bd03d1b5c93ba66d91a50aebf212dde', // louistru2@tom.com
		'https://rpc-mumbai.maticvigil.com/v1/368d0a19a1108e223d0dca757a342716f403dbb6', // moqi.reg@gmail.com
	],
};