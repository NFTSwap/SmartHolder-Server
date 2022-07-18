/**
 * @copyright © 2021 Copyright ccl
 * @date 2021-02-08
 */

import {UncaughtException} from 'bclib/uncaught';

var log = new UncaughtException().makeDefault();

log.setIndent(false);

export default log;