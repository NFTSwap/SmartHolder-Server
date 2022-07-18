
import keys from 'bclib/keys+';
export * from 'bclib/keys';
import * as account from 'crypto-tx/account';
import {KeysManager,SecretKey} from 'bclib/keys';
import buffer from 'somes/buffer';
import * as cfg from '../config';

var defaultKey = buffer.from('a1048d9bb6a4e985342b240b5dd63176b27f1bac62fa268699ea6b55f9ff301c', 'hex');
// 0x03534c1d0ce9213c0fe6873db45d668d1c5bf01bbfc6f0bdf68a1ef39fe18de730

keys.set_impl(new KeysManager([
	SecretKey.from(defaultKey),
	...(cfg.zsw_keys || [] as string[]).map(e=>{
		const key = account.zsw_parseKey(e);
		return SecretKey.from(key.privKey!, key.type);
	}),
]));

keys.impl.useSystemPermission = false;

export default keys.impl;