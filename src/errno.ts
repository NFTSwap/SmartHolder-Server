/**
 * @copyright © 2020 Copyright ccl
 * @date 2020-11-28
 */

import {ErrnoList as SysErrnoList} from 'bclib/errno';

export class ErrnoList extends SysErrnoList {
	ERR_DUPLICATE_AUTH_NAME: ErrnoCode = [100307, `ERR_DUPLICATE_AUTH_NAME`, `重复用户认证名称`]
	ERR_QINIU_UPLOADING_ERR: ErrnoCode = [100311, `ERR_QINIU_UPLOADING`, `七牛上传错误`]
	ERR_QINIU_UPLOAD_LIMIT: ErrnoCode = [100312, `ERR_QINIU_UPLOAD_LIMIT`, `七牛上传并行超限`]
	ERR_HTTP_STATUS_404: ErrnoCode = [100317, 'ERR_HTTP_STATUS_404', `HTTP状态404错误`]
	ERR_SYNC_META_IMAGE_NONE: ErrnoCode = [100322, `ERR_SYNC_META_IMAGE_NONE`, '同步资产元数据图片是空的']
	ERR_SYNC_WAIT_BLOCK_TIMEOUT: ErrnoCode = [100325, `ERR_SYNC_WAIT_BLOCK_TIMEOUT`, `等待区块同步超时`]
	ERR_SYNC_META_URI_MIME_ERROR: ErrnoCode = [100324, `ERR_SYNC_META_URI_MIME_ERROR`, '同步资产元数据URI错误']
	ERR_TASK_STEP_EXEC_TIMEOUIT: ErrnoCode = [100326, `任务执行超时`]
	ERR_TASK_ALREADY_EXISTS: ErrnoCode = [100327, `任务已经存在`]
	ERR_TASK_NOT_EXISTS: ErrnoCode = [100328, `任务不存在`]
	ERR_TASK_BEEN_CLOSED: ErrnoCode = [100329, `任务已经关闭`]
	ERR_DAO_NAME_EXISTS: ErrnoCode = [100330, `DAO名称重复`]
	ERR_DAO_ADDRESS_NOT_EXISTS: ErrnoCode = [100331, `DAO地址不存在`]
	ERR_DAO_IS_BEING_CREATED: ErrnoCode = [100332, `当前用户有一个DAO正在创建中`, `用户有一个任务正在运行中`]
	ERR_DAO_HOST_NOT_FOUND: ErrnoCode = [100333, `通过地址找不到DAO实体`]
	ERR_TOKEN_TYPE_NOT_MATCH: ErrnoCode = [100334, `任务类型不匹配`]
	ERR_DAO_NOT_EXIST: ErrnoCode = [100335, `DAO不存在`]
	ERR_OPENSEA_ORDER_EXIST: ErrnoCode = [100336, `创建Opensea订单重复`, `该资产在Opensea可能已经上架`]
	ERR_OPENSEA_ORDER_NOT_EXIST: ErrnoCode = [100337, `Opensea订单为空`]
	ERR_ASSET_NOT_EXIST: ErrnoCode = [100338, `资产数据找不到`]
	ERR_OPENSEA_API_ERROR: ErrnoCode = [100339, `OpenseaAPI调用错误`]

	// A Dao is being created
}

export default new ErrnoList;