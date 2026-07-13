# macOS Packaging

Build the local ad-hoc-signed app from `app/`:

```bash
npm run package:mac
open src-tauri/target/release/bundle/macos/Keelhouse.app
```

The script requires Homebrew Zig `0.15.2`. Zig 0.15.2's bundled libc++ fails against this machine's CLT 27 SDK because `INFINITY` is not declared during the optimized Ghostty build. `scripts/build-macos-app.sh` copies Zig's library into the ignored Cargo `target/` directory, patches that one expression to `numeric_limits<_RealT>::infinity()`, and sets `ZIG_LIB_DIR` only for this build. It then ad-hoc signs the complete app bundle and runs strict deep verification so `Info.plist` and icon resources are sealed. It never changes Homebrew, Xcode, `xcode-select`, or the installed Zig files.

Output: `app/src-tauri/target/release/bundle/macos/Keelhouse.app`. The local bundle is arm64 and ad-hoc signed. Distribution notarization and Developer ID signing are separate release work.

Verified 2026-07-13: the packaged app launched, restored the real workspace, spawned a shell, and launched the installed Codex CLI as a child process. The rebuilt bundle passes `codesign --verify --deep --strict`, and its ICNS hash matches `app/src-tauri/icons/icon.icns`.
