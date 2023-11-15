#!/bin/env node
# erigon start config

# mainnet
/home/blue/Install/erigon_2.53.4_linux_amd64/erigon --datadir=/data/erigon/mainnet --chain=mainnet --verbosity=5 --internalcl 
# goerli
/home/blue/Install/erigon_2.53.4_linux_amd64/erigon --datadir=/data/erigon/goerli --chain=goerli --verbosity=5
/home/blue/Install/erigon_2.53.4_linux_amd64/erigon \
--datadir=/data/erigon/goerli --chain=goerli --private.api.addr=127.0.0.1:9190 --http.port=8645 --torrent.port=42169 \
--authrpc.port=8651 --verbosity=5 --internalcl --lightclient.discovery.addr=0.0.0.0
# ./build/bin/erigon --datadir="<your_mainnet_data_path>" --chain=mainnet --port=30303 --http.port=8545 --torrent.port=42069 --private.api.addr=127.0.0.1:9090 \
# --http --ws --http.api=eth,debug,net,trace,web3,erigon

# ploygon bor
/home/blue/Install/erigon_2.53.4_linux_amd64/erigon \
--datadir=/data/ploygon/erigon --chain=bor-mainnet --private.api.addr=127.0.0.1:9290 --http.port=8745 --torrent.port=42269 \
--authrpc.port=8751 --snapshots=true --verbosity=5 --p2p.allowed-ports="30307,30308,30309,30310"

# polygon heimdall run
# seeds="1500161dd491b67fb1ac81868952be49e2509c9f@52.78.36.216:26656,dd4a3f1750af5765266231b9d8ac764599921736@3.36.224.80:26656,8ea4f592ad6cc38d7532aff418d1fb97052463af@34.240.245.39:26656,e772e1fb8c3492a9570a377a5eafdb1dc53cd778@54.194.245.5:26656,6726b826df45ac8e9afb4bdb2469c7771bd797f1@52.209.21.164:26656"
# seeds="f4f605d60b8ffaaf15240564e58a81103510631c@159.203.9.164:26656,4fb1bc820088764a564d4f66bba1963d47d82329@44.232.55.71:26656,2eadba4be3ce47ac8db0a3538cb923b57b41c927@35.199.4.13:26656,3b23b20017a6f348d329c102ddc0088f0a10a444@35.221.13.28:26656,25f5f65a09c56e9f1d2d90618aa70cd358aa68da@35.230.116.151:26656"
heimdalld start --home=/data/ploygon/heimdall --chain=mainnet --rest-server

# install heimdall
curl -L https://raw.githubusercontent.com/maticnetwork/install/main/heimdall.sh | bash -s -- v0.3.4 mainnet sentry
# sudo dpkg -r heimdalld
# echo "Installing $package ..."
# sudo dpkg -i $package
# if [ ! -z "$profilePackage" ] && sudo [ ! -d /var/lib/heimdall/config ]; then
# 		sudo dpkg -i $profilePackage
# fi

# download ploygon
nohup curl -L https://snapshot-download.polygon.technology/snapdown.sh | bash -s -- --network mainnet --client heimdall --extract-dir heimdall-snapshow --validate-checksum true > /dev/null 2>&1 &
nohup curl -L https://snapshot-download.polygon.technology/snapdown.sh | bash -s -- --network mainnet --client erigon --extract-dir erigon-snapshow --validate-checksum true >/dev/null 2>&1 &