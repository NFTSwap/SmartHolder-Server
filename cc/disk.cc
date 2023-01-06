
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#include <stdint.h>

#if __APPLE__
# include <sys/param.h>
# include <sys/mount.h>
#elif __linux__
# include <sys/statfs.h>
# include <sys/vfs.h>
#endif

#include "./errno.h"
#include "./utils.h"

namespace hc {

	// short   f_otype;    /* type of file system (reserved: zero) */
	// short   f_oflags;   /* copy of mount flags (reserved: zero) */
	// long    f_bsize;    /* fundamental file system block size */ //每块包含字节大小 f_bsize
	// long    f_iosize;   /* optimal transfer block size */
	// long    f_blocks;   /* total data blocks in file system */ //磁盘总空间 total
	// long    f_bfree;    /* free blocks in fs */ //磁盘所有剩余空间 free
	// long    f_bavail;   /* free blocks avail to non-superuser */ //非超级用户可用空间 avail
	// long    f_files;    /* total file nodes in file system */
	// long    f_ffree;    /* free file nodes in fs */
	// fsid_t  f_fsid;     /* file system id */
	// uid_t   f_owner;    /* user that mounted the file system */
	// short   f_reserved1;        /* reserved for future use */
	// short   f_type;     /* type of file system (reserved) */
	// long    f_flags;    /* copy of mount flags (reserved) */
	// long    f_reserved2[2];     /* reserved for future use */
	// char    f_fstypename[MFSNAMELEN]; /* fs type name */
	// char    f_mntonname[MNAMELEN];    /* directory on which mounted */
	// char    f_mntfromname[MNAMELEN];  /* mounted file system */
	// char    f_reserved3;        /* reserved for future use */
	// long    f_reserved4[4];     /* reserved for future use */

	typedef struct statfs DISK;

	NAN_METHOD(diskInfo) {
		JS_Assert(info.Length() > 0 && info[0]->IsString(), ERR_JS_ARGS_ERROR);

#if _MSC_VER
		auto obj = Nan::New<v8::Object>();

		Nan::Set(obj, Nan::New("f_bsize").ToLocalChecked(), Nan::New(0));
		Nan::Set(obj, Nan::New("f_blocks").ToLocalChecked(), Nan::New(0));
		Nan::Set(obj, Nan::New("f_bfree").ToLocalChecked(), Nan::New(0));
		Nan::Set(obj, Nan::New("f_bavail").ToLocalChecked(), Nan::New(0));
#else
		DISK disk;
		memset(&disk, 0, sizeof(DISK));
		int flag = statfs(*Nan::Utf8String(info[0]), &disk);
		if (flag != 0) {
			// perror("getDiskInfo statfs fail");
			return info.GetReturnValue().Set(Nan::Null());
		}

		auto obj = Nan::New<v8::Object>();

		Nan::Set(obj, Nan::New("f_bsize").ToLocalChecked(), Nan::New((uint32_t)disk.f_bsize));
		Nan::Set(obj, Nan::New("f_blocks").ToLocalChecked(), Nan::New((uint32_t)disk.f_blocks));
		Nan::Set(obj, Nan::New("f_bfree").ToLocalChecked(), Nan::New((uint32_t)disk.f_bfree));
		Nan::Set(obj, Nan::New("f_bavail").ToLocalChecked(), Nan::New((uint32_t)disk.f_bavail));

#endif
		info.GetReturnValue().Set( obj );
	}

	void Init_disk(v8::Local<v8::Object> target) {
		Nan::SetMethod(target, "diskInfo", diskInfo);
	}
}