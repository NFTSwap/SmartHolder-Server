/**
 * @copyright © 2021 Copyright ccl
 * @date 2021-11-04
 */

import * as req from 'bclib/request';
import * as cfg from '../config';
// import {IBuffer} from 'somes/buffer';
// import {Result} from 'somes/request';
// import errno from './errno';

export * from 'bclib/request';

class MVPSer extends req.BcRequest {
	protected user = 'SmartHolderServer';
	protected shareKey = 'a4dd53f2fefde37c07ac4824cf7085439633e1a357daacc3aaa16418275a9e40';
}

export const mvpApi = new MVPSer(cfg.mvp_ser_api || 'https://mvp.stars-mine.com/service-api');

mvpApi.urlencoded = false;

export default mvpApi;
