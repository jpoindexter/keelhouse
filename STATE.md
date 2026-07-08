# STATE — agent cli (handoff 2026-07-08 18:05)

Mirror of `~/Documents/Obsidian Vault/ops/handoffs/handoff-2026-07-08-1519-agent-cli-folder-picker.md`. Overwrite on each handoff.

## Goal

Build **agent cli** — a native macOS Tauri 2 app that replaces Jason's VS Code workflow (file-explorer rail + CodeMirror editor + real `claude`/`codex` CLI terminal panes), built on Ghostty's terminal engine. Current work: starting the v0.5 file rail.

## Done

- **SPIKE-2 (proven):** full terminal loop in a real Tauri window — pty → `libghostty-vt` (real Ghostty VT parsing, in Rust) → grid snapshot over Tauri IPC → Canvas 2D paint; keydown → Ghostty key `Encoder` → pty. Verified by hand: shell renders, typing/arrows/ctrl-c work, `claude`'s fullscreen TUI renders clean.
- **Shortcuts (proven):** real key encoder (arrows, ctrl, Option-as-Meta word-nav, Fn, Shift+Enter, re-encodes on cursor/kitty mode change); Cmd+V paste (clipboard plugin, bracketed-aware); mouse drag selection + highlight; Cmd+C copy from selection; Cmd+K clear (native menu item).
- **Deep research → docs + planning:** `docs/vision-to-reality-2026-07-08.html` (6 areas, 24/25 claims verified). Library choices locked in PRD/ROADMAP/DECISIONS (2026-07-08 entries).
- **v0 folder-picker slice (VERIFIED 2026-07-08):** restructured pty from spawn-in-`setup()` to on-demand `open_workspace(path)` (spawns `$SHELL` in chosen cwd, tears down + respawns previous pane via `ChildKiller`). Added native folder picker (`plugin-dialog`), last-folder persistence (`plugin-store`, `workspace.json`), and a **Terminal → Open Folder… (Cmd+O)** menu item. Verified by hand with first launch, Cmd+O folder switch, and quit/relaunch persistence; `pwd` in the pane matched the selected folder each time.
- **AGENT-LAUNCH (VERIFIED 2026-07-08):** `open_workspace` now accepts a persisted launch profile. Default profile is `claude` via a login shell so nvm-installed CLIs resolve; backend only executes the supplied profile. Verified by hand: app launched `claude` as the direct child of `spike-2`, cwd was `/Users/jasonpoindexter/Documents/GitHub/apps/agent cli`, and Claude's fullscreen TUI rendered in the window.
- **TERMINAL-HARDEN (VERIFIED 2026-07-08):** snapshots now render Ghostty's visible viewport instead of only the active screen; Shift+PageUp/PageDown and mouse wheel scroll through Ghostty scrollback; key/paste snaps back to live output; resize dimensions are clamped before reaching the pty. Verified with a 300-line fast-output burst, Shift+PageUp/Down scrollback screenshots, resize smoke, and copy-selection audit.
- **APPROOT (VERIFIED 2026-07-08):** promoted `spike-2/` to `app/`; renamed npm package to `agent-cli`, Rust package to `agent-cli`, lib crate to `agent_cli_lib`, product/window title to `agent cli`, and identifier to `com.jasonpoindexter.agent-cli`. Verified from `app/`: `cargo test` (6 tests), `cargo build`, `npm run build`, `npm test`, and `npm run tauri dev`. Runtime smoke launched `target/debug/agent-cli`, spawned direct child `claude`, and `lsof` showed the child cwd was `/Users/jasonpoindexter/Documents/GitHub/apps/agent cli`.
- **PROCESS-ENV (VERIFIED 2026-07-08):** `open_workspace` now validates workspace cwd before spawn, preflights the selected launch command through the same login-shell mode used for launch, returns visible frontend errors instead of silently failing, and emits a pane-exit banner when a launched process exits. Verified with Rust tests (10 total), `npm run build`, `npm test`, `cargo build`, real bad-command launch (visible missing-command banner, no child process under `agent-cli`), real immediate-exit launch (`false`, child exited and no child remained), and real Claude launch regression (`claude` direct child cwd matched repo).
- **DATA-STORAGE (VERIFIED 2026-07-08):** `docs/local-state.md` documents the v0/v0.5 Tauri Store path (`~/Library/Application Support/com.jasonpoindexter.agent-cli/workspace.json`), current schema, reversible reset command, and default `launchProfile` repair path. `roadmap.html` rebuilt from `roadmap.json`.
- **APP-SHELL (VERIFIED 2026-07-08):** frontend now has the stable VS Code-shell replacement shape: left file rail surface, main editor surface, and bottom agent terminal panel. Terminal resize now measures the terminal panel instead of the full window, so the pty grid matches the visible pane. Verified with `npm run build`, `npm test`, `cargo test`, `cargo build`, and real `npm run tauri dev` smoke launching `target/debug/agent-cli` with direct child `claude` in cwd `/Users/jasonpoindexter/Documents/GitHub/apps/agent cli`.

