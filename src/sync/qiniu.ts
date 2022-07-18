/**
 * @copyright © 2021 Copyright ccl
 * @date 2021-07-06
 */

import {WatchCat} from 'bclib/watch';
import db, {Asset, local_db, AssetLocalRes} from '../db';
import * as cfg from '../../config';
import somes from 'somes';
import errno from '../errno';
import paths from 'bclib/paths';
import _hash from 'somes/hash';
import * as fs2 from 'somes/fs2';
import * as path from 'path';
import qiniu, {exists,searchPrefix} from 'bclib/qn';

export class QiniuSync implements WatchCat<any> {

	catcount = 0;
	cattime = 1 * 10; // 1 minute
	tryTime = 1 * 10; // 1 minute
	private _updates: Map<string, number> = new Map();
	private _updateLimit = 20;

	get updateList() {
		var r = [] as string[];
		for (var s of this._updates.keys())
			r.push(s);
		return r;
	}

	async cat() {
		for (var basename of await fs2.readdir(`${paths.res}`)) {
			var ext = path.extname(basename);
			var hash = basename.substring(0, basename.length - ext.length);
			var src = `${paths.res}/${basename}`;
			try {
				if (await fs2.exists(src) && (await fs2.stat(src)).isFile()) {
					await this._sync(basename, hash, ext); // sync to qiniu
				}
			} catch(err:any) {
				console.warn('QiniuSync#cat', err.message);
			}
		}
		return true;
	}

	private async _sync(basename: string, hash: string, ext: string) {
		var [res] = await local_db.select('asset_local_res', {hash}) as AssetLocalRes[];
		if (res) {
			var local = `${paths.res}/${basename}`;
			if (this._updates.has(local)) {
				return; // cancel upload
			}

			var [asset] = await db.select('asset', { id: res.id }) as Asset[];
			if (asset) {
				var { media, image } = asset;
				var equal = (media == image);
				if (equal) image = '';
				var newSrc = '';

				for (var [name,src] of [['media', media],['image', image]]) {
					if ( src && !QiniuSync.isQiniu(src) && path.basename(src) == basename) {
						if (!newSrc) {
							newSrc = `${cfg.qiniu.prefix}/${await this.upload(local)}`;
						}
						var set = equal ? { media: newSrc, image: newSrc }: { [name]: newSrc };
						await db.update('asset', set, { id: asset.id });
						// somes.sleep(somes.random(1e2, 1e3));
						// await db.update('asset', set, { id: asset.id });
					}
				}
				await QiniuSync.removeLocal(local);
			}
		} else {
			await fs2.rename(`${paths.res}/${basename}`, `${paths.tmp_rm}/${basename}`);
		}
	}

	async upload(src: string, dest?: string) {
		somes.assert(!this._updates.has(src), errno.ERR_QINIU_UPLOADING_ERR, { src });
		somes.assert(this._updates.size < this._updateLimit, errno.ERR_QINIU_UPLOAD_LIMIT);
		var retry = 5;
		do {
			try {
				this._updates.set(src, 1);
				console.log('Qiniu upload retry', 5 - retry, src);
				somes.assert(await fs2.exists(src), errno.ERR_QINIU_UPLOADING_ERR, {src});
				// var key = dest || path.basename(src);
				// if (await exists(key)) {
				// 	return key;
				// }
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

	static async mime(hash: string) {
		var [res] = await local_db.select('asset_local_res', { hash }, {limit:1}) as AssetLocalRes[]
		if (res && res.mime) {
			return res.mime;
		}
		return '';
	}

	static async removeLocal(local: string) {
		var basename = path.basename(local);
		var hash = basename.substring(0, basename.length - path.extname(local).length);
		if (await fs2.exists(local))
			await fs2.remove(local);
		else 
			console.warn(`file does not exist, ${local}`);
			
		await local_db.delete('asset_local_res', {hash});
	}

	static exists(key: string) {
		return exists(key);
	}

	static existsPrefix(prefix: string) {
		return searchPrefix(prefix, 1);
	}

	static isQiniu(src: string) {
		if (!src) return false;
		var ok = cfg.qiniu.all_prefix.find(e=>{
			return src.substring(0, e.length) == e;
		})
		return !!ok;
	}

}