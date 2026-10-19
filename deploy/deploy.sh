#!/bin/bash
# Deploys the newest pushed code to the live stack.
#
# Called from two places, which is why it's a script and not inline commands:
#   1. /opt/ping.git/hooks/post-receive  (automatic, after every push)
#   2. yourself:                         ssh root@155.133.27.51 '/opt/ping/deploy.sh'
#
# /opt/ping is a normal git clone whose `origin` is the bare repo
# /opt/ping.git. Pushes land in the bare repo (which never runs anything);
# this script drags the working copy up to date and rebuilds Docker.
# That fetch/reset step is what used to be forgotten and left the site
# running 10-day-old code.
set -euo pipefail

cd /opt/ping

# origin IS the bare repo this hook lives in, so 'fetch origin main' picks up
# exactly what was just pushed.
git fetch origin main

NEW=$(git rev-parse origin/main)   # what the push just delivered
CUR=$(git rev-parse HEAD)          # what is currently on disk here

if [ "$NEW" = "$CUR" ]; then
    echo "[deploy] already at $CUR - nothing to do"
    exit 0
fi

echo "[deploy] $CUR -> $NEW : resetting working tree"
git reset --hard "$NEW"

echo "[deploy] rebuilding containers"
docker compose up -d --build

echo "[deploy] done at $(date)"
