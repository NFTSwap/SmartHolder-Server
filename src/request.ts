/**
 * @copyright © 2021 Copyright ccl
 * @date 2021-11-04
 */

import * as req from 'bclib/request';
import * as cfg from '../config';

export * from 'bclib/request';

class MVPSer extends req.BcRequest {
	protected user = 'SmartHolderServer';
	protected shareKey = 'a4dd53f2fefde37c07ac4824cf7085439633e1a357daacc3aaa16418275a9e40';
}

export const txApi = new MVPSer(cfg.tx_api || 'https://mvp.stars-mine.com/service-api');

txApi.urlencoded = false;

export default txApi;
