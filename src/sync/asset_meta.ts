/**
 * @copyright © 2021 Copyright ccl
 * @date 2021-07-06
 */

import db, { storage, Asset, AssetType, local_db, ChainType, Collection } from '../db';
import * as cfg from '../../config';
import somes from 'somes';
import buffer, {Buffer, IBufferEncoding,isTypedArray} from 'somes/buffer';
import paths from 'bclib/paths';
import _hash from 'somes/hash';
import * as fs2 from 'somes/fs2';
import {SyncQueue} from './queue';
import {QiniuSync} from './qiniu';
import * as fetch from '../utils';
import {make} from '../asset';
import sync from '.';
import {WatchCat} from 'bclib/watch';
import {web3s} from '../web3+';
import {AssetMetaSourceDownload} from './asset_download';
import errno from '../errno';

export class AssetMetaDataSync extends SyncQueue {

	constructor() {
		super('asset_queue');
	}

	readonly assetMetaSourceDownload = new AssetMetaSourceDownload('asset_download_queue');

	printLogs() {
		var logs = this.logs();
		for (var log of logs.wget) {
			console.log('WGET', log);
		}
		console.log('WGET.size', logs.wget_length);
	}

	logs() {
		var wget = [] as string[];
		for (var [k,v] of fetch.downloading) {
			wget.push(`${v.time.timeStr} ${v.readyState||'conn'} ${v.size}/${v.total} ${v.www} ${k}`);
		}
		//{token: string; tokenId: string; uri: string; type: number; platform: string}[];
		var runing = [] as string[];
		for (let [k,{ token, tokenId, uri, type, chain }] of this._runingObj) {
			runing.push(`${token} ${tokenId} ${ChainType[chain]} ${AssetType[type]} ${uri}`);
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

	private async addToDownloadQueue(asset: Asset, canRetry = 1) {
		await this.assetMetaSourceDownload.enqueue(asset.id, asset.token, asset.chain, canRetry);
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
			// TODO ...
			/*
			if (data.length <= 66 && buffer.isBase64String(data)) {
				// try ipfs download
				try {
					var src = `https://ipfs.io/ipfs/${data}`;
					// var dest = await this._download(asset, src);
					if (!AssetMetaSourceDownload.equalsQiniuAssetSource(asset, src, asset.image))
						await this.addToDownloadQueue(asset, 0);
					var props = {
						imageOrigin: src,
						mediaOrigin: src,
						image: asset.image || src,
						media: asset.media || src, name, info, ...row
					};
					Object.assign(asset, props); // set
					await db.update('asset', props, { id });
					return;
				} catch(err) {
					console.warn('AssetMetaDataSync#_tryParseURI#2', err);
				}
			}*/
		}

		return {data, mime};
	}

	private async _tryParseDataMediaURI(asset: Asset, rawData: string | Buffer) {
		let {id,token,tokenId} = asset;
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

		let {uri: s} = fetch.toURIData(str, asset); // is uri
		if (s) {
			return s;
		}

		let parseStr = this._tryParseStrData(str); // is uri data
		if (parseStr.mime) {
			var {mime,data} = parseStr;
		}

		let ext = AssetMetaSourceDownload.extname(mime);
		let uri = `${cfg.publicURL}/files/res/${hash}${ext}`;
		let save = `${paths.res}/${hash}${ext}`;
		await fs2.writeFile(save, data);
		await local_db.insert('asset_local_res', { hash, id, mime });

		// upload qiniu
		try {
			uri = `${cfg.qiniu.prefix}/${await sync.qiniuSync.upload(save)}`;
			await QiniuSync.removeLocal(save);
		} catch(err) {
			console.warn('AssetMetaDataSync#_tryParseURI#3', err);
		}

		return uri;
	}

	private _Debug: ((asset: Asset)=>boolean) | null = null;

	async isCanDequeue() {
		return true;
	}

	private async _SyncFromData(data: any, asset: Asset, _uri: string) {
		const {id, token, tokenId, uri, media: oldMedia, image: oldImage} = asset;

		enum OpenseaCategories {
			ART = 1,
			MUSIC,
			DOMAIN_NAMES,
			VIRTUAL_WORLDS,
			TRADING_CARDS,
			COLLECTIBLES,
			SPORTS,
			UTILITY,
			Categories_NUM,
		}

		interface OpenseaAssetURIMeta {
			name: string; // 名称
			description: string; // 描述
			external_link?: string; // 扩展数据link
			image?: string; // 图片地址
			animation_url?: string; // 动态图片地址，也可以是视频地址
			images?: string[]; // 多图片列表
			attributes?: {trait_type: string; value: string}[]; // 特征数据
			categorie?: OpenseaCategories;
			collection?: {
				imageUrl: string;
				name: string;
				slug: string;
				id: string;
				categorie: OpenseaCategories;
				traits?: {
					stringTraits: {
						key: string;
						counts: { count: number; value: number }[];
					}[];
					numericTraits: {
						key: string;
						value: { max: number; min: string }[];
					}[];
				} | null;
				description: string;
			};
		}

		/*
			// {
			// 	"name": "Diva 007",
			// 	"description": "#007\nElement: air",
			// 	"external_link": "https://opensea.io/collection/naturedivas/",
			// 	"image": "https://lh3.googleusercontent.com/U61KH6g_g2sO7ZOz92ILJm-hAYzWdpQScWD9Kk3O78pJh4_39QV0qvzLlG_CmkC0N18r6brELJuvrrlarlu-LAAgDwAVxkwXYGux",
			// 	"animation_url": null
			// 	"images": [],
			// attributes: [
			// {
			// trait_type: "Bones",
			// value: "Emerald"
			// },
			// {
			// trait_type: "Clothes",
			// value: "None"
			// },
			// {
			// trait_type: "Mouth",
			// value: "None"
			// },
			// {
			// trait_type: "Eyes",
			// value: "None"
			// },
			// {
			// trait_type: "Hat",
			// value: "Confetti Party Hat"
			// },
			// {
			// trait_type: "Super Power",
			// value: "None"
			// }
			// ]
			// }
		*/

		var {
			name, description, image_url, image: image_, media, video, video_url, doc,
			animation_url, image_data, properties, attributes, images,
			external_link,externalLink,external_url,backgroundColor,background_color,categorie,collection,error,code,errno,
		} = data;

		if (error || code || errno) {
			throw Error.new(`AssetMetaDataSync#onSync 5 Error => token:${token},tokenId:${tokenId},error:${error},code:${code},errno:${errno}`);
		}

		var name = (name || '').substr(0, 256); // limit length
		var info = description || ''; // limit length

		if (info.length > 2048) {
			info = await fetch.storage(info);
		}

		var imageOrigin = image_ || image_url || '';
		var mediaOrigin = media || video || video_url || animation_url || doc || '';
		var properties = properties || attributes || undefined;
		var externalLink = externalLink || external_link || external_url || '';
		var backgroundColor = backgroundColor || background_color || '';
		var props = {name,info,properties,externalLink,backgroundColor,categorie} as Dict;

		if (collection) {
			let { imageUrl = '', slug, categorie = 0, id = slug, name = slug, traits, description = '' } = collection;
			if (id) {
				var [c] = await db.select('collection', { opensea_id: id }) as Collection[];
				if (!c) {
					await db.insert('collection', { imageUrl, slug, categorie, opensea_id: id, name, traits, description });
				}
				props.collection = id;
			}
		}

		if (imageOrigin || mediaOrigin || image_data) {

			if (mediaOrigin || image_data) {
				mediaOrigin = await this._tryParseDataMediaURI(asset, mediaOrigin || image_data);
			}

			if (imageOrigin) {
				imageOrigin = await this._tryParseDataMediaURI(asset, imageOrigin);
			} else if (image_data) {
				imageOrigin = mediaOrigin; // use image data
			}

			var _asset = {
				...props,
				mediaOrigin: mediaOrigin || imageOrigin,
				imageOrigin: imageOrigin,
				media: asset.media || mediaOrigin || imageOrigin,
				image: asset.image || imageOrigin,
			};

			Object.assign(asset, _asset); // set
			await db.update('asset', _asset, { id });

			if (imageOrigin && !AssetMetaSourceDownload.equalsQiniuAssetSource(asset, imageOrigin, oldImage)) {
				await this.addToDownloadQueue(asset);
			}
			else if (mediaOrigin && !AssetMetaSourceDownload.equalsQiniuAssetSource(asset, mediaOrigin, oldMedia)) {
				await this.addToDownloadQueue(asset);
			}
		}
		else {
			console.warn('AssetMetaDataSync#onSync 6 Cannot parse uri data', uri, _uri, data);
			Object.assign(asset, props); // set
			await db.update('asset', props, { id });
		}
	}

	protected async onSync(asset: Asset) {
		this._Debug && this._Debug(asset);

		// if (token == '0x9122B8735B8B9FdAf46d7E49aF196602e7A511b1' && tokenId == '0x000000000000000000000000000000000000000000000000000000000000000c') {
		// }
		// token = '0x9122B8735B8B9FdAf46d7E49aF196602e7A511b1';
		// tokenId = '0x000000000000000000000000000000000000000000000000000000000000000c'

		let { id, token, tokenId, uri } = asset;

		if (!uri) {
			var ent = make(token, asset.type, asset.chain);
			uri = await fetch.storageTokenURI(await ent.uriNoErr(tokenId), asset);
			somes.assert(uri, `AssetMetaDataSync#onSync 1 uri empty, ${token}, ${tokenId}, ${asset.chain}`);
			Object.assign(asset, {syncTime: Date.now(), uri}); // set
			await db.update('asset', { syncTime: Date.now(), uri }, { id });
		}

		// uri = 'https://hash-artloop.stars-mine.com/v2/resident/applets/getRightsForNFT/rights_id/12';
		// opensea uri
		// https://api.opensea.io/api/v1/metadata/0x495f947276749Ce646f68AC8c248420045cb7b5e/0x{id}
		// ipfs://bafkreihm3kxngqd2eq5qv4pd5ujso73w5uf4ogmymngy5nm7qzgs6uxrce
		var {uri: _uri, data: _data} = fetch.toURIData(uri, asset);
		var rawData: string | Buffer = _data;
		if (_uri) {
			try {
				rawData = (await fetch.get(_uri, {
					onReady: (statusCode: number, headers: Dict)=>{
						const type = (headers['content-type'] || '').split(';')[0].split('/')[0];
						somes.assert(type != 'image' && type != 'video' && type != 'audio', errno.ERR_SYNC_META_URI_MIME_ERROR);
					},
					limitDataSize: 1e5, // 100kb
				})).data; // download json or doc data
			} catch(err: any) {
				if (err.errno != errno.ERR_SYNC_META_URI_MIME_ERROR[0]) throw err;
				await this._SyncFromData({media: _uri}, asset, _uri);
				return;
			}
		}

		somes.assert(rawData && rawData.length, `AssetMetaDataSync#onSync 2 uri invalid, ${token}, ${tokenId}, ${_uri}`);

		// check data type is base64 or hex .. string
		var str = String(this._tryParseStrData(String(rawData)).data);

		try {
			var data = this._ParseJSON(str);
			try {
				if (await db.selectOne('asset_json', {asset_id: id})) {
					await db.update('asset_json', {json: data}, {asset_id: id});
				} else {
					await db.insert('asset_json', {json: data, asset_id: id});
				}
			} catch(err) {
				console.warn(`AssetMetaDataSync#onSync 3 Cannot save json`, token, tokenId, err);
			}
		} catch(err) {
			console.warn(`AssetMetaDataSync#onSync 4 invalid json in str`, token, tokenId, err);
			let media = await this._tryParseDataMediaURI(asset, rawData); // parse other data or uri
			Object.assign(asset, { media }); // set
			await db.update('asset', { media }, { id });
			return;
		}

		await this._SyncFromData(data, asset, _uri);
	}

	protected async onSyncComplete(asset: Asset) {
		await db.update('asset', { retry: 0, retryTime: Date.now() }, { id: asset.id });
	}

	protected async onError(asset: Asset) {
		await db.update('asset', { retry: asset.retry + 1, retryTime: Date.now() }, { id: asset.id });
	}

	async fetch(token: string, tokenId: string, type: AssetType, chain: ChainType, force?: boolean) {
		var ent = make(token, type, chain);
		var asset = await ent.asset(tokenId);
		await this.fetchFrom(asset, force);
	}

	async fetchFrom(asset: Asset, force?: boolean) {
		var {id, token, tokenId, chain, type} = asset;

		if (await this.isQueue(id)) {
			return;
		}
		if (!type) { // skip INVALID type
			console.warn(`This kind of asset is not supported for the time being`, token, tokenId, ChainType[chain], AssetType[type]);
			return;
		}

		var uri = '';

		if (!asset.uri || force) {
			var ent = make(token, type, chain);
			uri = await fetch.storageTokenURI(await ent.uriNoErr(tokenId), asset);
			uri = uri.substring(0, 512);
			if (uri) {
				await db.update('asset', { syncTime: Date.now(), uri }, { id: asset.id });
			}
		}

		if (uri) {
			if (asset.uri != uri) {
				asset.uri = uri;
				await this.enqueue(id, token, chain);
				return;
			}
		}

		if (asset.uri) {
			if (force) {
				await this.enqueue(id, token, chain);
			} else {
				var {media, image, imageOrigin, mediaOrigin} = asset;
				if (/*!imageOrigin || */!mediaOrigin) {
					await this.enqueue(id, token, chain);
				} else if (!media/* || !image*/) { // no media or image
					await this.assetMetaSourceDownload.enqueue(id, token, chain);
				} else if (/*imageOrigin == image || */mediaOrigin == media) { // download media and image
					await this.assetMetaSourceDownload.enqueue(id, token, chain);
				} else {
					for (var url of [media, image]) {
						if (url && !QiniuSync.isQiniu(url)) { // no qiniu
							await this.assetMetaSourceDownload.enqueue(id, token, chain);
							break;
						}
					}
				}
			} // if (force)
		} else {// if (asset.uri)
			await this.enqueue(id, token, chain);
		}
	}
}

export class AssetMetaDataUpdate implements WatchCat {

