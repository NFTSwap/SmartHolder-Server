/**
 * @copyright © 2022 Copyright SmartHolder Server
 * @date 2022-07-18
 */

async function start() {
	if (process.env.RUN_DAEMON=='1') { // run daemon multiple workers
		var target = process.env.RUN_TARGET;
		var workers = Number(process.env.RUN_WORKERS) || 0;
		if (target == 'web') {
			await (await import('./run/daemon')).startWeb(workers);
		} else if (target == 'watch') {
			await (await import('./run/daemon')).startWatch(workers);
		} else if (target == 'indexer') {
			await (await import('./run/daemon')).startIndexer(workers);
		} else if (target == 'tx') {
			await (await import('./run/daemon')).startWeb3TxDequeue(workers);
		}
	} else { // run single worker
		await (await import('./run/worker')).default();
	}
}

start().then(()=>console.log('\n--------------------- Start [SmartHolder-Server] OK ---------------------')).catch(e=>{
	console.error(e);
	process.exit(e.errno || -1);
});