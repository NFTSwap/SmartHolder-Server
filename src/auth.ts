
import somes from 'somes';
import auth, {Cache,User,AuthorizationManager,AuthorizationKeyType,AuthorizationMode} from 'bclib/auth';
import errno from './errno';
import {Notification} from 'somes/event';
import * as redis from 'bclib/redis';

export * from 'bclib/auth';

class AuthCache implements Cache {
	private _redis: redis.Redis;
	constructor(redis: redis.Redis) {
		this._redis = redis;
	}
	async get(name: string): Promise<User | null> {
		var user = await this._redis.hGetAll(`mvp-user-${name}`) as any;
		if (user.name) {
			user.id = Number(user.id);
			user.interfaces = JSON.parse(user.interfaces);
			return user;
		}
		return null;
	}
	async set(name: string, user: User | null) {
		var redis = this._redis;
		var key = `mvp-user-${name}`;
		if (user) {
			await redis.sendCommand(['HMSET', key,
				'id', String(user.id),
				'name', user.name,
				'pkey', user.pkey,
				'key2', user.key2 || '',
				'keyType', user.keyType,
				'mode', String(user.mode),
				'interfaces', user.interfaces ? JSON.stringify(user.interfaces): '{}',
				'time', String(user.time),
				'ref', user.ref || '',
			]);
		} else {
			await this._redis.del(key);
		}
	}
}

class Manager extends AuthorizationManager {

	async initialize(msg?: Notification) {
		await super.initialize(msg);
		this.setCache(new AuthCache(redis.client));
	}

	async register(name: string, pkey: string, ref?: string) {
		somes.assert(!await this.user(name), errno.ERR_DUPLICATE_AUTH_NAME);
		await this.setAuthorizationUserNoCheck(name, { pkey, keyType: AuthorizationKeyType.secp256k1, mode: AuthorizationMode.OTHER, ref });
	}
}

export default auth.set_impl(new Manager()) as Manager;