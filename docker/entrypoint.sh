#!/bin/sh
# mint-app entrypoint: starts as root only to fix data ownership, then runs the
# app as the unprivileged node user. Docker creates a missing bind-mounted
# ./data/app as root, which node could not write to.
set -e

mkdir -p /app/data/wallet /app/data/jwt
chown -R node:node /app/data

exec setpriv --reuid=node --regid=node --init-groups -- "$@"