## In progress

**Next active slice: FILE-RAIL.** APP-SHELL is verified. Build the dense project file explorer surface in the left rail, with ignored/noisy folders excluded before adding editor behavior.

## Next (ordered)

1. **FILE-RAIL:** dense project file explorer. Stack per `ROADMAP.md`: `ignore` + `notify`+`notify-debouncer-mini` + React Arborist.
2. **FILE-WATCHER:** live rail updates, gitignore/app ignores, noisy-folder protection.
3. **EDITOR:** CodeMirror editor via `@uiw/react-codemirror`.

## Gotchas

- **Zig pinned to 0.15.2.** Every build/run MUST prefix PATH: `PATH="/opt/homebrew/opt/zig@0.15/bin:$PATH"`. Homebrew's default zig 0.16 breaks `libghostty-vt-sys`. Build: `cd app/src-tauri && PATH=... cargo build`. Run: `cd app && PATH=... npm run tauri dev`.
- **`libghostty-vt` types are `!Send`/`!Sync`.** Per pane, the `Terminal` + key `Encoder` are created inside and never leave ONE "terminal thread". A reader thread forwards pty bytes over an `mpsc` channel; only the `Send` pieces (channel `tx`, pty writer, `ChildKiller`) cross threads. Do NOT move `Terminal`/`Encoder` across threads — it won't compile and isn't safe.
- **Data flow:** pty bytes → `Terminal::vt_write` → `snapshot()` (full grid, cells w/ fg/bg/bold) → Tauri event `"grid"` → Canvas 2D. Input: JS `send_key`/`paste`/`resize_pty` commands → current pane's channel → terminal thread encodes + writes. Full-grid snapshots per frame (rAF-coalesced, not dirty-diffed yet — fine until fast output stutters).
- **Key files:**
  - `app/src-tauri/src/lib.rs` — backend: `spawn_pane()`, `open_workspace()`, `handle_key()`, `handle_paste()`, `snapshot()`, `key_from_code()`, `PtyState{pane: Mutex<Option<Pane>>}`, menu, tests.
  - `app/src/App.tsx` — app shell layout, canvas render loop, input encoding, workspace init (`initWorkspace`/`pickFolder`), selection wiring.
  - `app/src/selection.ts` — mouse selection math (`pointFromMouse`, `isCellSelected`, `selectionToText`).
  - `spike-ghostty-vt/` — original parsing-only spike + Zig-pin notes.
- **Planning = source of truth (read before deciding anything):** `PRD.md`, `ROADMAP.md` (has "Execution discipline" + per-phase stack), `DECISIONS.md` (append-only, don't edit past entries), `docs/vision-to-reality-2026-07-08.html`.
- **Execution discipline (locked in ROADMAP):** one thin vertical slice at a time; app runnable at every commit; measure-don't-preempt (no WebGL/SQL/worktrees/theming until measured need); the coding agent drives `lib.rs`/`App.tsx` (Jason reviews, doesn't hand-edit in parallel).
- **Stack:** Tauri 2 + React/TS/Vite + Rust; `libghostty-vt` 0.2.0; `portable-pty` 0.9; plugins: opener, clipboard-manager, dialog, store. Capabilities in `app/src-tauri/capabilities/default.json`.

## Continuation prompt (for Codex)

Continue agent cli: read `STATE.md`, `ROADMAP.md`, and `DECISIONS.md` at the repo root, then resume at "Next" step 1 — FILE-RAIL. v0 is verified, and APP-SHELL is verified: folder picker, last-workspace persistence, default `claude` agent launch, terminal hardening, APPROOT, PROCESS-ENV, DATA-STORAGE, and the three-part shell layout. All builds/runs need `PATH="/opt/homebrew/opt/zig@0.15/bin:$PATH"` (zig 0.15.2 pin). Respect the Execution discipline in ROADMAP: one slice at a time, app runnable every commit, measure-don't-preempt.
