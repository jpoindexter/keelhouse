#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT/app"
OUT_DIR="$ROOT/docs/qa/app-shell"
LOG_FILE="${TMPDIR:-/tmp}/keelhouse-app-shell-qa.log"

if ! command -v playwright >/dev/null 2>&1; then
  echo "playwright CLI is required for app-shell QA screenshots" >&2
  exit 1
fi

port=4175
while curl --silent --fail "http://localhost:$port" >/dev/null 2>&1; do
  port=$((port + 1))
done

mkdir -p "$OUT_DIR"
cd "$APP_DIR"
npm run dev -- --host localhost --port "$port" --strictPort >"$LOG_FILE" 2>&1 &
server_pid=$!

cleanup() {
  kill "$server_pid" >/dev/null 2>&1 || true
  wait "$server_pid" >/dev/null 2>&1 || true
}
trap cleanup EXIT

for _ in $(seq 1 60); do
  if curl --silent --fail "http://localhost:$port" >/dev/null; then
    break
  fi
  if ! kill -0 "$server_pid" >/dev/null 2>&1; then
    cat "$LOG_FILE" >&2
    exit 1
  fi
  sleep 0.25
done

if ! curl --silent --fail "http://localhost:$port" >/dev/null; then
  cat "$LOG_FILE" >&2
  echo "Vite did not become ready for app-shell QA" >&2
  exit 1
fi

capture() {
  local name="$1"
  local viewport="$2"
  playwright screenshot \
    --browser chromium \
    --viewport-size "$viewport" \
    --wait-for-selector '.app-shell' \
    --wait-for-timeout 500 \
    "http://localhost:$port/?qa=1" \
    "$OUT_DIR/$name.png"
}

capture first-open-1440 1440,900
capture first-open-1024 1024,640
capture first-open-900 900,640

echo "Captured real app-shell QA screenshots in $OUT_DIR"
