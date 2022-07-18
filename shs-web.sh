#!/bib/sh

set -e
base=$(dirname "$0")
cd "$base"

export RUN_DAEMON=1
export RUN_TARGET=web
export RUN_WORKERS=4

node ./index.js