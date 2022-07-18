#!/bib/sh

set -e
base=$(dirname "$0")
cd "$base"

export RUN_DAEMON=1
export RUN_TARGET=watch
export RUN_WORKERS=8

node ./index.js