/**
 * @copyright © 2022 Smart Holder Server
 * @date 2022-07-21
 */

import {Task} from './task';
import {Tasks} from './models/def';

// make new dao tasks

export class MakeDAO extends Task {

	constructor(tasks: Tasks) {
		super(tasks);
	}

	async exec(): Promise<any> {

		// TODO ...

		let num = await this.step(async function() {
			return 0;
		});

		let b = await this.step(async function() {
			console.log(num);
			return 0;
		});

	}
}

MakeDAO.make('a', '', {});