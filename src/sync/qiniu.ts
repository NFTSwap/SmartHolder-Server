/**
 * @copyright © 2021 Copyright ccl
 * @date 2021-07-06
 */

import {WatchCat} from 'bclib/watch';
import * as cfg from '../../config';
import somes from 'somes';
import errno from '../errno';
import _hash from 'somes/hash';
import * as fs2 from 'somes/fs2';
import * as path from 'path';
import qiniu, {exists,searchPrefix} from 'bclib/qn';

export { exists };

export function existsPrefix(prefix: string) {
	return searchPrefix(prefix, 1);
}

export function isQiniuPath(src: string) {
	if (!src) return false;
	let ok = cfg.qiniu.all_prefix.find(e=>{
		return src.substring(0, e.length) == e;
	});
	return !!ok;
}

export class QiniuSync implements WatchCat<any> {
	private _updates: Map<string, number> = new Map();
	private _updateLimit = 10;

	catcount = 0;
	cattime = 1 * 10; // 1 minute
	tryTime = 1 * 10; // 1 minute

	get updateList() {
		let r = [] as string[];
		for (let s of this._updates.keys())
			r.push(s);
		return r;
	}

	async cat() {
		// noop
		return true;
	}

	async upload(src: string, dest?: string) {
		somes.assert(!this._updates.has(src), errno.ERR_QINIU_UPLOADING_ERR, { src });
		somes.assert(this._updates.size < this._updateLimit, errno.ERR_QINIU_UPLOAD_LIMIT);
		let retry = 5;
		do {
			try {
				this._updates.set(src, 1);
				console.log('Qiniu upload retry', 5 - retry, src);
				somes.assert(await fs2.exists(src), errno.ERR_QINIU_UPLOADING_ERR, {src});
				let key = dest || path.basename(src);
				if (await exists(key)) return key; //
				return await qiniu(src, dest);
			} catch(err: any) {
				if (!--retry || errno.ERR_QINIU_UPLOADING_ERR[0] == err.errno)
					throw err;
				console.warn('QiniuSync#upload', err.message);
			} finally {
				this._updates.delete(src);
			}
		} while (1);
		// throw Error.new(errno.ERR_QINIU_UPLOADING_ERR).ext({src});
	}

}
