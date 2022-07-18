
import somes from 'somes';
import auth, {AuthorizationManager,AuthorizationKeyType,AuthorizationMode} from 'bclib/auth';
import errno from './errno';
import {yunpian} from './request';
import * as cfg from '../config';
import * as redis from './redis';

export * from 'bclib/auth';

class Manager extends AuthorizationManager {

	async register(name: string, pkey: string, ref?: string) {
		somes.assert(!await this.user(name), errno.ERR_DUPLICATE_AUTH_NAME);
		await this.setAuthorizationUserNoCheck(name, { pkey, keyType: AuthorizationKeyType.secp256k1, mode: AuthorizationMode.OTHER, ref });
	}

	private async verify(verify: string, phone: string) {
		var code = await redis.get<{verify: string, time: number}>(`phoneVerify-${phone}`);
		somes.assert(code && code.verify == verify, errno.ERR_PHONE_VERIFY_FAIL);
		somes.assert(code && code.time + cfg.yunpian.timeout > Date.now(), errno.ERR_PHONE_VERIFY_FAIL);
		await redis.set(`phoneVerify-${phone}`, { verify: '0', time: code?.time });
	}

	async registerFromPhone(phone: string, pkey: string, verify: string) {
		somes.assert(!await this.user(phone), errno.ERR_DUPLICATE_AUTH_NAME);
		await this.verify(verify, phone);
		await this.setAuthorizationUserNoCheck(phone, { pkey, keyType: AuthorizationKeyType.secp256k1, mode: AuthorizationMode.OTHER });
	}

	async loginFromPhone(phone: string, verify: string, key2: string, ref?: string) {
		await this.verify(verify, phone);
		await this.setAuthorizationUserNoCheck(phone, { key2, ref, mode: AuthorizationMode.OTHER });
	}

	async sendPhoneVerify(phone: string) {
		var code = await redis.get<{verify: string, time: number}>(`phoneVerify-${phone}`);
		if (code) {
			somes.assert(Date.now() - code.time > 6e4/*60s*/, errno.ERR_SMS_SEND_FREQUENTLY);
		}
		var verify = String(somes.random(100000, 999999));

		var ok = await yunpian.post('sms/single_send.json', {
			apikey: cfg.yunpian.apikey,
			mobile: phone,
			text: cfg.yunpian.tpl.replace('#code#', verify),
		});

		await redis.set(`phoneVerify-${phone}`, { verify, time: Date.now() });
	}

}

var man = new Manager();

auth.set_impl(man);

export default man;