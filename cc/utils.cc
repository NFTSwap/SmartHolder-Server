/**
 * @copyright © 2021 Copyright dphone.com
 * @date 2021-07-12
 */

#include "./utils.h"
#include "./errno.h"
#include <stdarg.h>
#include <string.h>
#include <stdio.h>

#undef errno

namespace hc {

	v8::Local<v8::Value> NewError(int err_no, const char* msg, va_list arg) {
		v8::Local<v8::Value> err;
		char* str = nullptr;
#if _MSC_VER
		// int len = ::_vscprintf(msg, arg);
		str = (char*)::malloc(1024+1);
		int len = ::_vsnprintf_s(str, 1024+1, 1024, msg, arg);
		str[len] = '\0';
#else
		if (msg) {
			::vasprintf(&str, msg, arg);
		}
#endif
		if (!str) {
			char str[32];
			::sprintf(str, "Err, Errno=%d", err_no);
			err = Nan::Error(str);
		} else {
			err = Nan::Error(str);
			::free(str);
		}
		Nan::Set(*reinterpret_cast<v8::Local<v8::Object>*>(&err), Nan::New("errno").ToLocalChecked(), Nan::New(err_no));
		return err;
	}

	#define NEW_Err(err_no, msg) \
		va_list arg; \
		va_start(arg, msg); \
		auto err = NewError(err_no, msg, arg); \
		va_end(arg) \

	v8::Local<v8::Value> Error(int err_no, const char* msg, ...) {
		NEW_Err(err_no, msg);
		return err;
	}

	void ThrowError(int err_no, const char* msg, ...) {
		NEW_Err(err_no, msg);
		Nan::ThrowError(err);
	}

	v8::Local<v8::Value> Error(const char* msg, ...) {
		NEW_Err(ERR_UNKNOWN_ERROR, msg);
		return err;
	}

	void ThrowError(const char* msg, ...) {
		NEW_Err(ERR_UNKNOWN_ERROR, msg);
		Nan::ThrowError(err);
	}

}