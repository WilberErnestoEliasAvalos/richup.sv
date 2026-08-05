#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_BIN="$ROOT_DIR/.tooling/nodejs/bin/node"
NPM_BIN="$ROOT_DIR/.tooling/nodejs/bin/npm"

if [[ ! -x "$NODE_BIN" || ! -x "$NPM_BIN" ]]; then
  echo "Node local no encontrado en .tooling/nodejs. Ejecuta primero la instalación." >&2
  exit 1
fi

"$NPM_BIN" --prefix "$ROOT_DIR/server" run dev &
SERVER_PID=$!

"$NPM_BIN" --prefix "$ROOT_DIR/client" run dev &
CLIENT_PID=$!

cleanup() {
  kill "$SERVER_PID" "$CLIENT_PID" 2>/dev/null || true
}

trap cleanup EXIT INT TERM
wait