/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-28
 */

import {ErrnoList as SysErrnoList} from 'bclib/errno';

export class ErrnoList extends SysErrnoList {
	ERR_DUPLICATE_AUTH_NAME: ErrnoCode = [100307, `ERR_DUPLICATE_AUTH_NAME`]
	ERR_QINIU_UPLOADING_ERR: ErrnoCode = [100311, `ERR_QINIU_UPLOADING`]
	ERR_QINIU_UPLOAD_LIMIT: ErrnoCode = [100312, `ERR_QINIU_UPLOAD_LIMIT`]
	ERR_HTTP_STATUS_404: ErrnoCode = [100317, 'ERR_HTTP_STATUS_404']
	ERR_SYNC_META_IMAGE_NONE: ErrnoCode = [100322, `ERR_SYNC_META_IMAGE_NONE`]
	ERR_SYNC_WAIT_BLOCK_TIMEOUT: ErrnoCode = [100325, `ERR_SYNC_WAIT_BLOCK_TIMEOUT`]
	ERR_SYNC_META_URI_MIME_ERROR: ErrnoCode = [100324, `ERR_SYNC_META_URI_MIME_ERROR`]
	ERR_TASK_STEP_EXEC_TIMEOUIT: ErrnoCode = [100326, `ERR_TASK_STEP_EXEC_TIMEOUIT`]
	ERR_TASK_ALREADY_EXISTS: ErrnoCode = [100327, `ERR_TASK_ALREADY_EXISTS`]
	ERR_TASK_NOT_EXISTS: ErrnoCode = [100328, `ERR_TASK_NOT_EXISTS`]
	ERR_TASK_BEEN_CLOSED: ErrnoCode = [100329, `ERR_TASK_BEEN_CLOSED`]
	ERR_DAO_NAME_EXISTS: ErrnoCode = [100330, `ERR_DAO_NAME_EXISTS`]
	ERR_DAO_ADDRESS_NOT_EXISTS: ErrnoCode = [100331, `ERR_DAO_ADDRESS_NOT_EXISTS`]
	ERR_DAO_IS_BEING_CREATED: ErrnoCode = [100332, `ERR_DAO_IS_BEING_CREATED`]
	ERR_DAO_HOST_NOT_FOUND: ErrnoCode = [100333, `ERR_DAO_HOST_NOT_FOUND`]
	ERR_TOKEN_TYPE_NOT_MATCH: ErrnoCode = [100334, `ERR_TOKEN_TYPE_NOT_MATCH`]
	ERR_DAO_NOT_EXIST: ErrnoCode = [100335, `ERR_DAO_NOT_EXIST`]
	ERR_OPENSEA_ORDER_EXIST: ErrnoCode = [100336, `ERR_OPENSEA_ORDER_EXIST`]
	ERR_OPENSEA_ORDER_NOT_EXIST: ErrnoCode = [100337, `ERR_OPENSEA_ORDER_NOT_EXIST`]
	ERR_ASSET_NOT_EXIST: ErrnoCode = [100338, `ERR_ASSET_NOT_EXIST`]
	ERR_OPENSEA_API_ERROR: ErrnoCode = [100339, `ERR_OPENSEA_API_ERROR`]

	// A Dao is being created
}

export default new ErrnoList;