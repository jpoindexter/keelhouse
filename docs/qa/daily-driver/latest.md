# Daily Driver Metrics

Generated: 2026-07-12T21:56:25.418Z
Commit: f1e5b1e+dirty
Status: implementation-ready-for-live-runs

## Scenarios

### One project: talk, edit, preview

Goal: A single project can keep the agent conversation primary while exposing editor save and browser preview surfaces.
Status: implementation-ready (7/7)

- PASS agent-first conversation label — app/src/App.tsx
- PASS real editor save path — app/src/App.tsx
- PASS composer routes prompts with context — app/src/composerHarness.ts
- PASS terminal-output dev-server detection — app/src/browserPreview.ts
- PASS actual app shell at 1440x900 — docs/qa/app-shell/first-open-1440.png
- PASS actual app shell at 900x640 — docs/qa/app-shell/first-open-900.png
- PASS native Tauri run with live pty output — docs/qa/app-shell/native-run.png

### Two agents: same project

Goal: One project can own multiple real agent panes with focus, labels, lifecycle, and persisted layout.
Status: implementation-ready (6/6)

- PASS backend can create another pane — app/src-tauri/src/lib.rs
- PASS backend can focus a pane — app/src-tauri/src/lib.rs
- PASS backend can close a pane — app/src-tauri/src/lib.rs
- PASS frontend scopes panes by project — app/src/App.tsx
- PASS pane layout persists by session — app/src/App.tsx
- PASS pane manager contract doc — docs/pane-manager.md

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
- Time two-agent same-project run with pane focus/restart/close.
- Time three-project switch/relaunch run with restored sessions and previews.

