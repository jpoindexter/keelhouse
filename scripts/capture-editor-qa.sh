#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURE="$ROOT/docs/qa/editor-parity.html"
OUT_DIR="$ROOT/docs/qa/editor-parity"
DIRTY_OUT_DIR="$ROOT/docs/qa/dirty-draft-protection"

if ! command -v playwright >/dev/null 2>&1; then
  echo "playwright CLI is required for editor QA screenshots" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
mkdir -p "$DIRTY_OUT_DIR"

capture() {
  local state="$1"
  local viewport="$2"
  local file="${3:-$OUT_DIR/${state}.png}"
  playwright screenshot \
    --browser chromium \
    --channel chrome \
    --viewport-size "$viewport" \
    --wait-for-selector '[data-qa="editor-parity-shell"]' \
    --wait-for-timeout 250 \
    "file://$FIXTURE?state=$state" \
    "$file"
}

capture selected 1440,900
capture dirty 1440,900
capture context-menu 1440,900
capture save-error 1440,900
capture save-conflict 1440,900
capture find-replace 1440,900
capture missing 1440,900
capture no-file 1440,900
capture narrow 1024,640
capture dirty-modal 1440,900 "$DIRTY_OUT_DIR/modal.png"

echo "Captured editor QA screenshots in $OUT_DIR"
echo "Captured dirty draft QA screenshots in $DIRTY_OUT_DIR"
