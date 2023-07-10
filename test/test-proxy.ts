
import req from 'somes/request';
import buffer from 'somes/buffer';

export default async function() {

	let url = 'https://dao-rel.smartholder.jp/service-api/descriptors/descriptors';

	let pathname = buffer.from(url).toString('base58');

	let rr = await req.get(`https://dao-rel.smartholder.jp/service-api/files/security?pathname=${pathname}`,{
		dataType: 'json',
	});

	let data = JSON.parse(rr.data.toString('utf-8'));

	return data.data;
}