/**
 * @copyright © 2020 Copyright ccl
 * @date 2021-06-28
*/

import * as sqlite from 'bclib/sqlite';
import paths from 'bclib/paths';
import {Storage} from 'bclib/storage';
import {DatabaseTools} from 'somes/db';
import {MysqlTools} from 'somes/mysql';
import pool from 'somes/mysql/pool';
import {Charsets} from 'somes/mysql/constants';
import * as cfg from '../config';

export * from './models/def';

export const storage = new Storage();

// "animation_url": "https://storage.opensea.io/files/059b00a2e3443f5579742e8ae5392b9d.mp4"

export const main_db: DatabaseTools = cfg.mysql ? new MysqlTools(cfg.mysql as any): new sqlite.SQLiteTools(`${paths.var}/shs.db`);
export const local_db: DatabaseTools = new sqlite.SQLiteTools(`${paths.var}/shs-local.db`); // local db

if (pool) {
	pool.CHAREST_NUMBER = Charsets.UTF8MB4_UNICODE_CI;
}

async function load_main_db() {
	await main_db.load(`
		CREATE TABLE if not exists dao (
			id           int primary key auto_increment,
			name         varchar (64)   not null,
			mission      varchar (1024) not null,
			describe     varchar (1024) not null,
			root         varchar (64)   not null,
			operator     varchar (64)   not null,
			member       varchar (64)   not null,
			ledger       varchar (64)   not null,
			assetGlobal  varchar (64)   not null,
			asset        varchar (64)   not null,
			time         bigint         not null,
			modify       bigint         not null
		);
		create table if not exists ledger (
			id           int primary key auto_increment,
			dao_id       int not null,
			ledger_addr  varchar (64)    not null,
			type         int default (0) not null, -- 0保留,1进账,2出账-取出,3出账-成员分成
			name         varchar (64)    default ('') not null,
			describe     varchar (1024)  default ('') not null,
			target       varchar (64)    not null,
			member       varchar (128)   default ('') not null, -- 成员出账id,如果为成员分成才会存在
			balance      varchar (128)   not null,
			time         bigint          not null
		);
		create table if not exists member (
			id           int primary key auto_increment,
			token        varchar (128)   not null,
			tokenId      varchar (128)   not null,
			owner        varchar (64)    not null,
			name         varchar (64)    not null,
			info         varchar (512)   not null,
			avatar       varchar (512)   not null,
			role         int default (0) not null,
			votes        int default (0) not null,
			time         bigint          not null,
			modify       bigint          not null
		);
	`, [
	], [
	], 'shs');
}

export async function initialize() {

	if (cfg.fastStart) {
		await main_db.load(``, [], [], 'shs');
	} else {
		await load_main_db();
	}

	await storage.initialize(main_db);
}

export default main_db;