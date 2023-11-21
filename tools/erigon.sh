#!/bin/env node
# Erigon

# mainnet
/home/blue/Install/erigon_2.53.4_linux_amd64/erigon --datadir=/data/erigon/mainnet --chain=mainnet --verbosity=5 --internalcl 
# goerli
/home/blue/Install/erigon_2.53.4_linux_amd64/erigon --datadir=/data/erigon/goerli --chain=goerli --verbosity=5
/home/blue/Install/erigon_2.53.4_linux_amd64/erigon \
--datadir=/data/erigon/goerli --chain=goerli --private.api.addr=127.0.0.1:9190 --http.port=8645 --torrent.port=42169 \
--authrpc.port=8651 --verbosity=5 --internalcl --lightclient.discovery.addr=0.0.0.0
# ./build/bin/erigon --datadir="<your_mainnet_data_path>" --chain=mainnet --port=30303 --http.port=8545 --torrent.port=42069 --private.api.addr=127.0.0.1:9090 \
# --http --ws --http.api=eth,debug,net,trace,web3,erigon

# polygon bor
/home/blue/Install/erigon_2.53.4_linux_amd64/erigon \
--datadir=/data/polygon/erigon --chain=bor-mainnet --private.api.addr=127.0.0.1:9290 --http.port=8745 --torrent.port=42269 \
--authrpc.port=8751 --snapshots=false --verbosity=5 --p2p.allowed-ports="30307,30308,30309,30310"

/home/blue/Install/erigon_2.53.4_linux_amd64/erigon \
--datadir=/data/polygon/erigon --chain=bor-mainnet --ethash.dagdir=/data/polygon/ethash --snapshots=false \
--bor.heimdall=http://127.0.0.1:1317 --http --http.addr=0.0.0.0 --port=30307 --http.port=8745 --authrpc.port=8751 \
--torrent.port=43068 --private.api.addr=127.0.0.1:9290 --http.compression --http.vhosts=* --http.corsdomain=* \
--http.api=eth,debug,net,trace,web3,erigon,bor --ws --ws.compression --rpc.gascap=300000000 --verbosity=5 --p2p.allowed-ports="30307,30308,30309,30310"

# Polygon

# polygon heimdall
# /var/lib/heimdall/config/config.toml
# seeds="1500161dd491b67fb1ac81868952be49e2509c9f@52.78.36.216:26656,dd4a3f1750af5765266231b9d8ac764599921736@3.36.224.80:26656,8ea4f592ad6cc38d7532aff418d1fb97052463af@34.240.245.39:26656,e772e1fb8c3492a9570a377a5eafdb1dc53cd778@54.194.245.5:26656,6726b826df45ac8e9afb4bdb2469c7771bd797f1@52.209.21.164:26656"
heimdalld init --home=/data/polygon/heimdall --chain=mainnet
heimdalld start --home=/data/polygon/heimdall --chain=mainnet --rest-server
# polygon bor
# bootnodes = ["enode://bdcd4786a616a853b8a041f53496d853c68d99d54ff305615cd91c03cd56895e0a7f6e9f35dbf89131044e2114a9a782b792b5661e3aff07faf125a98606a071@43.200.206.40:30303", "enode://209aaf7ed549cf4a5700fd833da25413f80a1248bd3aa7fe2a87203e3f7b236dd729579e5c8df61c97bf508281bae4969d6de76a7393bcbd04a0af70270333b3@54.216.248.9:30303"]|g' /var/lib/bor/config.toml
# port=8845 p2p=30323
bor server -config /data/polygon/bor/config.toml

# install heimdall
curl -L https://raw.githubusercontent.com/maticnetwork/install/main/heimdall.sh | bash -s -- v1.0.3 mainnet sentry
# install bor
curl -L https://raw.githubusercontent.com/maticnetwork/install/main/bor.sh | bash -s -- v1.1.0 mainnet sentry

# download heimdall snapshow
nohup curl -L https://snapshot-download.polygon.technology/snapdown.sh | bash -s -- --network mainnet --client heimdall --extract-dir heimdall-snapshow --validate-checksum true > /dev/null 2>&1 &
# download bor erigon snapshow
nohup curl -L https://snapshot-download.polygon.technology/snapdown.sh | bash -s -- --network mainnet --client erigon --extract-dir erigon-snapshow --validate-checksum true >/dev/null 2>&1 &
