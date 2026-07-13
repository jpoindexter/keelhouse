#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT/app"
TARGET_DIR="${CARGO_TARGET_DIR:-$APP_DIR/src-tauri/target}"

if ! command -v zig >/dev/null 2>&1; then
  echo "Zig 0.15.2 is required. Add it to PATH before packaging." >&2
  exit 1
fi

zig_version="$(zig version)"
if [[ "$zig_version" != "0.15.2" ]]; then
  echo "Keelhouse packaging requires Zig 0.15.2; found $zig_version." >&2
  exit 1
fi

zig_lib="$(zig env | sed -n 's/.*\.lib_dir = "\([^"]*\)".*/\1/p')"
if [[ -z "$zig_lib" || ! -d "$zig_lib" ]]; then
  echo "Could not locate Zig's bundled library directory." >&2
  exit 1
fi

patched_lib="$TARGET_DIR/zig-lib-$zig_version-keelhouse"
patched_header="$patched_lib/libcxx/include/__random/clamp_to_integral.h"
patch_marker="$patched_lib/.keelhouse-infinity-patch"

if [[ ! -f "$patch_marker" ]]; then
  mkdir -p "$patched_lib"
  cp -R "$zig_lib/." "$patched_lib/"
  perl -0pi -e 's/INFINITY\)\)/numeric_limits<_RealT>::infinity\(\)\)\)/' "$patched_header"
  if grep -q 'INFINITY))' "$patched_header"; then
    echo "Failed to patch Zig libc++ in the scoped build copy." >&2
    exit 1
  fi
  printf '%s\n' "Zig $zig_version libc++ INFINITY compatibility patch" > "$patch_marker"
fi

cd "$APP_DIR"
ZIG_LIB_DIR="$patched_lib" npx tauri build --bundles app "$@"

app_bundle="$TARGET_DIR/release/bundle/macos/Keelhouse.app"
if [[ ! -d "$app_bundle" ]]; then
  echo "Tauri completed without producing $app_bundle." >&2
  exit 1
fi

# Tauri's local bundle can retain only the Mach-O linker signature. Seal the
# complete app so Info.plist and icon resources are covered by the ad-hoc build.
codesign --force --deep --sign - "$app_bundle"
codesign --verify --deep --strict "$app_bundle"
