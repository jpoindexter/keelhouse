# ROADMAP — agent cli

Source of truth: `roadmap.json` → `roadmap.html` (rockmap board). Rebuild after editing:

```bash
node rockmap/build-roadmap.mjs roadmap.json roadmap.html
```

Sequential where risk gates the next step; parallel only when cards are independent. Ship ugly first, but do not lose the actual product shape: this replaces Jason's VS Code workflow of file explorer + file editor + real CLI agents.

## Execution discipline (governs every phase)

Added 2026-07-08. The roadmap is now detailed enough to invite building breadth before a slice is real — resist that. The failure mode is over-engineering ahead of proven need.

- **One thin vertical slice at a time.** Each card ships end-to-end and stays usable before the next starts. No half-built breadth.
- **App runnable at every commit.** `app/` must launch and work after each change — never a "big rewrite in flight" state.
- **Measure, don't preempt.** The two open risks get fixed only when they actually bite: fast-output stutter → dirty-region IPC deltas (not WebGL first); 4–8 concurrent agents → measure the process ceiling then. Same for SQL, worktrees, WebGL, theming — build at the phase that needs them, not earlier.
- **One driver per file per slice.** Decided 2026-07-08: **the coding agent drives the code** (`app/src-tauri/src/lib.rs`, `app/src/App.tsx`); Jason reviews rather than hand-editing in parallel, to avoid concurrent-edit clobbers.
- **Rule of 3 / no platform-thinking** (from CLAUDE.md) still apply: no abstraction until 3 concrete uses; no multi-tenancy/plugins/settings before a real daily-use track record.

## Done so far (research + verification — see DECISIONS.md)

- ~~OSS landscape survey~~ · ~~zellij trial (parked — wrong interaction model)~~ · ~~Superconductor/hashmark/cmux evaluated~~ · ~~editor-fidelity spike (PASS)~~ · ~~cmux fork-decision audit~~
- ~~**libghostty-vt spike — PASSED 2026-07-07.**~~ Real pty → real Ghostty parsing → correct cell readback (`spike-ghostty-vt/`). Proves the terminal *engine* choice.
- ~~**SPIKE-2: render + input loop — PASSED 2026-07-08.**~~ Full loop in a real Tauri window, now promoted into `app/`: pty → libghostty-vt → grid snapshot over IPC → canvas paint; keydown → bytes → pty. Verified: zsh prompt renders, typing echoes, arrows/ctrl-c work, Cmd+V paste works, Cmd+K clears, Option word-nav/delete works, canvas drag selection highlights text, Cmd+C copies selected terminal text. **The rock is dead** — no unproven architecture remains.

## v0 — One project, one real agent pane

The whole app in one vertical slice. If this works, everything else is composition; if it doesn't, nothing else matters.

1. ~~**SPIKE-2: Render + input loop** *(the rock)*.~~ **DONE** — proven in the original spike and promoted into `app/` (see above). The render+input pipeline is now a working Tauri app, with copy/selection and core shortcut behavior verified.
2. ~~**SCAFFOLD: Tauri 2 app**.~~ **DONE** — merged into SPIKE-2 (deliberate: the render risk lives at the IPC seam, so proving it required the real scaffold). `app/` is a working Tauri 2 + React/Vite + Rust app with IPC wired.
3. ~~**OPEN-FOLDER:** native folder picker creates the current workspace.~~ **DONE 2026-07-08** — verified first launch, Cmd+O switch, and `pwd` in the pane.
4. ~~**AGENT-LAUNCH:** launch real `claude` in that selected cwd.~~ **DONE 2026-07-08** — persisted launch profile defaults to `claude`; verified child process cwd and rendered TUI.
5. ~~**LAST-WORKSPACE:** quit/relaunch reopens the last folder.~~ **DONE 2026-07-08 for the current shell-pane default** — recheck once AGENT-LAUNCH changes the default command.
6. ~~**TERMINAL-HARDEN:** resize, scrollback basics, fast-output smoke, and keybinding/copy-selection audit.~~ **DONE 2026-07-08** — Ghostty viewport scrollback, Shift+PageUp/PageDown, wheel scroll, resize clamp, 300-line fast-output smoke, and copy-selection audit verified.
7. ~~**APPROOT:** promote `spike-2/` into the real app root/package so daily development starts from the thing that works.~~ **DONE 2026-07-08** — `app/` is the real package/root; npm package/Rust crate/Tauri product identifier were renamed; builds/tests pass; `npm run tauri dev` launches `target/debug/agent-cli` and spawns `claude` in the selected cwd.
8. ~~**PROCESS-ENV:** launch env/PATH/auth checks for Claude/Codex.~~ **DONE 2026-07-08** — bad cwd/command are preflighted before replacing the pane; missing-command errors render visibly; process exits emit a banner for runtime/auth-style failures; Claude launch regression still spawns in the selected cwd.
9. ~~**DATA-STORAGE:** documented local state location and reset path.~~ **DONE 2026-07-08** — `docs/local-state.md` names the Tauri Store path, current `workspace.json` schema, reversible reset command, and default profile repair path.