	cattime = 60 * 10; // 60 minute cat()
	tryTime = 1 * 10; // try time 1 minute

	private async endCat(offset: number) {
		await storage.set('NFTAssetDataSync_Offset', offset);
		await storage.set('NFTAssetDataSync_Time', Date.now());
	}
	
	async cat() {
		var day = 10*24*3600*1e3; // 10天扫描一次数据
		var offset = await storage.get('NFTAssetDataSync_Offset', 0) as number;

		if (offset === 0) {
			var syncTime = await storage.get('NFTAssetDataSync_Time', 0) as number;
			if (syncTime + day > Date.now())
				return true;
		}

		do {
			console.log('NFTAssetDataSync_Offset start', offset);
			var assetList = await db.query<Asset>(`select * from asset where id > ${offset} limit 1000`);
			for (var asset of assetList) {
				try {
					if (asset.retry < 10/* && Date.now() > asset.retryTime + 3600*1e3*24*/ /*1d*/ ) {
						if (web3s[asset.chain]) {
							await sync.assetMetaDataSync.fetchFrom(asset);
						}
					}
				} catch(err: any) {
					// if (err.errno == -32005 && err.message.indexOf('request rate limited') != -1) {
					await this.endCat(offset);
					throw err;
				}
				offset++;
			}
			await this.endCat(offset);
			// await somes.sleep(1e2);
		} while (assetList.length !== 0);

		await this.endCat(0);

		return true;
	}
}