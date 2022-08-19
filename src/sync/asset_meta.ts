/**
 * @copyright © 2022 Copyright Smart Holder
 * @date 2022-08-19
 */

import db, { storage, Asset, ChainType, ContractType } from '../db';
import * as cfg from '../../config';
import somes from 'somes';
import buffer, {Buffer, IBufferEncoding,isTypedArray} from 'somes/buffer';
import paths from 'bclib/paths';
import _hash from 'somes/hash';
import * as fs2 from 'somes/fs2';
import {AssetSyncQueue} from './queue';
import * as utils from '../utils';
import errno from '../errno';
import make from './mk_scaner';
import {AssetERC721} from './erc721';
import sync from '.';

export function extname(mime: string) {
	var extname = mime.split('\n')[0].split('/')[1];
	if (extname) {
		return '.' + (extname.split('+')[0]);
	} else {
		return '.data';
	}
}

async function tryBeautifulAsset(asset: Asset, chain: ChainType) {
	if (!asset.uri || !asset.mediaOrigin) {
		await somes.scopeLock(`asset_${asset.id}`, async ()=>{
			var [it] = await db.select<Asset>(`asset_${chain}`, {id:asset.id});
			if (!it.uri || !asset.mediaOrigin) {
				await sync.assetMetaDataSync.sync(asset, chain);
			} else {
				Object.assign(asset, it);
			}
		});
	}
	return asset;
}

export async function beautifulAsset(asset: Asset[], chain: ChainType) {
	var timeout = false;
	try {
		await somes.timeout(async () =>{
			for (var a of asset) {
				if (timeout) {
					break;
				} else {
					await tryBeautifulAsset(a, chain);
				}
			}
		}, 1e4);
	} catch(err) {}
	timeout = true;
}

export class AssetMetaDataSync extends AssetSyncQueue {
	constructor() {
		super('asset_queue');
	}

	printLogs() {
		var logs = this.logs();
		for (var log of logs.wget) {
			console.log('WGET', log);
		}
		console.log('WGET.size', logs.wget_length);
	}

	logs() {
		var wget = [] as string[];
		for (var [k,v] of utils.downloading) {
			wget.push(`${v.time.timeStr} ${v.readyState||'conn'} ${v.size}/${v.total} ${v.www} ${k}`);
		}
		//{token: string; tokenId: string; uri: string; type: number; platform: string}[];
		var runing = [] as string[];
		for (let [k,{ token, tokenId, uri, chain }] of this._runingObj) {
			runing.push(`${token} ${tokenId} ${ChainType[chain]} ${uri}`);
		}
		return {
			wget_length: wget.length,
			runing_length: this._runingObj.size,
			upload: sync.qiniuSync.updateList,
			wget,
			runing,
		};
	}

	private _Eval = globalThis['eval'];
	private _Parse(_E: any, str: string) {
		return _E('(' + str + ')');
	}

	private _ParseJSON(json: string) {
		try {
			return JSON.parse(json)
		} catch(err) {
			return this._Parse(this._Eval, json);
		}
	}

	private _tryParseStrData(str: string) {
		let data: string | Buffer = str;
		let mime = ''; // application/octet-stream
		let prefix = 'data:';

		if (str.substring(0, prefix.length) == prefix) { // data:image/svg+xml;base64,
			str = str.substring(prefix.length);
			do {
				var index = str.indexOf(';'); // data:image/svg+xml;base64,
				if (index == -1)
					break;
				mime = str.substring(0, index);
				str = str.substring(index + 1);
				index = str.indexOf(','); // data:image/svg+xml;base64,
				if (index == -1)
					break;
				var encoding = str.substring(0, index) as IBufferEncoding;
				str = str.substring(index + 1);
				try {
					data = buffer.from(str, encoding);
				} catch(err:any) {
					console.warn('AssetMetaDataSync#_tryParseURI#1', err.message);
				}
			} while(0);
		} else if (str.indexOf('<svg') != -1) { // <svg
			mime = 'application/svg';
		} else { // unknown data
		}

		return {data, mime};
	}

	private async _tryParseDataMediaURI(asset: Asset, rawData: string | Buffer) {
		let {token,tokenId} = asset;
		let hash = '';
		var mime = 'application/text';
		var data: string | Buffer;

		if (isTypedArray(rawData)) { // is bin
			data = buffer.from(rawData as any);
			hash = _hash.sha256(_hash.md5(data).toString('hex') + token + tokenId).toString('base58');
		} else {
			data = String(rawData); // to utf8 string
			hash = _hash.sha256(data + token + tokenId).toString('base58');
		}
		let str = String(data);

		let {uri: s} = utils.toURIData(str, asset); // is uri
		if (s) {
			return s;
		}

		let parseStr = this._tryParseStrData(str); // is uri data
		if (parseStr.mime) {
			var {mime,data} = parseStr;
		}

		let ext = extname(mime);
		let uri = `${cfg.publicURL}/files/res/${hash}${ext}`;
		let save = `${paths.res}/${hash}${ext}`;
		await fs2.writeFile(save, data);

		// upload qiniu
		try {
			uri = `${cfg.qiniu.prefix}/${await sync.qiniuSync.upload(save)}`;
			await fs2.remove(save);
		} catch(err) {
			console.warn('AssetMetaDataSync#_tryParseURI#3', err);
		}

		return uri;
	}

	async isCanDequeue() {
		return true;
	}

