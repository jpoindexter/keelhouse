# Chat Composer Context

Composer state is owned by the selected project/chat key. Draft text and the bounded 20-entry recall history flush before project or chat navigation, then restore when that chat becomes active again.

## Context Sources

- `@file` searches loaded workspace files and attaches the selected path.
- File picker and current-file actions attach workspace-readable text files.
- Paste, drag/drop, and the image picker attach supported local images; external images are copied into the app cache.
- Context chips are removable and **Review context** shows the exact prompt and image inputs prepared for Codex.

## Safety Boundary

Rust preflight canonicalizes workspace files and rejects outside paths, sensitive filenames, binary/invalid UTF-8 content, and oversized files before transmission. Image preflight accepts only supported image formats within the byte cap. Tauri asset access is restricted to cached chat images.

## Verification

- Executed: packaged chat switching kept `DRAFT-ISOLATION-PASS` in one chat, showed a blank neighboring chat, and restored the draft on return.
- Executed: 197 frontend tests, 59 Rust tests, production build, package build, and chrome contract.
- Code path only: exact file/image payload construction reaches the native Codex request.

The roadmap card remains open until packaged file-context and image sends confirm provider receipt end to end.
