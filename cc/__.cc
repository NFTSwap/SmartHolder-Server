/**
 * @copyright © 2018 Copyright dphone.com
 * @date 2019-12-16
 */

#include <nan.h>

namespace hc {

	// ------------modules list-------------

	#define MODULES(FN) \
		FN(time) \
		FN(disk) \

	// -------------------------------------

	static v8::Local<v8::Object> New(const char* name, v8::Local<v8::Object> target) {
		auto out = Nan::New<v8::Object>();
		Nan::Set(target, Nan::New(name).ToLocalChecked(), out);
		return out;
	}

	#define INIT_DEF(name) void Init_##name(v8::Local<v8::Object> target);
	#define INIT_CALL(name) Init_##name(New(#name, target));

	MODULES(INIT_DEF)

	void InitAll(v8::Local<v8::Object> target, v8::Local<v8::Value> unused, void* priv) {
		MODULES(INIT_CALL)
	}

	NODE_MODULE(hw, InitAll);
}