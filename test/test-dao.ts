
import {ChainType} from '../src/models/def';
import {MakeDAO} from '../src/task_dao';

export default async function() {

	let task = await MakeDAO.make('MakeDAO#Test', {
		name: 'Test',
		mission: 'Test',
		description: 'Test',
		operator: 'Test',
		chain: ChainType.RINKEBY,
	});

	task.next();
}