/**
 * @copyright © 2022 Smart Holder Server
 * @date 2022-07-19
 */

import somes from 'somes';
import errno from './errno';
import {Tasks} from './models/def';
import {WatchCat} from 'bclib/watch';
import db from './db';
import * as env from './env';
import {broadcastTaskComplete} from './message';

export interface TaskConstructor {
	new(tasks: Tasks): Task;
}

export abstract class Task {

	readonly tasks: Tasks;

	protected constructor(tasks: Tasks) {
		this.tasks = tasks;
	}

	abstract exec(): Promise<any>;

	async step<T = any>(func: (this: Task)=>Promise<T>, timeout?: number): Promise<T> {
		// TODO ...
		return {} as any;
	}

	next(error?: any, data?: any): void {
		// TODO ...
		// await this.exec();
	}

	static async make(this: TaskConstructor, name: string, method: string, args: any, user?: string) {
		let Constructor = this as TaskConstructor;
		// MekeDAO#Name
		somes.assert(await db.selectOne(`tasks`, { name, state: 0 }), errno.ERR_TASK_ALREADY_EXISTS);

		// id           int primary        key auto_increment, -- 主键id
		// name         varchar (64)                 not null, -- 任务名称, MekeDAO#Name
		// method       varchar (1204)               not null, -- 执行任务的方法以及文件名
		// args         json,                                  -- 执行参数数据
		// data         json,                                  -- 成功或失败的数据 {data, error}
		// step         int          default (0)     not null, -- 当前执行步骤
		// stepTime     int          default (0)     not null, -- 当前执行步骤的超时时间,可用于执行超时检查
		// user         varchar (64) default ('')    not null, -- 与用户的关联,完成后可以通知到客户端
		// state        int          default (0)     not null, -- 0进行中,1完成,2失败
		// time         bigint                       not null,

		let id = await db.insert(`tasks`, { name, method, args, state: 0, user, time: Date.now() });
		let tasks = await db.selectOne<Tasks>(`tasks`, {id});

		return new Constructor(tasks!);
	}

	static async task(this: TaskConstructor, id: number) {
		let Constructor = this as TaskConstructor;
		let tasks = await db.selectOne<Tasks>(`tasks`, {id});
		somes.assert(tasks, errno.ERR_TASK_NOT_EXISTS);
		return new Constructor(tasks!);
	}
}

export class TaskCenter implements WatchCat {

	async initialize(addWatch: (watch: WatchCat)=>void) {
		if (!env.workers || env.workers.id === 0) { // Main Worker
			addWatch(this);
		}
	}

	async cat() {
		// chech task timeout
		for (let task of await db.select<Tasks>(`tasks`, {state: 0})) {
			if (task.stepTime && task.stepTime < Date.now()) { // timeout
				let error = Error.new(errno.ERR_TASK_STEP_EXEC_TIMEOUIT);
				if (await db.update(`tasks`, { state: 3 /*fail*/, data: { error } }, { id: task.id, state: 0 }) == 1) {
					// 更新成功后，发送完成消息
					broadcastTaskComplete(task.id);
				}
			}
		}
		return true;
	}
}

export default new TaskCenter();