/**
 * @copyright © 2018 Copyright dphone.com
 * @date 2021-01-26
 */


#ifndef __hc_utils__
#define __hc_utils__

#include <functional>
#include <nan.h>

namespace hc {

	#define JS_Isolate info.GetIsolate()
	#define JS_Context info.GetIsolate()->GetCurrentContext()
	#define JS_HandleScope() v8::HandleScope scope(v8::Isolate::GetCurrent())
	#define JS_Self(type) auto self = static_cast<type*>(info.This()->GetAlignedPointerFromInternalField(0))
	#define JS_Assert(c, m, ...) if (!(c)) return hc::ThrowError(m, ##__VA_ARGS__)

	v8::Local<v8::Value> Error(int err_no, const char* msg = nullptr, ...);
	v8::Local<v8::Value> Error(const char* msg = nullptr, ...);
	void ThrowError(int err_no, const char* msg = nullptr, ...);
	void ThrowError(const char* msg, ...);

	/**
	 * @class AsyncWorker
	 */
	template<typename T> class AsyncWorker {
	public:
		AsyncWorker(T&& data,
			std::function<void(T& data)> exec,
			std::function<void(T& data, v8::Isolate* isolate)> complete
		)
			: _data(std::move(data)), _exec(exec), _complete(complete) {
			req.data = this;

			uv_queue_work(
					Nan::GetCurrentEventLoop()
				, &req
				, AsyncWorker::execute
				, AsyncWorker::execute_complete
			);
		}

	private:
		static void execute(uv_work_t* req) {
			auto w = static_cast<AsyncWorker<T>*>(req->data);
			w->_exec(w->_data);
		}

		static void execute_complete(uv_work_t *req, int status) {
			auto w = static_cast<AsyncWorker<T>*>(req->data);
			w->_complete(w->_data, v8::Isolate::GetCurrent());
			delete w;
		}

		uv_work_t req;
		T _data;
		std::function<void(T& data)> _exec;
		std::function<void(T& data, v8::Isolate* isolate)> _complete;
	};
}

#endif