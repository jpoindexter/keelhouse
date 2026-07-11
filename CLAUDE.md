# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Keelhouse** — a native macOS agent cockpit (Tauri 2 + React/TS frontend, Rust backend) that replaces Jason's VS Code workflow with an agent-first cockpit: project/session drawer, a readable terminal-backed Run surface for real `claude`/`codex`/`gemini` CLI panes, and a composer as the main surface. Raw terminal, CodeMirror editor, and browser preview are fast, switchable/resizable trays around that core loop — not the default screen.

The repo/package/binary slug stays `agent-cli`; **Keelhouse** is the locked product name used in user-facing docs and app metadata. Don't rename the slug without a DECISIONS.md entry.

Read `PRD.md`, `ROADMAP.md`, `STATE.md`, `DECISIONS.md`, `PARKED.md`, `ERRORS.md` at session start — they are the source of truth over this file. `STATE.md` is the current handoff/next-card pointer; `docs/README.md` indexes deeper topic notes (parity research, chrome polish, harness contracts, etc).

## Commands

All app commands run from `app/`.

```bash
cd app && npm install
cd app && npm run dev              # Vite dev server, frontend only
PATH="/opt/homebrew/opt/zig@0.15/bin:$PATH" npm run tauri dev   # full Tauri app (pty + real agent CLIs)
cd app && npm run build            # tsc typecheck + vite build — minimum verification for any touched frontend code
cd app && npm test                 # vitest run — full suite
cd app && npx vitest run src/foo.test.ts        # single test file
cd app && npx vitest run -t "test name"         # single test by name
cd app/src-tauri && PATH="/opt/homebrew/opt/zig@0.15/bin:$PATH" cargo test    # Rust backend tests
cd app/src-tauri && cargo fmt --check
```

QA/screenshot scripts (run from `app/`, back them with a real `npm run tauri dev`/build first where noted):

```bash
npm run qa:shell            # scripts/capture-app-shell-qa.sh — real React shell screenshots at 1440/1024/900
npm run qa:editor           # scripts/capture-editor-qa.sh — editor-parity screenshot fixtures into docs/qa/editor-parity/
npm run qa:chrome-contract  # scripts/check-chrome-contract.mjs — enforces source/screenshot chrome contract
npm run qa:daily-driver     # scripts/collect-daily-driver-metrics.mjs — readiness report, docs/qa/daily-driver/
npm run qa:perf-budget      # scripts/collect-perf-budget.mjs — bundle/evidence budget, docs/qa/perf-budget/
```

Other:

```bash
cd spike-ghostty-vt && cargo run   # standalone proof: real pty -> libghostty-vt parsing
node rockmap/build-roadmap.mjs roadmap.json roadmap.html   # rebuild roadmap.html after editing roadmap.json
```

**Zig must be pinned to `0.15.2`.** Homebrew's default `0.16` breaks the `libghostty-vt`/Ghostty bridge build. Always prefix Rust/Tauri builds with `PATH="/opt/homebrew/opt/zig@0.15/bin:$PATH"`.

There is no unified test suite across languages — treat `npm run build` + `npm test` (frontend) and `cargo test` + `cargo fmt --check` (backend) together as the verification bar for any change touching `app/`.

## Architecture

### Data flow (per pane)

```
[agent process: claude / codex / gemini / shell]
      ↕ stdin/stdout over pty
[portable-pty master]  ────────────────┐
      ↓ raw bytes (incl. ANSI)         │  RUST BACKEND (Tauri, app/src-tauri/src/lib.rs)
[libghostty-vt Terminal::vt_write]     │  owns PtyState: multiple real pty/process panes keyed by pane id
      → cell grid (chars + fg/bg/style)│
      ↓ serialize dirty cells          │
──────────── Tauri IPC "grid" event, tagged with paneId ───────
      ↓
[Canvas 2D renderer]  ─────────────────┐
      → pixels                         │  REACT FRONTEND (app/src/)
[keyboard/mouse capture]               │
      ↑ encode via libghostty-vt key.rs│
──────────── Tauri command (send_key/paste/resize_pty) ────────
      ↑
[portable-pty master write] → agent stdin
```

