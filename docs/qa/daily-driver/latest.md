# Daily Driver Metrics

Generated: 2026-07-13T18:40:09.365Z
Commit: 28a17fc+dirty
Status: implementation-ready-for-live-runs

## Scenarios

### One project: talk, edit, preview

Goal: A single project can keep the agent conversation primary while exposing editor save and browser preview surfaces.
Status: implementation-ready (7/7)

- PASS structured agent conversation surface — app/src/App.tsx
- PASS real editor save path — app/src/App.tsx
- PASS composer routes prompts with context — app/src/composerHarness.ts
- PASS terminal-output dev-server detection — app/src/browserPreview.ts
- PASS actual app shell at 1440x900 — docs/qa/app-shell/first-open-1440.png
- PASS actual app shell at 900x640 — docs/qa/app-shell/first-open-900.png
- PASS native Tauri run with live pty output — docs/qa/app-shell/native-run.png

### Two structured chats: same project

Goal: One project can own multiple independent provider-backed chats with separate messages, run state, cancellation, and persisted provider identity.
Status: implementation-ready (7/7)

- PASS chat records are keyed independently — app/src/chatConversation.ts
- PASS provider identity persists per chat — app/src/chatConversation.ts
- PASS backend owns multiple live runs by id — app/src-tauri/src/chat_harness.rs
- PASS each chat run owns an isolated process group — app/src-tauri/src/chat_harness.rs
- PASS structured messages render separately from raw terminal — app/src/ChatThreadSurface.tsx
- PASS executed packaged multi-chat record — docs/qa/daily-driver/codex-multi-chat.md
- PASS packaged multi-chat screenshot — docs/qa/daily-driver/codex-multi-chat-native.png

### Three projects: switch and relaunch

Goal: The project rail can replace separate VS Code windows by preserving projects, sessions, editor state, panes, and preview URLs.
Status: implementation-ready (6/6)

- PASS open project rail persistence — app/src/workspaceState.ts
- PASS project sessions persistence — app/src/workspaceState.ts
- PASS editor session restore — app/src/sessionRestore.ts
- PASS browser preview persists by session — app/src/App.tsx
- PASS project rail doc — docs/project-rail.md
- PASS session restore doc — docs/session-restore.md

## Next Manual Runs

- Time one-project edit + agent + detected preview without opening VS Code.
- Repeat two-chat same-project latency capture with exact send/switch/stop timestamps.
- Time three-project switch/relaunch run with restored sessions and previews.
- Run a real Gemini prompt/response in Raw terminal after accepting the project trust prompt.

