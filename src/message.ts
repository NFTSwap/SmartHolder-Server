/**
 * @copyright © 2021 Copyright dphone.com
 * @date 2022-07-21
 */

import bus from 'bclib/message';
import {ChainType} from './models/def';
import {disableWeb} from './env';
import server from './server';
import { WSAPI } from './api';
import db, {Tasks} from './db';

export enum Events {
	WatchBlock = 'WatchBlock',
	TaskComplete = 'TaskComplete',
}

export function broadcastWatchBlock(worker: number, blockNumber: number, chain: ChainType) {
	bus.post(Events.WatchBlock, { worker, blockNumber, chain });
}

export function broadcastTaskComplete(task_id: number) {
	bus.post(Events.TaskComplete, { task_id });
}

if (!disableWeb) {

	bus.addEventListener(Events.TaskComplete, async function(e) {
		let {task_id} = e.data as { task_id: number };
		let tasks = await db.selectOne<Tasks>(`tasks`, {id: task_id});
		if (!tasks || !tasks.user) return;
		if (!server.isRun) return;

		let [event] = tasks.name.split('#');

		// publish to websocket client
		for (var conv of server.wsConversations) {
			var msg = conv.handles['msg'] as WSAPI;
			if (msg) {
				var user = await msg.userNotErr();
				if (user && user.name == tasks.user) {
					 // send to websocket user client
					msg.trigger(`${event}Complete`, {
						name: tasks.name, state: tasks.state, data: tasks.data, ok: tasks.state == 1
					});
					break;
				}
			}
		}
	});

}


export default bus;
