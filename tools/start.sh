#!/bin/sh

set -e

base=$(dirname "$0")

cd "$base"

openethereum="./openethereum"

$openethereum \
--config=config.toml \
--chain=chain.json \
--log-file=console.log \
--db-path=. \
--base-path=. \
--bootnodes="enode://8a6fca700a012fc88f73bc3c8222573771336caa5fd5da37d39fb274d23f46d106aa3ffb75e6da756b3224d72899638d6214125bc167799a0bb89d74a6e7a30b@117.50.36.53:6666"

# --no-discovery \
# --ipc-path=rpc.ipc \
# --password=pwd \
# --unlock="0x8bb0741d6f1ebe4cbc8268a7c24a007e114c221f" \
# --author="0x8bb0741d6f1ebe4cbc8268a7c24a007e114c221f" \

# ExecStart=/usr/local/openethereum/openethereum 
# --jsonrpc-interface 0.0.0.0  
# --base-path /data/openethereum/chain_data 
# --chain /usr/local/openethereum/hardchain.json 
# --config /usr/local/openethereum/hardchain.toml 
# --reseal-max-period 60000000 
# --log-file=/data/openethereum/openethereum.log  
# --unlock 0x90f15922028b0fa3c5ea37b6351e5cd4fb8f9957 
# --password /usr/local/openethereum/password.txt --jsonrpc-cors all