/**
 * @copyright © 2021 Copyright ccl
 * @date 2021-09-26
 */

import buffer, {IBuffer} from 'somes/buffer';
import * as cfg from '../config';
import cfg2 from 'bclib/cfg';
import * as crypto from 'crypto';
import somes from 'somes';
import req, {Params,Options as ReqOptions,Result} from 'somes/request';
import errno from './errno';
import wget, {WgetIMPL} from 'somes/wget';
import * as fs2 from 'somes/fs2';
import path from 'somes/path';
import paths from 'bclib/paths';
import _hash from 'somes/hash';
import {Http2Sessions,http2request as http2requestRaw} from 'somes/http2';
import qiniu, {exists} from 'bclib/qn';

var proxyFetchs = [] as number[];
var proxyFetchsTotal = 1;

var httpProxyCfg = ((cfg as any).httpProxy as string[] || []).filter(e=>{
	proxyFetchs[proxyFetchs.length] = 0;
	return e;
});

function httpProxy(url: string, noCrypt?: boolean) {
	somes.assert(httpProxyCfg.length, 'httpProxy non configure');
	var [a, ...b] = proxyFetchs.map(e=>Math.round((1-e/proxyFetchsTotal)*proxyFetchsTotal));
	var index = somes.fixRandom(a, ...b);
	var proxy = httpProxyCfg[index];
	var url = `${proxy}/files/security/${buffer.from(url).toString('base58')}?`;
	if (noCrypt) {
		url += 'noCrypt=1&';
	}
	return {url, index};
}

export function decryptData(src: IBuffer) {
	var cipher = crypto.createDecipheriv('aes-256-cbc',
		buffer.from(cfg2.filesSecurityKey.slice(2), 'hex'),
		buffer.from(cfg2.filesSecurityVi.slice(2), 'hex')
	);
	return buffer.concat([cipher.update(src), cipher.final()]);
}

export async function multipleFetch<T>(url: string, 
	fetch: (url: string, arg: {retry: number, proxy: boolean, url: string})=>Promise<T>, 
	noCrypt?: boolean, onlyProxy?: boolean, retryLimit: number = 1): Promise<T> 
{
	retryLimit = Math.min(httpProxyCfg.length, retryLimit || 1);
	var opts = { retry: 0, proxy: false, url };
	do {
		var index = -1;
		try {
			opts.proxy = (onlyProxy && httpProxyCfg.length) as boolean || opts.retry > 0;
			if (opts.proxy) {
				var {index, url} = httpProxy(opts.url, noCrypt);
				proxyFetchs[index]++;
				proxyFetchsTotal++;
				return await fetch(url, opts);
			} else {
				return await fetch(opts.url, opts);
			}
		} catch(err: any) {
			if (err.errno == errno.ERR_HTTP_STATUS_404[0])
				throw err;
			if (opts.retry == retryLimit)
				throw err;
		} finally {
			if (index != -1) {
				proxyFetchs[index]--;
				proxyFetchsTotal--;
			}
		}
		opts.retry++;
		// await somes.sleep(1e3, 1)
	} while(true);
}

export interface ToURIOptions {
	token: string;
	tokenId: string;
}

