#!/bin/env node
# erigon start config

# mainnet
/home/blue/Install/erigon_2.53.4_linux_amd64/erigon --datadir=/data/erigon/mainnet --chain=mainnet
# goerli
/home/blue/Install/erigon_2.53.4_linux_amd64/erigon \
--datadir=/data/erigon/goerli --chain=goerli --private.api.addr=127.0.0.1:9190 --http.port=8645 --torrent.port=42169  --authrpc.port=8651
