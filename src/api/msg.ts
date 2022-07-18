/**
 * @copyright © 2021 Copyright dphone.com
 * @date 2021-12-02
 */

import {WSAPI} from '../api';

export default class Message extends WSAPI {
	
	EVENTs() {
		return ['UpdateNFT'];
	}
}