export function toURINoErr(uri?: string | null, opts?: ToURIOptions) {
	if (uri) {
		// opensea uri
		if (uri.match(/^https?:\/\//i)) {
			// https://mvp.stars-mine.com/asset/{chain}/{token}/{id}
			// https://mvp.stars-mine.com/asset/0x{address}/0x{id}
			// https://api.opensea.io/api/v1/metadata/0x495f947276749Ce646f68AC8c248420045cb7b5e/0x{id}
			if (opts) {
				uri = uri
					// .replace('{chain}', String(asset.chain))
					.replace(/(0x)?\{(token|address)\}/, opts.token)
					.replace(/(0x)?\{id\}/, opts.tokenId)
				;
			}
		} else {
			// ipfs://bafkreihm3kxngqd2eq5qv4pd5ujso73w5uf4ogmymngy5nm7qzgs6uxrce
			// ipfs://bafybeid6km4yfumyvfbztz67us6ked47p3pa57t2pzr4yj76bgdjnqf6ni/image
			var m = uri.match(/^ipfs:\/\/(ipfs\/)?(.+)$/i);
			// somes.assert(m, 'no match ipfs uri');
			if (m) {
				uri = 'https://ipfs.io/ipfs/' + (m as any)[2] as string;
			} else {
				return '';
			}
		}
	} else {
		return '';
	}

	if (/googleusercontent\.com/i.test(uri)) {
		uri = uri.replace(/\=s\d+$/, '');
		uri += '=s0';
	}

	return uri;
}

export function toURI(_uri?: string | null, opts?: ToURIOptions) {
	var uri = toURINoErr(_uri, opts);
	somes.assert(uri, `Unknown match uri ${uri}`);
	return uri as string;
}

export function toURIData(_uri?: string | null, opts?: ToURIOptions) {
	if (_uri) {
		var uri = toURINoErr(_uri, opts);
		if (uri) {
			return {uri, data: ''};
		} else {
			return {uri: '', data: _uri};
		}
	}
	return {uri: '', data: ''};
}

export async function storageTokenURI(uri?: string | null, opts?: ToURIOptions) {
	let {uri: uri_, data} = toURIData(uri, opts);
	if (data) {
		var ext = '.txt';
		var s = 'data:application/json;base64,';
		if (data.substring(0, s.length) == s) {
			ext = '.json';
			data = buffer.from(data.substring(s.length).trim(), 'base64').toString('utf-8');
		}
		if (data.length <= 66 && buffer.isBase64String(data)) {
			// var src = `https://ipfs.io/ipfs/${data}`;
			// TODO ...
		}
		uri_ = await storage( data, ext);
	}
	return uri_ || '';
}

export async function storage(data: string | IBuffer, ext?: string) {
	var hash = _hash.sha256(data).toString('base58');
	ext = ext || '.txt';
	if (!await exists(`${hash}${ext}`)) {
		var local = `${paths.res}/${hash}${ext}`;
		await fs2.writeFile(local, data); // write file
		await qiniu(local); // upload qiniu
		try {
			await fs2.remove(local);
		} catch(err: any) {
			console.warn('utils#storage', err.message);
		}
	}
	return `${cfg.qiniu.prefix}/${hash}${ext}`;
}

export interface Options extends ReqOptions {
	handleStatusCode?: (r: Result)=>void;
	http2?: boolean;
}

type Req = (url: string, opts?: ReqOptions | undefined)=>Promise<Result<IBuffer>>;

const http2sessions = new Http2Sessions();

export function request(uri: string, opts?: Options, onlyProxy?: boolean, retry?: number) {
	var retry301 = 3;
	var _opts = {statusCode: 200, ...opts};

	return multipleFetch(uri, async(url, opts)=>{
		var request: Req = req.request;

		if (opts.proxy) {
			if (_opts.http2)
				url += `http2=1&`;
			if (_opts.minSsl)
				url += `sslVersion=${_opts.minSsl}&`;
		} else if (_opts.http2) {
			request = (url: string, opts?: ReqOptions | undefined)=>{
				return http2requestRaw(http2sessions.session(url, opts), url, opts);
			};
		}

		var r = await request(url, {timeout: opts.proxy ? 2e4: 1e4, ..._opts});
		if ((r.statusCode == 301 || r.statusCode == 302) && --retry301) {
			var location = r.headers.location;
			if (!/^https?:\/\//i.test(location)) {
				location = path.origin(opts.url) + location;
			}
			opts.url = toURI(r.headers.location);
			opts.retry = -1;
		}
		// if (opts.proxy) 
		// 	r.data = decryptData(r.data);
		if (_opts.handleStatusCode) {
			_opts.handleStatusCode(r);
		} else if (r.statusCode != 200) {
			// if (r.statusCode == 429) {} The server denied access
			if (r.statusCode == 404) {
				var err = Error.new(errno.ERR_HTTP_STATUS_404).ext({uri, url, ...r, data: r.data + ''});
			} else {
				var err = Error.new(errno.ERR_HTTP_STATUS_NO_200).ext({uri, url, ...r, data: r.data + ''});
			}
			// console.warn(err);
			throw err;
		}
		return r;
	}, true, onlyProxy, retry);
}

export async function getString(uri: string, _opts?: Options) {
	var r = await request(uri, {..._opts, method: 'GET'});
	var str = r.data.toString('utf8');
	return str;
}

export function get(uri: string, _opts?: Options, retry?: number) {
	return request(uri, { ..._opts, method: 'GET'}, undefined, retry);
}

export function post(uri: string, params?: Params, _opts?: Options, retry?: number) {
	return request(uri, { ..._opts, params, method: 'POST'}, undefined, retry);
}

export const downloading: Map<string, WgetIMPL> = new Map();

export function download(www: string, save: string) {
	let retry301 = 3;
	return multipleFetch(www, async (url, opts)=>{
		var location = '';
		try {
			var w = wget(url, save, { renewal: true, timeout: opts.proxy ? 2e4: 1e4, onRedirect: s=>(location=s,false) });
			downloading.set(www, w);
			var ok = await w;
			console.log('download', www, '=>', url);
			return ok;
		} catch(err: any) {
			if (location && --retry301) { // 301/302 retry
				opts.url = toURI(location);
				opts.retry = -1;
			}
			throw Error.new(err).ext({ origin: www });
		} finally {
			downloading.delete(www);
		}
	}, true);
}

// download file and upload to qiniu
export function downloadToQiniu(www: string, save?: string) {
	// TODO ...
}