**v0 done:** open the app, pick a folder, run `claude` in the pane, type and see output — feels like a real terminal. Relaunch returns to the same project.

## v0.5 — The VS Code shell replacement shape

This is where the clarified product point lands: not "terminal app with optional editor later," but the lean subset of VS Code Jason actually uses.

- **APP-SHELL:** stable three-part layout: file rail, editor area, terminal pane area.
- **FILE-RAIL:** dense project file explorer, with noisy folders ignored.
- **FILE-WATCHER:** live rail updates, gitignore/app ignores, noisy-folder protection.
- **RECENT-PROJECTS:** reopen active folders without a picker ceremony.
- **EDITOR:** CodeMirror editor that opens files from the rail, edits, and saves.
- **EDITOR-FIND-REPLACE:** local find/replace inside files.
- **EDITOR-LANGUAGE-MODES:** first-class TS/TSX/JSX/MD/Rust/JSON/TOML highlighting.
- **SAVE-CONFLICTS:** detect external file edits before overwrite.
- **LARGE-FILE-POLICY:** safe handling for large or binary files.
- **FILE-OPS:** create/rename/delete/duplicate/reveal from rail.
- **EDITOR-TABS:** several open files, dirty indicators, close protection.
- **AGENT-PROFILES:** Claude default, plus Codex/shell profiles without hardcoding one CLI forever.
- **SHORTCUTS:** documented core shortcut map across terminal/editor/chrome.
- **ACCESSIBILITY-BASICS:** keyboard reachability, visible focus, and labelled chrome controls.

## v1 — Multi-project, multi-agent cockpit

- **PROJECT-TABS:** project tabs replace separate VS Code windows.
- **PANE-MANAGER:** multiple Claude/Codex/shell panes per project.
- **PANE-NAMES:** pane names and task labels.
- **AGENT-ATTENTION:** visible exited/needs-input state. Start with reliable process exits, then explicit Claude/Codex prompt heuristics; prompt-idle detection is later/experimental.
- **PROCESS-LIFECYCLE:** running/exited status, restart, kill, command/cwd visibility.
- **SESSION-RESTORE:** restore project tabs, editor tabs, rail state, pane layout.
- **GIT-STATUS:** dirty/new/deleted markers in the file rail.
- **DIFF-VIEW:** inspect agent-created changes without VS Code.
- **GIT-ACTIONS-LITE:** stage/unstage/discard/copy diff; v1 must-have after DIFF-VIEW, not a full git client.
- **PERF-BUDGET:** prove this is lighter than the VS Code workflow it replaces.
- **DAILY-DRIVER-METRICS:** prove the app can replace the current workflow.

## v2 — Workflow leverage

- **WORKTREE:** create disposable worktree + agent pane from a project.
- **SEARCH:** file quick-open and ripgrep-backed text search.
- **TERMINAL-FIND:** search active terminal output/scrollback.
- **COMMAND-PALETTE:** compact access to cockpit actions without adding IDE chrome.
- **SETTINGS:** inspectable config for agent commands, ignored folders, font/theme, layout.
- **NOTIFICATIONS:** background agent exit/attention badges and optional macOS notifications.
- **TRANSCRIPTS:** save/review completed pane output.
- **KEYBINDINGS-CONFIG:** configurable app shortcut overrides after defaults stabilize.

## v3 — Polish and shipping

- **THEME:** mono-ghost palette across chrome, terminal, rail, and editor.
- **PACKAGING:** local macOS `.app` packaging.
- **REUSE-AUDIT:** mine Hallmark/hashmark/brutal/indx for reusable Tauri shell, persistence, editor, or design patterns without inheriting the wrong product shape.

## Research-backed stack per phase (2026-07-08)

Deep-research (6 angles, 26 sources, 24/25 claims verified) locked a concrete library to each phase. Full report + citations: `docs/vision-to-reality-2026-07-08.html`. DECISIONS.md 2026-07-08.

- **v0** — `portable-pty` (have it) + **Tauri Store plugin** for last-folder.
- **v0.5** — rail: `ignore::WalkBuilder` (gitignore-free) + `notify`+`notify-debouncer-mini` (FSEvents, debounce or storm) + **React Arborist** (virtualized VS-Code-style tree). editor: **`@uiw/react-codemirror`** (CM6; ~300KB vs Monaco ~5–10MB; Monaco doesn't support webviews).
- **v1** — **Tauri SQL/SQLite plugin** when state turns relational; `Child`/`ChildKiller`/`ExitStatus` lifecycle; **measure the process ceiling** (4–8+ ptys) here. Terminal under load: **dirty-region IPC deltas first**, WebGL renderer only if measured IPC-bound (WebKit WebGL2 works — the "no WebGL2" blocker was refuted).
- **v3** — Tauri CLI `.app` bundle, **ad-hoc sign** for local use; avoid `externalBin` sidecars (break notarization).
