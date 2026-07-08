# PRD — agent cli

**One-liner:** A lean native macOS replacement for Jason's actual VS Code workflow: project tabs, a file explorer, a real file editor, browser/web preview, and multiple real Claude/Codex CLI terminals — built on Ghostty's terminal engine, without the IDE chrome he does not use.

**Direction locked 2026-07-07** (see DECISIONS.md for the full trail): build our own app, leveraging open-source *components* (Ghostty's terminal engine, Tauri, CodeMirror) — not adopting a finished third-party app. cmux/Superconductor/hashmark were evaluated and are reference only. The core architecture (`libghostty-vt` in a Rust backend parsing a real pty) is **verified working** — see `spike-ghostty-vt/`.

## Problem

Jason works across 5-10 active projects. The real workflow is not "use VS Code as an IDE"; it is: open a project folder in VS Code, use the left file explorer, edit files in the editor, run one or more Claude/Codex CLI sessions in integrated terminals pointed at that project, and preview local web work in a browser. When a second or third project is active, it becomes another VS Code window with its own folder and agent terminal(s).

VS Code is useful here as a workbench: Explorer, editor, integrated terminal, shortcut muscle memory, theming/settings, and enough browser/web preview for local app work. Everything else is resource-heavy chrome around a workflow that is mostly real terminal agents. Existing tools each miss something: cmux (great reference, but someone else's app), zellij (static config, no native "open a folder"), Superconductor (closed source, chat UI not real terminal), hashmark/Hallmark-style approaches (reimplement chat UI or show one agent at a time instead of hosting real CLIs).

## Core Job

When Jason is moving between active projects and parallel coding agents, he wants to open/switch project folders, inspect and edit files, preview web output, and run real Claude/Codex CLI sessions side by side, so he can keep the speed and trust of terminal agents without paying the VS Code window/resource tax.

## Daily Workflow Requirements

The app must cover the parts of VS Code Jason actually uses. Default behavior should preserve VS Code muscle memory for files, editor, terminal focus, project switching, search, save, close, and command execution unless there is a clear reason to differ.

- Open and switch project folders quickly, including recent projects.
- Keep multiple projects open in one window through a persistent left project/workspace rail, similar in spirit to Codex's sidebar, with clear active-project state.
- Show task-scoped project sessions under each project in the left rail, similar to Codex chat rows. A session is a saved workbench context: project, editor tabs, browser URL, agent panes, pane labels/status, and transcript references. It is not an editor tab and not a custom chat thread.
- Browse the project tree with sensible ignores, file watching, and safe handling for symlinks, large files, and binary files.
- Open, edit, find/replace, save, and close source files in a robust CodeMirror editor with line numbers, syntax highlighting, indentation, undo/redo, path/breadcrumb context, file tabs, dirty-state, restored scroll/selection, and external-change protection.
- Open a lightweight browser/web preview for localhost apps, docs, auth flows, and agent-produced pages without switching context.
- Run real Claude/Codex/shell sessions in real ptys, with correct env/PATH/auth handling.
- Keep the terminal robust enough for daily agent work: Ghostty-backed VT fidelity, alternate-screen TUIs, ANSI/truecolor styling, resize, scrollback, selection/copy/paste, bracketed paste, common keyboard chords, fast-output responsiveness, and clear pane lifecycle state.
- Keep terminal panes as the source-of-truth agent interface. Add a Codex-style composer/harness for routing prompts/instructions to the selected agent pane or app-level actions; do not replace Claude/Codex's real terminal UI with a custom chat clone.
- Run multiple agent panes per project, and allow different open projects to run different agents at the same time. Each pane needs a visible name/task label, status, cwd, command, restart, and kill controls.
- Let agents hook into the app through a built-in, permissioned MCP/API surface for app-owned actions such as listing projects, reading open files, opening diffs, focusing panes, creating panes, and reporting task status.
- Switch across multiple active projects without separate heavyweight VS Code windows.
- Review agent-created changes through file status, diffs, editor gutters, lightweight Git actions, and source-hosting links/status where useful.
- Connect to local Git plus source hosts that matter for real coding work: GitHub and GitLab first, with Bitbucket/Azure DevOps as adapter-lane later. Connections should detect existing `git`/`gh`/`glab` auth, show health/errors, open repos/PRs/MRs/issues/pipelines, and support PR/MR creation only after local review flows are solid.
- Search files and terminal scrollback without leaving the app.
- Use polished, consistent Codex-quality iconography for project rail, file explorer, editor, browser, terminal, agent panes, git state, and common actions. Icons must carry labels/tooltips where meaning is not universal.
- Match Codex-level chrome polish for the workbench shell: compact density, consistent dark surfaces, active/hover/focus states, pane headers, settings/sidebar rhythm, command palette, context menus, badges, toasts, and restrained motion. Polish is part of the app chrome, not a marketing layer.
- Show agent activity state clearly like Codex: thinking, planning summary, running command, command result, reading file, edited file, created/deleted/renamed file, opened diff, waiting for approval/input, errored, exited, and complete. Surface concise activity/progress rows and tool events, not hidden chain-of-thought.
- Keep browser/web-preview controls minimal: address/local URL, back/forward, reload, open external, and per-project remembered preview URL.
- Keep common VS Code shortcuts and interaction patterns for the supported workflow, including command palette-style action access.
- Provide right-click/Control-click context menus on project rail, file explorer, editor tabs, editor text, terminal panes, browser preview, diff/git surfaces, and agent panes. Context menus must mirror the same command registry as menus/shortcuts/palette where possible, show disabled states, and confirm destructive actions.
- Provide only practical customization: color themes, font/terminal/editor settings, ignored folders, agent commands, model/provider/API configuration, MCP servers, credentials/auth checks, permission defaults, environment variables, and keybinding overrides.
- Recover from quit/crash by restoring project/session metadata without pretending dead agent processes are still alive.

## Settings Parity

Use Codex's settings structure as a reference for navigation density, iconography, search, and grouping, but only keep categories that serve this app's workbench job. Kept categories: General, Appearance, App configuration, Behavior, Keyboard shortcuts, MCP servers, Browser preview, Agent hooks, Connections, Git, Environments, and Worktrees.

Drop categories that imply an account/chat product or novelty feature: Profile, Pets, Usage & billing, Archived chats, and Chat Settings. Park Appshots and Computer use as future visual-context/permissioned automation ideas; they should not appear in the settings UI until browser preview and agent hooks are already real. Detailed mapping lives in `docs/settings-parity.md`.

## Navigation Parity

Use Codex's project/chat sidebar as a reference for information density, grouping, recency labels, active-row styling, and icon rhythm. Translate chats into project sessions: "New chat" becomes "New session", chat rows become named task sessions under each project, and "Show more" collapses older sessions. Search stays. Plugins and account/profile chrome are dropped. Scheduled/background sessions and archived sessions are parked until project sessions, transcripts, and agent hooks exist. Detailed mapping lives in `docs/navigation-parity.md`.

## Integration Scope

Local Git is core because it is part of supervising agent work. GitHub and GitLab are first-class source-hosting integrations because they cover common repo, PR/MR, issue, and CI/pipeline workflows. Prefer existing CLIs (`git`, `gh`, `glab`) and OS-safe credential storage before direct API work. Bitbucket, Azure DevOps, Linear, Jira, Slack, and Discord are adapter-lane or notification/link targets only; they should not turn the app into a project management, chat, or plugin platform. Detailed mapping lives in `docs/integrations-scope.md`.

## Chrome UI Polish

The chrome should feel Codex-level: dense, calm, readable, and intentional across the rails, editor tabs, pane headers, browser toolbar, settings shell, context menus, command palette, dialogs, toasts, and status badges. Use a real token system, one icon family, complete interaction states, and screenshot-based visual QA. Detailed criteria live in `docs/chrome-ui-polish.md`.

## Editor and Terminal Parity

The editor and terminal are the product core. The editor should feel like a real coding editor beside a dense file tree, not a text preview. The terminal should remain the trusted source-of-truth for Claude/Codex/shell sessions, not a simulated transcript. Detailed criteria live in `docs/editor-terminal-parity.md`.

## Agent Activity Timeline

Agent panes need Codex-style activity visibility: compact current state in pane headers, recent activity rows like `Edited a file`, aggregate rail badges, and a per-pane/session activity log. The log should show file events, command events, tool/app events, git/source-control events, approvals, errors, and completion. Hidden chain-of-thought stays out of scope; user-safe summaries, tool names, file paths, diffs, outputs, and approval states are in scope. Detailed criteria live in `docs/agent-activity-timeline.md`.

## Composer Harness

Use a bottom composer like Codex as the lightweight control surface over real panes. v0.5 routes prompts to the selected pty. v1 adds harness controls: permission mode, goal chip, target pane, model/profile selector, attachments/screenshot references, stop/send state, and activity logging. v2 may add an optional direct API/MCP agent harness, but only for app-owned orchestration; real Claude/Codex terminal panes remain first-class. Research and phased scope live in `docs/composer-harness-research.md`.

## Harness Contract

The composer talks to app-owned agent session handles, not directly to UI components. A handle owns pane identity, project/session context, cwd, agent profile, process state, approval mode, send, interrupt, readTail, close, and activity metadata. App-owned actions such as focus pane, open diff, attach screenshot reference, interrupt process, create pane, or open file must pass through a minimal action gate before Codex-style permission controls are shown. Glossary, event shape, and Vanta-derived boundaries live in `docs/harness-contract.md`.

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

- [x] File rail lists the workspace with ignores and live updates.
- [ ] Editor opens source files with line numbers, syntax highlighting, find/replace, dirty state, tabs, path context, save, and external-change warnings.
- [ ] Terminal pane remains robust and responsive while browsing/editing files.
- [x] Recent projects and last workspace make reopening cheap.
- [ ] Common file/editor/terminal actions are reachable through VS Code-style shortcuts, menu bar entries, and right-click/Control-click context menus.
- [ ] Core chrome surfaces use a coherent token/icon system with hover, active, disabled, focus, loading, empty, and error states.
- [ ] Composer can target the selected terminal pane, send multiline prompts safely, stop/interrupt the pane, and show target/project/session context.

## v1 done criteria

**Done:** the app replaces the current multi-window VS Code habit for normal agent work.

- [ ] A persistent left project/workspace rail opens at least 3 projects in one window and shows active, running, exited, and attention-needed states.
- [ ] Each project can show multiple task sessions in the rail; selecting one restores its workbench context without pretending dead processes are live.
- [ ] Browser/web preview opens localhost apps, docs, auth flows, and generated pages inside the workbench.
- [ ] Each project can run multiple named agent/shell panes, and different projects can run different agents concurrently.
- [ ] Pane lifecycle controls and icon badges cover thinking, running, waiting, errored, exited, restart, terminate, and attention-needed states.
- [ ] Agent activity rows show recent thinking/planning summaries, file edits, commands, tool/app actions, approvals, errors, and completion per pane/session.
- [ ] Each pane/session exposes an app-owned agent session handle with send, interrupt, readTail, close, state, cwd, profile, approval mode, and activity metadata.
- [ ] App-owned actions use a minimal action gate with risk class, approval decision, audit event, and undo/rollback hint where possible.
- [ ] Composer harness supports permission mode, goal state, model/profile selector, attachments, and approval logging for app-owned actions.
- [ ] Session restore brings back projects, file tabs, pane layout, and enough metadata to resume intentionally.
- [ ] Daily-driver workflows are measured against the equivalent VS Code habit: one-project edit+agent, two-agent same-project, and three-project switching after quit/relaunch.
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
- Ship ugly first, but do not invent a new interaction language. VS Code-compatible shortcuts and basic settings/theme support are product requirements once the editor loop exists.

## Non-goals

- Not a general-purpose terminal emulator (it hosts agents; it's not iTerm).
- Not a general-purpose browser replacement: browser/web preview exists for development workflow, local previews, docs, and auth, not full daily browsing.
- Not reimplementing the agent UI — panes run the *real* `claude`/`codex` TUI in a real pty. The app may have a compact command/composer box, but it routes to real panes/app actions and does not become a custom chat-UI replacement.
- Not a from-scratch VT parser — that's what libghostty-vt is for.
- Not multi-platform, multi-user, or plugin-capable before there's a real daily-use track record.
- Not a full VS Code clone: no extension marketplace, plugin system, debugger, LSP-first IDE layer, remote SSH, or full git client before the lean workflow is daily-drivable. Color themes and focused settings are allowed; plugins are not.
- Not an arbitrary agent plugin host: built-in MCP/API hooks may expose app-owned commands, but agents should not run unreviewed extension code inside the app.
- Not a task database: pane names/status/transcripts exist only to orient agent work, not to become project management software.
- Not a Codex settings clone: copy the useful structure, search, icons, and developer/AI connection surfaces; do not copy account, billing, pets, archived-chat, or custom-chat settings.
- Not a Codex chat clone: project sessions may look like chat rows in the rail, but the underlying object is a workbench session, not a custom LLM conversation thread.
- Not a general integration hub: GitHub/GitLab/source-control integrations are allowed because they support code review and shipping; unrelated services stay parked unless they directly improve agent supervision.
- Not decorative UI bloat: chrome polish means consistent workbench surfaces, states, and legibility; it does not mean marketing pages, ornamental graphics, or feature chrome that does not support the workflow.
