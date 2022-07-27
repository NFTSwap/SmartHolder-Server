
import somes from 'somes';
import {scopeLock} from 'bclib/atomic_lock';

let a = 0;

export default async function() {
	return await scopeLock('A', async function() {
		await somes.sleep(5e3);
		return a++;
	});
}