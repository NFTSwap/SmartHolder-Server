#!/bin/env node
# erigon start config

# mainnet
/home/blue/Install/erigon_2.53.4_linux_amd64/erigon --datadir=/data/erigon/mainnet --chain=mainnet
# goerli
/home/blue/Install/erigon_2.53.4_linux_amd64/erigon \
--datadir=/data/erigon/goerli --chain=goerli --private.api.addr=127.0.0.1:9190 --http.port=8645 --torrent.port=42169  --authrpc.port=8651
# polygon bor
/home/blue/Install/erigon_2.53.4_linux_amd64/erigon \
--datadir=/data/erigon/bor --chain=bor-mainnet --private.api.addr=127.0.0.1:9290 --http.port=8745 --torrent.port=42269  --authrpc.port=8751


# download ploygon
nohup curl -L https://snapshot-download.polygon.technology/snapdown.sh | bash -s -- --network mainnet --client heimdall --extract-dir heimdall --validate-checksum true > /dev/null 2>&1 &
nohup curl -L https://snapshot-download.polygon.technology/snapdown.sh | bash -s -- --network mainnet --client erigon --extract-dir erigon --validate-checksum true >/dev/null 2>&1 &