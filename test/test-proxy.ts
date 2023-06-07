
import req from 'somes/request';

export default async function() {

	let rr = await req.get('https://dao-rel.smartholder.jp/service-api/descriptors/descriptors', {
		dataType: 'json',
		// proxy: 'http://127.0.0.1:10871',
		proxy: 'http://127.0.0.1:1087/'
	})

	// let data = JSON.parse(rr.data.toString('utf-8'));

	return rr.data+'';
}