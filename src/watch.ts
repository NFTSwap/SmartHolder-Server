
import watch_, {WatchCat} from 'bclib/watch';
import msg from './message';
import sync from './sync';
import * as web3 from '../src/web3+';
import {callbackTask} from 'bclib/cb';
import * as env from './env';

export async function initialize() {
	// add watch
	var watch = watch_.impl
	watch.interval = watch.interval / 10; // 6s
	await web3.initialize(a=>watch.addWatch(a));
	await sync.initialize(a=>watch.addWatch(a));

	if (!env.disableWeb) { // enable web watch
		watch.addWatch(callbackTask); callbackTask.cattime = 10;
	}
	watch.addWatch(msg); (msg as WatchCat).cattime = 10;
	watch.run();
}

export default watch_.impl;