**Ownership boundary:** backend owns ptys + terminal state (one `Terminal` instance per pane); frontend owns rendering + input capture; Tauri IPC is the seam. Everything in `app/src-tauri/src/lib.rs` (single file, `#[tauri::command]` functions) is the backend surface: pane lifecycle (`open_workspace`, `create_pane`, `focus_pane`, `close_pane`, `terminate_pane`, `restart_pane`), terminal I/O (`send_key`, `paste`, `resize_pty`, `scroll_pty`), filesystem (`list_workspace_tree`, `read_text_file`, `write_text_file`, `create_workspace_file`/`folder`, `rename_workspace_path`, `delete_workspace_path`, `duplicate_workspace_path`, `search_workspace_text`, `watch_workspace_tree`), and Git (`git_status`, `git_file_diff`, `git_file_action`).

Frontend state modules under `app/src/` are one-concern-per-file and largely mirror backend commands 1:1 (e.g. `workspaceState.ts`, `terminalPane.ts`, `editorTabs.ts`, `agentSessionHandle.ts`, `agentActivity.ts`, `composerHarness.ts`, `appActions.ts`, `fileGitStatus.ts`, `diffView.ts`). Persistent app state (recent/open projects, sessions, pane labels, editor view state, composer harness state, activity log) lives in the Tauri Store JSON file at `~/Library/Application Support/com.jasonpoindexter.agent-cli/workspace.json` — schema documented in `docs/local-state.md`.

### Product surfaces

- **Run (default main surface):** readable terminal-backed view of the selected agent pane's visible PTY output, plus a separate app-owned Activity strip/timeline (`agentActivity.ts`, `agentActivityEvents` in the store) and the bottom composer. Never invents provider-native chat/tool/thinking structure from terminal text — that requires an explicit adapter/hook.
- **Raw terminal:** the real Canvas 2D + Ghostty grid for exact TUI interaction (scrollback, selection, bracketed paste, keyboard chords).
- **Editor / Browser preview:** hidden by default, opened via the Tools menu, dock left/right/bottom with draggable splitters and persisted layout. CodeMirror 6-backed editor; iframe-based preview scoped to localhost/docs/generated pages.
- **Project/session drawer:** left drawer switches between Projects, Files, Search, Git, Browser, Settings modes. A project session is a saved workbench context (editor tabs, browser URL, agent panes, pane labels/status) — not an editor tab, not a chat thread.
- **Composer:** routes prompts to the selected real terminal pane via the pty paste path (not a custom chat UI); also runs a small set of app commands (`>save`, `>find`, `>open`, `>clear`). Permission mode (Ask/Approve safe/Full access) gates app-owned actions through `appActions.ts`.

### Stack (locked, see DECISIONS.md 2026-07-07)

| Layer | Choice |
|---|---|
| Shell | Tauri 2 |
| Frontend | React 19 + TypeScript + Vite |
| Terminal engine | `libghostty-vt` 0.2.0 (Rust) — Ghostty's real VT/xterm parser |
| PTY | `portable-pty` |
| Terminal render | Canvas 2D (WebGL only if perf demands it, measured first) |
| Editor | CodeMirror 6 |
| Persistence | Tauri Store plugin (JSON); SQLite (`tauri-plugin-sql`) once state turns relational |

Full stack rationale and known risks: `ARCHITECTURE.md`.

## Working conventions

- TypeScript: ES modules, React function components, two-space indent, double quotes, `PascalCase` components, `camelCase` helpers. Co-located tests (`foo.ts` + `foo.test.ts`), vitest, behavior-named test cases.
- Rust: `rustfmt` (`cargo fmt --check` before done), explicit `.expect(...)` context in spikes, small focused functions.
- Comments stay sparse; only for terminal/pty/rendering/decision constraints that aren't obvious from the code.
- Commits: short conventional prefixes (`feat:`, `fix:`, `docs:`, `chore:`), concrete scope (e.g. `feat: verify ghostty parser resize path`).
- Do not replace working spikes (`spike-ghostty-vt/`) with mock demos.
- Preserve the decision trail: append to `DECISIONS.md`, don't edit past entries. Add repeatable pitfalls to `ERRORS.md`. Don't delete parked references in `PARKED.md`/`docs/` unless explicitly marked obsolete.
- For terminal/rendering work, prefer real-path verification over unit mocks: real pty bytes, real Ghostty parsing, real canvas paint, real keyboard roundtrip, real `npm run tauri dev` smoke test with a real agent CLI as the child process. Most STATE.md "VERIFIED" entries cite exactly this kind of manual smoke test alongside `npm test`/`cargo test` — match that bar for new work.
