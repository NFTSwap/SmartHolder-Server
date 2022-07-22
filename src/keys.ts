
import keys from 'bclib/keys+';
export * from 'bclib/keys';
import {KeysManager,SecretKey} from 'bclib/keys';
import buffer from 'somes/buffer';

var defaultKey = buffer.from('3bfb1adaf66ac607850d990d0bb4eb5a1aa1fd36187dfb5e3b61ff805be5b111', 'hex');
// 0x026f67dbdc26eb32f80cc6b54494568861aa4901d6c371554558a95371625f94c7
// 0x6Ac59A1e132f2408364e89e31c108881667d64Df

keys.set_impl(new KeysManager([
	SecretKey.from(defaultKey),
]));

keys.impl.useSystemPermission = false;

export default keys.impl;