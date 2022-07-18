/**
 * @copyright © 2021 Copyright ccl
 * @date 2021-11-09
*/

import { AssetContract } from './def';

export class Entity<T> {
	readonly value: T;
	constructor(value: T) {
		this.value = value;
	}
}

export class AssetContractEntity extends Entity<AssetContract> {
	isValid() {
		return !this.value.state;
	}
}