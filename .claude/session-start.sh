#!/usr/bin/env bash
# Makes a fresh checkout runnable: dependencies present and a database to read.
# Safe to re-run — every step is a no-op once it has been done.
set -uo pipefail
cd "$(dirname "$0")/.."

if [ ! -d node_modules ]; then
  echo "installing dependencies…"
  npm install --no-audit --no-fund >/dev/null 2>&1 || { echo "npm install failed"; exit 0; }
fi

if [ ! -f data/monitiez.db ]; then
  echo "seeding the sample database…"
  npm run seed --silent -- --fresh 2>&1 | tail -1
fi

echo "ready — npm run dev serves the API on :8787 and the app on :5173"
