
import buffer from 'somes/buffer';
import {storage} from '../src/db';

export default async function() {

	let s = '😀😍'; // 😀1f600
	let b = buffer.from(s, 'utf8');

	let s2 = buffer.from(b).toString('utf-8'); // utf8 => string
	let AA = await storage.get('AA');

	return {
		AA,
		s2,
	}
}