	private async _SyncFromData(data: any, asset: Asset, chain: ChainType, _uri: string) {
		const {id, token, tokenId, uri} = asset;

		var {
			name, description, image_url, image: image_, img, media, video, video_url, doc,
			animation_url, image_data, properties, attributes, images,
			external_link,externalLink,external_url,backgroundColor,background_color,categorie,error,code,errno,
		} = data;

		if (error || code || errno) {
			throw Error.new(`AssetMetaDataSync#_SyncFromData 5 Error => token:${token},tokenId:${tokenId},error:${error},code:${code},errno:${errno}`);
		}

		var name = (name || '').substr(0, 256); // limit length
		var description = description || ''; // limit length

		if (description.length > 2048) {
			description = await utils.storage(description);
		}

		var imageOrigin = image_ || image_url || img || '';
		var mediaOrigin = media || video || video_url || animation_url || doc || '';
		var properties = properties || attributes || undefined;
		var externalLink = externalLink || external_link || external_url || '';
		var backgroundColor = backgroundColor || background_color || '';
		var props = {name,description,properties,externalLink,backgroundColor,categorie} as Dict;

		if (imageOrigin || mediaOrigin || image_data) {

			if (mediaOrigin || image_data) {
				mediaOrigin = await this._tryParseDataMediaURI(asset, mediaOrigin || image_data);
			}

			if (imageOrigin) {
				imageOrigin = await this._tryParseDataMediaURI(asset, imageOrigin);
			} else if (image_data) {
				imageOrigin = mediaOrigin; // use image data
			}

			Object.assign(asset, { ...props,
				mediaOrigin: mediaOrigin || imageOrigin,
				imageOrigin: imageOrigin,
			});

			await db.update(`asset_${chain}`, asset, { id });
		}
		else {
			console.warn('AssetMetaDataSync#onSync 6 Cannot parse uri data', uri, _uri, data);
			Object.assign(asset, props); // set
			await db.update(`asset_${chain}`, props, { id });
		}
	}

	protected async onSync(asset: Asset, chain: ChainType) {
		let { id, token, tokenId, uri } = asset;

		if (!uri) {
			var ent = make(token, ContractType.Asset, chain) as AssetERC721;
			uri = await utils.storageTokenURI(await ent.uriNoErr(tokenId), asset);
			somes.assert(uri, `AssetMetaDataSync#onSync 1 uri empty, ${token}, ${tokenId}, ${chain}`);
			Object.assign(asset, {syncTime: Date.now(), uri}); // set
			await db.update(`asset_${chain}`, { syncTime: Date.now(), uri }, { id });
		}

		// uri = 'https://hash-artloop.stars-mine.com/v2/resident/applets/getRightsForNFT/rights_id/12';
		// opensea uri
		// https://api.opensea.io/api/v1/metadata/0x495f947276749Ce646f68AC8c248420045cb7b5e/0x{id}
		// ipfs://bafkreihm3kxngqd2eq5qv4pd5ujso73w5uf4ogmymngy5nm7qzgs6uxrce
		var {uri: _uri, data} = utils.toURIData(uri, asset);
		var data_raw: string | Buffer = data;
		if (_uri) {
			try {
				data_raw = (await utils.get(_uri, {
					onReady: (statusCode: number, headers: Dict)=>{
						const type = (headers['content-type'] || '').split(';')[0].split('/')[0];
						somes.assert(type != 'image' && type != 'video' && type != 'audio', errno.ERR_SYNC_META_URI_MIME_ERROR);
					},
					limitDataSize: 1e5, // 100kb
				})).data; // download json or doc data
			} catch(err: any) {
				if (err.errno != errno.ERR_SYNC_META_URI_MIME_ERROR[0]) throw err;
				await this._SyncFromData({media: _uri}, asset, chain, _uri);
				return;
			}
		}

		somes.assert(data_raw && data_raw.length, `AssetMetaDataSync#onSync 2 uri invalid, ${token}, ${tokenId}, ${_uri}`);

		// check data type is base64 or hex .. string
		var str = String(this._tryParseStrData(String(data_raw)).data);

		try {
			var json_data = this._ParseJSON(str);
			try {
				if (await db.selectOne(`asset_json_${chain}`, {asset_id: id})) {
					await db.update(`asset_json_${chain}`, {json_data}, {asset_id: id});
				} else {
					await db.insert(`asset_json_${chain}`, {json_data, asset_id: id});
				}
			} catch(err) {
				console.warn(`AssetMetaDataSync#onSync 3 Cannot save json`, token, tokenId, err);
			}
		} catch(err) {
			console.warn(`AssetMetaDataSync#onSync 4 invalid json in str`, token, tokenId, err);
			let media = await this._tryParseDataMediaURI(asset, data_raw); // parse other data or uri
			Object.assign(asset, { media }); // set
			await db.update(`asset_${chain}`, { media }, { id });
			return;
		}

		await this._SyncFromData(data, asset, chain, _uri);
	}

	protected async onSyncComplete(asset: Asset, chain: ChainType) {
		await db.update(`asset_${chain}`, { retry: 0, retryTime: Date.now() }, { id: asset.id });
	}

	protected async onError(asset: Asset, chain: ChainType) {
		await db.update(`asset_${chain}`, { retry: asset.retry + 1, retryTime: Date.now() }, { id: asset.id });
	}

	async fetch(token: string, tokenId: string, chain: ChainType, force?: boolean) {
		let ent = make(token, ContractType.ERC721, chain) as AssetERC721;
		let asset = await ent.asset(tokenId);
		await this.fetchFrom(asset, chain, force);
	}

	async fetchFrom(asset: Asset, chain: ChainType, force?: boolean) {
		var {id, token, uri, mediaOrigin} = asset;
		if (await this.isQueue(id, chain))
			return;
		if (force || !uri || !mediaOrigin) {
			await this.enqueue(id, token, chain);
		}
	}
}
