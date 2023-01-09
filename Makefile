
R_DIR    = ~
D_PORT  ?= 9210
PROJ     = shs
MAIN     = index.js
COPYS    = .cfg*.js public abi tools run *.service
COPYS    += deps/SmartHolder/deployInfo.json
DEPS     = deps deps/bclib/deps
TARGET   = dev prod proxy

-include deps/mktool/build.mk

.PHONY: sync

sync:
	git pull
	git submodule update --init --recursive