/**
 * @copyright © 2021 Copyright ccl
 * @date 2021-11-04
 */

import * as req from 'bclib/request';
import * as cfg from '../config';
import {IBuffer} from 'somes/buffer';
import {parseJSON, Result} from 'somes/request';

export * from 'bclib/request';

class Yunpian extends req.BcRequest {

	parseResponseData(buf: IBuffer, r: Result): any {
		var json = buf.toString('utf8');
		var res = parseJSON(json);
		if (r.statusCode != 200) {
			throw Error.new([res.code, res.msg]).ext(res);
		}
		if (('errno' in res) ? res.errno === 0: res.code === 0) {
			return res.data;
		} else {
			throw Error.new([res.code, res.msg]).ext(res);
		}
	}
}

export const yunpian = new Yunpian(cfg.yunpian.prefix);

yunpian.timeout = 5e4; // 50s
