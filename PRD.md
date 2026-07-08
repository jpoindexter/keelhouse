# PRD — agent cli

**One-liner:** A lean native macOS replacement for Jason's actual VS Code workflow: project tabs, a file explorer, a real file editor, and multiple real Claude/Codex CLI terminals — built on Ghostty's terminal engine, without the IDE chrome he does not use.

**Direction locked 2026-07-07** (see DECISIONS.md for the full trail): build our own app, leveraging open-source *components* (Ghostty's terminal engine, Tauri, CodeMirror) — not adopting a finished third-party app. cmux/Superconductor/hashmark were evaluated and are reference only. The core architecture (`libghostty-vt` in a Rust backend parsing a real pty) is **verified working** — see `spike-ghostty-vt/`.

## Problem

Jason works across 5-10 active projects. The real workflow is not "use VS Code as an IDE"; it is: open a project folder in VS Code, use the left file explorer, edit files in the editor, and run one or more Claude/Codex CLI sessions in integrated terminals pointed at that project. When a second or third project is active, it becomes another VS Code window with its own folder and agent terminal(s).

VS Code is useful for two things here: the file explorer and file editor. Everything else is resource-heavy chrome around a workflow that is mostly real terminal agents. Existing tools each miss something: cmux (great reference, but someone else's app), zellij (static config, no native "open a folder"), Superconductor (closed source, chat UI not real terminal), hashmark/Hallmark-style approaches (reimplement chat UI or show one agent at a time instead of hosting real CLIs).

## Core Job

When Jason is moving between active projects and parallel coding agents, he wants to open/switch project folders, inspect and edit files, and run real Claude/Codex CLI sessions side by side, so he can keep the speed and trust of terminal agents without paying the VS Code window/resource tax.

## Daily Workflow Requirements

The app must cover the parts of VS Code Jason actually uses:

- Open and switch project folders quickly, including recent projects.
- Browse the project tree with sensible ignores, file watching, and safe handling for symlinks, large files, and binary files.
- Open, edit, find/replace, save, and close source files with dirty-state and external-change protection.
- Run real Claude/Codex/shell sessions in real ptys, with correct env/PATH/auth handling.
- Run multiple agent panes in one project, each with a visible name/task label, status, cwd, command, restart, and kill controls.
- Switch across multiple active projects without separate heavyweight VS Code windows.
- Review agent-created changes through file status, diffs, editor gutters, and lightweight git actions.
- Search files and terminal scrollback without leaving the app.
- Recover from quit/crash by restoring project/session metadata without pretending dead agent processes are still alive.

## User

Jason. Solo dev, senior, 15yr, ND (dyslexia/ADHD/aphantasia). Needs concrete and testable over speculative; decides aesthetics by seeing, not describing (proven: rejected two color schemes before picking one by eye). Stack fluency: Node/ESM/TS, React, Tauri 2, Rust-adjacent (indx/hashmark/brutal all Tauri). **Not** a Swift/AppKit dev — a reason building native-in-Tauri beats forking a Swift app.

## v0 done criteria

**Done (one sentence): open the app, pick a project folder, and run a real `claude` session in a terminal pane that renders via libghostty-vt and takes keyboard input — it reads and feels like a real terminal.**

- [x] The render+input loop is proven: pty → libghostty-vt → canvas paint → keyboard back to pty, in a real window, feeling like a real terminal.
- [x] Tauri app scaffold: native window, Rust backend, React frontend, IPC channel established.
- [x] Native folder picker opens a workspace; the current default shell pane starts in that cwd; Cmd+O switches folders; quit/relaunch reopens the last folder.
- [x] Folder picker → spawn `claude` in that cwd → one interactive terminal pane, fullscreen-TUI-clean (claude's own UI renders correctly).

## v0.5 done criteria

**Done:** one project can be used without opening VS Code for the basic loop: browse files, edit/save files, and run one real agent terminal.

- [ ] File rail lists the workspace with ignores and live updates.
- [ ] Editor opens source files, supports syntax highlighting, find/replace, dirty state, save, and external-change warnings.
- [ ] Terminal pane remains usable while browsing/editing files.
- [ ] Recent projects and last workspace make reopening cheap.

## v1 done criteria

**Done:** the app replaces the current multi-window VS Code habit for normal agent work.

- [ ] Multiple project tabs are open in one window.
- [ ] Each project can run multiple named agent/shell panes.
- [ ] Pane lifecycle controls cover running, exited, restart, terminate, and attention-needed states.
- [ ] Session restore brings back projects, file tabs, pane layout, and enough metadata to resume intentionally.
- [ ] Resource use is measured against the equivalent VS Code workflow.

## In scope (v0)

- One native window, one picked folder, one live interactive terminal pane running a real agent.
- The full terminal pipeline (pty ↔ libghostty-vt ↔ canvas ↔ input) as a reusable component.
- Enough workspace state to reopen the last folder and resume the same shape.

The file rail and editor are not optional product garnish; they are the reason this can replace the VS Code shell. They come immediately after the one-pane v0 because they are part of the core job. v0 stays deliberately narrow only to prove the terminal/process foundation first.

## Out of scope → PARKED.md

- Tabs / multi-project (v1)
- Multiple simultaneous panes / grid (v1)
- Worktree helper (later; useful once tabs/panes exist)
- Windows/Linux (macOS first; Tauri makes this portable later, not now)

## Constraints

- **Stack locked** (DECISIONS.md 2026-07-07): Tauri 2 + React/TS/Vite frontend + Rust backend; `libghostty-vt` terminal engine; `portable-pty`; CodeMirror 6 for the eventual editor. Switching before v0 ships = "yes, throw away the work."
- **Library choices research-backed** (DECISIONS.md 2026-07-08, report `docs/vision-to-reality-2026-07-08.html`): editor `@uiw/react-codemirror`; file rail `ignore` (walk) + `notify`+`notify-debouncer-mini` (watch) + React Arborist (tree); persistence Tauri Store plugin (v0/v0.5) → SQL/SQLite plugin (v1); packaging ad-hoc sign for local use. All primary-sourced.
- Toolchain: Zig **pinned to 0.15.2** (Homebrew default 0.16.0 breaks the libghostty-vt build). Documented in `spike-ghostty-vt/README.md`.
- Must coexist with Jason's existing projects (indx, brutal, hashmark, prova, gripe, lint) without touching their git state.
- Ship ugly first: no theming, animation, settings UI, or empty-states polish until the core loop works end-to-end.

## Non-goals

- Not a general-purpose terminal emulator (it hosts agents; it's not iTerm).
- Not reimplementing the agent UI — panes run the *real* `claude`/`codex` TUI in a real pty. The app is the cockpit around them, never a chat-UI replacement.
- Not a from-scratch VT parser — that's what libghostty-vt is for.
- Not multi-platform, multi-user, or plugin-capable before there's a real daily-use track record.
- Not a full VS Code clone: no extension marketplace, debugger, LSP-first IDE layer, remote SSH, or full git client before the lean workflow is daily-drivable.
- Not a task database: pane names/status/transcripts exist only to orient agent work, not to become project management software.
