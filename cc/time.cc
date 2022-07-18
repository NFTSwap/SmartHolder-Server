/**
 * @copyright © 2018 Copyright dphone.com
 * @date 2019-12-16
 */

#include <time.h>
#include <stdlib.h>
#include <nan.h>

#if defined(__APPLE__)
#include <mach/mach_time.h>
#include <mach/mach.h>
#include <mach/clock.h>

#define clock_gettime clock_gettime2

static clock_serv_t get_clock_port(clock_id_t clock_id) {
	clock_serv_t clock_r;
	host_get_clock_service(mach_host_self(), clock_id, &clock_r);
	return clock_r;
}

static clock_serv_t clock_realtime = get_clock_port(CALENDAR_CLOCK);
static mach_port_t clock_monotonic = get_clock_port(SYSTEM_CLOCK);

int clock_gettime2(clockid_t id, struct timespec *tspec) {
	mach_timespec_t mts;
	int retval = 0;
	if (id == CLOCK_MONOTONIC) {
		retval = clock_get_time(clock_monotonic, &mts);
		if (retval != 0) {
			return retval;
		}
	} else if (id == CLOCK_REALTIME) {
		retval = clock_get_time(clock_realtime, &mts);
		if (retval != 0) {
			return retval;
		}
	} else {
		/* only CLOCK_MONOTOIC and CLOCK_REALTIME clocks supported */
		return -1;
	}
	tspec->tv_sec = mts.tv_sec;
	tspec->tv_nsec = mts.tv_nsec;
	return 0;
}

#elif _MSC_VER

#include <winternl.h>

#define MS_PER_SEC      1000ULL     // MS = milliseconds
#define US_PER_MS       1000ULL     // US = microseconds
#define HNS_PER_US      10ULL       // HNS = hundred-nanoseconds (e.g., 1 hns = 100 ns)
#define NS_PER_US       1000ULL

#define HNS_PER_SEC     (MS_PER_SEC * US_PER_MS * HNS_PER_US)
#define NS_PER_HNS      (100ULL)    // NS = nanoseconds
#define NS_PER_SEC      (MS_PER_SEC * US_PER_MS * NS_PER_US)

#define CLOCK_MONOTONIC 1
#define CLOCK_REALTIME 2

typedef int clockid_t;

int clock_gettime_monotonic(struct timespec *tv)
{
	static LARGE_INTEGER ticksPerSec;
	LARGE_INTEGER ticks;
	double seconds;

	if (!ticksPerSec.QuadPart) {
		QueryPerformanceFrequency(&ticksPerSec);
		if (!ticksPerSec.QuadPart) {
			errno = ENOTSUP;
			return -1;
		}
	}

	QueryPerformanceCounter(&ticks);

	seconds = (double) ticks.QuadPart / (double) ticksPerSec.QuadPart;
	tv->tv_sec = (time_t)seconds;
	tv->tv_nsec = (long)((ULONGLONG)(seconds * NS_PER_SEC) % NS_PER_SEC);

	return 0;
}

int clock_gettime_realtime(struct timespec *tv)
{
	FILETIME ft;
	ULARGE_INTEGER hnsTime;

	GetSystemTimeAsFileTime(&ft);

	hnsTime.LowPart = ft.dwLowDateTime;
	hnsTime.HighPart = ft.dwHighDateTime;

	// To get POSIX Epoch as baseline, subtract the number of hns intervals from Jan 1, 1601 to Jan 1, 1970.
	hnsTime.QuadPart -= (11644473600ULL * HNS_PER_SEC);

	// modulus by hns intervals per second first, then convert to ns, as not to lose resolution
	tv->tv_nsec = (long) ((hnsTime.QuadPart % HNS_PER_SEC) * NS_PER_HNS);
	tv->tv_sec = (long) (hnsTime.QuadPart / HNS_PER_SEC);

	return 0;
}

int clock_gettime(clockid_t type, struct timespec *tp)
{
	if (type == CLOCK_MONOTONIC)
	{
		return clock_gettime_monotonic(tp);
	}
	else if (type == CLOCK_REALTIME)
	{
		return clock_gettime_realtime(tp);
	}

	errno = ENOTSUP;
	return -1;
}

#endif

namespace hc {

	int64_t time_monotonic() {
		struct timespec now;
		clock_gettime(CLOCK_MONOTONIC, &now);
		int64_t r = now.tv_sec * 1000000LL + now.tv_nsec / 1000LL;
		return r;
	}

	NAN_METHOD(timeMonotonic) {
		info.GetReturnValue().Set( Nan::New<v8::Number>(time_monotonic() / 1000) );
	}

	void Init_time(v8::Local<v8::Object> target) {
		Nan::SetMethod(target, "timeMonotonic", timeMonotonic);
	}

}