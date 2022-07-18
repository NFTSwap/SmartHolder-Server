/**
 * @copyright © 2022 Copyright hc
 * @date 2022-03-16
 */

import db, { Asset, local_db } from '../db';
import * as cfg from '../../config';
import somes from 'somes';
import errno from '../errno';
import paths from 'bclib/paths';
import _hash from 'somes/hash';
import * as fs2 from 'somes/fs2';
import {SyncQueue} from './queue';
import {QiniuSync} from './qiniu';
import * as fetch from '../utils';
import * as path from 'path';
import sync from '.';

export class AssetMetaSourceDownload extends SyncQueue {

	private _downloads: Map<string, Asset> = new Map();

	static extname(mime: string) {
		var extname = mime.split('\n')[0].split('/')[1];
		if (extname) {
			return '.' + (extname.split('+')[0]);
		} else {
			return '.data';
		}
	}

	static joinPath(path: string, mime: string) {
		return path + AssetMetaSourceDownload.extname(mime);
	}

	static assetFileHash(asset: Asset, origin: string) {
		return _hash.sha256(origin /*+ asset.token + asset.tokenId*/).toString('base58');
	}

	static equalsQiniuAssetSource(asset: Asset, origin: string, quniuURL?: string) {
		if (quniuURL) {
			if (QiniuSync.isQiniu(quniuURL)) {
				var hash = AssetMetaSourceDownload.assetFileHash(asset, origin);
				if (path.basename(quniuURL).indexOf(hash) === 0) {
					return true;
				}
			}
		}
		return false;
	}

	private async _download(asset: Asset, www: string, dest?: string) {

		var hash = AssetMetaSourceDownload.assetFileHash(asset, www);
		var save = `${paths.res}/${hash}`;
		var tmp = `${paths.tmp_res}/${hash}~`;

		if (AssetMetaSourceDownload.equalsQiniuAssetSource(asset, www, dest)) {
			return dest;
		}

		return await somes.scopeLock(`AssetMetaSourceDownload#_download#${hash}`, async ()=>{

			var [stat] = await QiniuSync.existsPrefix(hash);
			if (stat) {
				return `${cfg.qiniu.prefix}/${stat.key}`;
			}

			var mime = await QiniuSync.mime(hash) as string;
			if (mime) {
				var local = AssetMetaSourceDownload.joinPath(save, mime);
				if (await fs2.exists(local)) {
					var newDest = AssetMetaSourceDownload.joinPath(`${cfg.publicURL}/files/res/${hash}`, mime);
					// unload to qiniu
					try {
						newDest = `${cfg.qiniu.prefix}/${await sync.qiniuSync.upload(local)}`;
						await QiniuSync.removeLocal(local);
					} catch(err:any) {
						console.warn('AssetMetaDataSync#_download#1', err.message, newDest, local);
					}
					return newDest;
				}
			}

			somes.assert(!this._downloads.has(www), errno.ERR_DOENLOAD_TASK_RUNNING, {www, ...somes.filter(asset, ['token', 'tokenId', 'chain'])});
			try {
				this._downloads.set(www, asset);
				var {mime, total} = await fetch.download(encodeURI(www), tmp);
			} finally {
				this._downloads.delete(www);
			}

			var curSize = (await fs2.stat(tmp)).size;

			if (total && curSize != total) {
				await fs2.remove(tmp);
				throw Error.new(errno.ERR_BAD_DOENLOAD_FILE);
			}

			var newDest = AssetMetaSourceDownload.joinPath(`${cfg.publicURL}/files/res/${hash}`, mime);
			var local = AssetMetaSourceDownload.joinPath(save, mime)

			await local_db.insert('asset_local_res', { hash, id: asset.id, mime });
			await fs2.rename(tmp, local);

			// unload to qiniu
			try {
				newDest = `${cfg.qiniu.prefix}/${await sync.qiniuSync.upload(local)}`;
				await QiniuSync.removeLocal(local);
			} catch(err:any) {
				console.warn('AssetMetaDataSync#_download#2', err.message, newDest, local);
			}

			return newDest;
		});
	}

	protected async onSync(asset: Asset) {

		var id = asset.id;
		var isEquals = asset.imageOrigin == asset.mediaOrigin;

		if (asset.imageOrigin) {
			var image = await this._download(asset, asset.imageOrigin, asset.image);
			await db.update('asset', isEquals ? {media: image, image}: {image/*only image*/}, { id });
		}

		if (asset.mediaOrigin && !isEquals) {
			var media = await this._download(asset, asset.mediaOrigin, asset.media);
			await db.update('asset', {media}, { id });
		}
	}
}
