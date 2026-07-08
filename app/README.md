# Keelhouse App

This is the runnable Tauri 2 + React/TypeScript app for Keelhouse, the lean macOS workbench for real Claude/Codex CLI agent panes plus a file rail, editor, and browser preview.

## Development

```bash
npm install
PATH="/opt/homebrew/opt/zig@0.15/bin:$PATH" npm run tauri dev
```

## Verification

```bash
npm run build
npm test
cd src-tauri && PATH="/opt/homebrew/opt/zig@0.15/bin:$PATH" cargo test
```

Keep Zig pinned to `0.15.2` for Ghostty-related Rust builds.
