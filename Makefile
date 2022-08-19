
R_DIR    = ~
D_PORT  ?= 9210
PROJ     = shs
MAIN     = index.js
COPYS    = .cfg*.js public abi tools run *.sh *.service cc binding.gyp
DEPS     = deps deps/bclib/deps
TARGET   = dev prod proxy
VERSION  = $(shell node -e 'console.log(require("./package.json").version)')
PLATFORM ?= $(shell node -e 'console.log(process.platform)')
OPENVER  ?= v2

ifeq ($(PLATFORM),mac)
	PLATFORM := darwin
endif

-include deps/mktool/build.mk

.PHONY: sync

sync:
	git pull
	git submodule update --init --recursive