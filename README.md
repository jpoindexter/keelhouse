# Keelhouse

Keelhouse is a lean native macOS workbench for real CLI coding agents. It keeps the VS Code parts Jason actually uses: project/session rail, file explorer, robust editor, browser preview, and real Claude/Codex terminal panes. It drops extension/plugin bloat, debugger/IDE sprawl, and account/chat chrome.

The repo/package slug remains `agent-cli` for now; **Keelhouse** is the locked product name.

## Product Positioning

Keelhouse is the stable structure around heavy agent work: projects, files, terminal panes, browser context, sessions, and review surfaces stay aligned while real CLI agents do the work. It is intentionally not named after "AI", "chat", or "terminal" because the product is the whole workbench, not one pane.

Read the short product language guide in `docs/product-positioning.md`.

## Status

Direction is locked: build our own app using open-source components, not a fork of cmux, Superconductor, hashmark, or zellij. The terminal foundation is verified: real pty -> `libghostty-vt` in Rust -> Tauri IPC -> Canvas 2D, with keyboard, paste, selection/copy, scrollback, folder picker, persisted workspace, agent launch, file rail, watcher, recent projects, and basic CodeMirror editing already working.

Current active slice: see `STATE.md`. The roadmap source is `roadmap.json`, rendered to `roadmap.html`; `ROADMAP.md` is the readable companion.

## Product Shape

- Project/session rail for multiple workspaces and task contexts.
- Dense file explorer with ignores, watching, and git-aware state.
- CodeMirror editor with VS Code-style shortcuts, tabs, dirty state, find/replace, file operations, and file safety.
- Ghostty-backed terminal panes running real `claude`, `codex`, or shell processes.
- Lightweight browser preview for localhost apps, docs, auth flows, and generated pages.
- Codex-quality chrome: icons, activity rows, permission-aware composer, settings, and source-control surfaces.

Keelhouse is not a VS Code clone, generic terminal emulator, general browser, plugin marketplace, or custom chat UI.

## Run Locally

```bash
cd app
npm install
PATH="/opt/homebrew/opt/zig@0.15/bin:$PATH" npm run tauri dev
```

Useful checks:

```bash
cd app && npm run build
cd app && npm test
cd app/src-tauri && PATH="/opt/homebrew/opt/zig@0.15/bin:$PATH" cargo test
```

Zig must stay pinned to `0.15.2`; Homebrew's default `0.16` breaks the Ghostty bridge build.

## Repository Map

| Path | Purpose |
|---|---|
| `app/` | Tauri 2 + React/TypeScript app, including terminal, rail, editor, and local state |
| `app/src-tauri/` | Rust backend for pty/process/workspace/file commands |
| `PRD.md` / `ROADMAP.md` / `STATE.md` | Product scope, sequence, and current handoff |
| `ARCHITECTURE.md` / `DECISIONS.md` | Stack, terminal data flow, and append-only decisions |
| `docs/` | Local state, parity research, audits, and implementation notes |
| `roadmap.json` / `roadmap.html` | Rockmap source and generated roadmap board |
| `spike-ghostty-vt/` | Verified Ghostty parser spike |
| `ghostty/`, `zellij/`, `resources/` | Reference configs and parked research |

## Documentation Map

| Document | Use |
|---|---|
| `docs/README.md` | Documentation index and product naming note |
| `PRD.md` | Product requirements and scope boundaries |
| `ROADMAP.md` | Human-readable roadmap and execution discipline |
| `STATE.md` | Current handoff, verified slices, next step |
| `DECISIONS.md` | Append-only decision log |
| `docs/product-positioning.md` | Name, one-liner, language rules |
| `docs/*-parity.md` / `docs/*-scope.md` | Focused research and parity criteria |

Rebuild the roadmap board after editing `roadmap.json`:

```bash
node rockmap/build-roadmap.mjs roadmap.json roadmap.html
```
