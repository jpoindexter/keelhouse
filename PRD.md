# PRD — Keelhouse

**One-liner:** Keelhouse is a lean native macOS agent workbench for Jason's actual VS Code workflow: Codex-style project/chat history and structured agent conversations as the main surface, plus optional raw Codex/Gemini/Claude terminals and fast resizable file explorer, editor, Git, and browser trays — without the IDE chrome he does not use.

**Naming:** `agent-cli` remains the repo/package slug while the product name is Keelhouse.

**Direction locked 2026-07-07** (see DECISIONS.md for the full trail): build our own app, leveraging open-source *components* (Ghostty's terminal engine, Tauri, CodeMirror) — not adopting a finished third-party app. cmux/Superconductor/hashmark were evaluated and are reference only. The core architecture (`libghostty-vt` in a Rust backend parsing a real pty) is **verified working** — see `spike-ghostty-vt/`.

## Problem

Jason works across 5-10 active projects. The real workflow is not "use VS Code as an IDE"; it is: open a project folder in VS Code, use the left file explorer, edit files in the editor, run one or more Codex/Gemini/Claude CLI sessions in integrated terminals pointed at that project, and preview local web work in a browser. When a second or third project is active, it becomes another VS Code window with its own folder and agent terminal(s).

VS Code is useful here as a workbench: Explorer, editor, integrated terminal, shortcut muscle memory, theming/settings, and enough browser/web preview for local app work. But the center of gravity is not the code editor; Jason spends most of the session talking to and supervising real terminal agents, then pulls code/browser surfaces in as needed. Everything else is resource-heavy chrome around that agent-first loop. Existing tools each miss something: cmux (great reference, but someone else's app), zellij (static config, no native "open a folder"), Superconductor (closed source, chat UI not real terminal), hashmark/Hallmark-style approaches (reimplement chat UI or show one agent at a time instead of hosting real CLIs).

## Core Job

When Jason is moving between active projects and parallel coding agents, he wants to open/switch project folders, inspect and edit files, preview web output, and run real Codex/Gemini/Claude CLI sessions side by side, so he can keep the speed and trust of terminal agents without paying the VS Code window/resource tax.

## Daily Workflow Requirements

The app must cover the parts of VS Code Jason actually uses. Default behavior should preserve VS Code muscle memory for files, editor, terminal focus, project switching, search, save, close, and command execution unless there is a clear reason to differ.

- Open and switch project folders quickly, including recent projects.
- Keep multiple projects open in one window through a persistent left project/workspace rail, similar in spirit to Codex's sidebar, with clear active-project state.
- Show multiple independent chats under each project in the left rail, matching the Codex interaction model. Each chat persists its message history, provider thread id, workbench context, editor tabs, browser URL, optional raw-terminal panes, and activity references.
- Browse the project tree with sensible ignores, file watching, and safe handling for symlinks, large files, and binary files.
- Open, edit, find/replace, save, and close source files in a robust CodeMirror editor with line numbers, syntax highlighting, indentation, undo/redo, path/breadcrumb context, file tabs, dirty-state, restored scroll/selection, and external-change protection.
- Open a lightweight browser/web preview for localhost apps, docs, auth flows, and agent-produced pages without switching context.
- Run real Codex/Gemini/Claude/shell sessions in real ptys, with correct env/PATH/auth handling.
- Keep the terminal robust enough for daily agent work: Ghostty-backed VT fidelity, alternate-screen TUIs, ANSI/truecolor styling, resize, scrollback, selection/copy/paste, bracketed paste, common keyboard chords, fast-output responsiveness, and clear pane lifecycle state.
- Make a structured, persisted chat timeline and composer the primary workbench surface. Provider adapters own user messages, assistant messages, tool activity, resumable thread ids, stop state, and errors; never infer that structure from terminal text.
- Expose raw terminal as an explicit alternate center view for exact TUI interaction and providers without a structured adapter. The code editor, Git, files, and browser preview remain movable, resizable trays around the chat. First open defaults to the chat rail, centered conversation/composer, and tabbed right dock. Do not mirror the raw terminal inside the chat timeline.
- Use VS Code/Codex-like application structure for the shell: compact top status/action bar, persistent side drawer, draggable workbench trays, and bottom status strip. Adapt the pattern to Keelhouse state and actions; do not copy fake window controls, fake browser navigation, decorative activity rails, or controls that imply unavailable behavior.
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

Use Codex's project/chat sidebar as the interaction reference for information density, grouping, recency labels, active-row styling, and icon rhythm. "New chat" creates an independent provider conversation under the active project; the first prompt generates an editable title; "Show more" collapses older chats. Search stays. Plugins and account/profile chrome are dropped. Scheduled/background runs remain parked until chat persistence and agent hooks are proven. Detailed mapping lives in `docs/navigation-parity.md`.

## Reference Product Guardrails

Zed is the closest product-shape reference because its Agent Panel, Threads Sidebar, Terminal Threads, External Agents, ACP boundary, project grouping, worktree isolation, and review-changes flow overlap the Keelhouse job. The important inversion: Zed remains an editor with strong AI surfaces; Keelhouse should remain an agent cockpit where the selected agent session is the primary screen and editor/browser/terminal/git surfaces are movable trays or drawers around it.

From the `awesome-agent-orchestrators` list, use ConstellAgent for macOS multi-agent terminal/editor/worktree shape, herdr for terminal-session mechanics and attention status, parallel-code for worktree/diff-review flow, and Clave for native macOS multi-session layout ideas. Do not borrow broad cloud/team orchestration, Kanban/org-chart layers, remote fleet runners, issue-tracker automation, or plugin-marketplace scope. Detailed mapping lives in `docs/reference-products.md`.

## Integration Scope

Local Git is core because it is part of supervising agent work. GitHub and GitLab are first-class source-hosting integrations because they cover common repo, PR/MR, issue, and CI/pipeline workflows. Prefer existing CLIs (`git`, `gh`, `glab`) and OS-safe credential storage before direct API work. Bitbucket, Azure DevOps, Linear, Jira, Slack, and Discord are adapter-lane or notification/link targets only; they should not turn the app into a project management, chat, or plugin platform. Detailed mapping lives in `docs/integrations-scope.md`.

## Chrome UI Polish

The chrome should feel Codex-level: dense, calm, readable, and intentional across the rails, editor tabs, pane headers, browser toolbar, settings shell, context menus, command palette, dialogs, toasts, and status badges. Use a real token system, one icon family, complete interaction states, and screenshot-based visual QA. Detailed criteria live in `docs/chrome-ui-polish.md`.

`demo/keelhouse-chrome-demo.html` is the binding visual contract (re-affirmed 2026-07-11 after the shipped chrome drifted to boxed-button density; delta audit in `docs/chrome-delta-audit.md`). Its control grammar is normative: flat 600-weight text actions with accent-strong hover, transparent icon buttons with color-only hover, and a single filled Send as the only default filled control. Tabs use steel-cyan top-underline actives; sidebar and list rows use left-stripe actives; cards use 6px radius with shadow elevation; the composer is an elevated 12px-radius card; type scale is Inter/SF Mono at 13px base, 12px meta/mono, 11px uppercase labels. Rejected: boxed rounded-rect button chrome, filled pill actives, and border-heavy depth in place of shadows.

Two contract caveats from the 2026-07-11 blind audit (`docs/blind-audit-chrome-roadmap-2026-07-11.md`): the demo's structured thinking/plan/approval cards are a **v2 promise** — v1's Run surface is terminal-backed inside the demo's card composition, and structured cards arrive only through real agent hooks (RUN-CARDS-ADAPTER), never terminal-text inference. And demo-match claims require **populated-state proof** (live PTY output, stacked activity, multi-project sidebar) plus Jason's recorded sign-off (CHROME-EYEBALL-SIGNOFF) — empty-state screenshots and token gates alone do not certify the contract; surfaces that legitimately need more control density than the static demo shows get documented exceptions in `docs/chrome-contract.md` rather than silent divergence.

## Editor and Terminal Parity

The agent run is the product core. Its terminal process remains the trusted source of truth for Claude/Codex/Gemini/shell sessions; the editor and browser are robust supporting tools that open only when needed. The Run surface may present the visible terminal viewport cleanly — inside the demo's centered card composition — but it must never invent a provider-native transcript or imply access to hidden reasoning; structured run cards require real agent events via hooks/adapters. Detailed criteria live in `docs/editor-terminal-parity.md`.

## Agent Activity Timeline

Agent panes need Codex-style activity visibility: compact current state in pane headers, recent activity rows like `Edited a file`, aggregate rail badges, and a per-pane/session activity log. The log should show file events, command events, tool/app events, git/source-control events, approvals, errors, and completion. Hidden chain-of-thought stays out of scope; user-safe summaries, tool names, file paths, diffs, outputs, and approval states are in scope. Detailed criteria live in `docs/agent-activity-timeline.md`.

## Composer Harness

Use a bottom composer like Codex as the lightweight control surface over real panes. v0.5 routes prompts to the selected pty. v1 adds harness controls plus a terminal-backed Run view: permission mode, goal, target pane, profile selector, attachment references, stop/send state, visible terminal output, and app-owned activity logging. Structured provider messages, tool events, resumable model state, or provider-authored thinking summaries require a direct adapter, ACP, hooks, or API integration; they are not inferred from terminal text. Real Claude/Codex/Gemini terminal panes remain first-class. Research and phased scope live in `docs/composer-harness-research.md`.

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
- [x] Editor opens source files with line numbers, syntax highlighting, find/replace, dirty state, tabs, path context, save, and external-change warnings.
- [x] Editor navigation preserves active-file orientation: rail highlight/reveal, editor title/path, watcher refresh, and workspace restore stay synchronized.
- [x] Unsaved editor work is protected: per-file view state is restored, dirty drafts survive file/project switches, save failures keep the buffer, and recovery actions are explicit.
- [x] Editor parity is screenshot-verified for selected, dirty, save-error, no-file, and narrow-width states.
- [x] Terminal pane remains robust and responsive while browsing/editing files.
- [x] Recent projects and last workspace make reopening cheap.
- [x] Common file/editor/terminal actions are reachable through VS Code-style shortcuts, menu bar entries, and right-click/Control-click context menus.
- [x] Core chrome surfaces use a coherent token/icon system with hover, active, disabled, focus, loading, empty, and error states.
- [x] Composer can target the selected terminal pane, send multiline prompts safely, stop/interrupt the pane, and show target/project/session context.

## v1 done criteria

**Done:** the app replaces the current multi-window VS Code habit for normal agent work.

- [x] A persistent left project/workspace rail opens at least 3 projects in one window and shows active, running, exited, and attention-needed states.
- [x] Each project can show multiple task sessions in the rail; selecting one restores the current implemented editor context without pretending dead processes are live.
- [ ] Each chat owns independent messages, provider thread id, run state, and optional raw-terminal pane set; switching same-project chats must not mix either structured messages or terminal processes.
- [x] Browser/web preview opens localhost apps, docs, auth flows, and generated pages inside the workbench.
- [x] Each project can run multiple named agent/shell panes, and different projects can run different agents concurrently.
- [x] Pane lifecycle controls and icon badges cover thinking, running, waiting, errored, exited, restart, terminate, and attention-needed states.
- [x] Agent activity rows show observable app-owned prompts, file saves, commands, pane lifecycle, approvals, errors, and completion per pane/session.
- [ ] Provider-native structured messages, tool events, and user-safe planning summaries are supplied by an explicit adapter/hook/API path, never terminal-text heuristics.
- [x] Each pane/session exposes an app-owned agent session handle with send, interrupt, readTail, close, state, cwd, profile, approval mode, and activity metadata.
- [x] App-owned actions use a minimal action gate with risk class, approval decision, audit event, and undo/rollback hint where possible.
- [x] Composer harness supports permission mode, goal state, model/profile selector, attachments, and approval logging for app-owned actions.
- [x] The workbench hierarchy is agent-first: terminal-backed Run output plus composer owns the main surface, raw terminal is switchable, and editor/browser preview sit in left/right/bottom/hideable trays with draggable splitters.
- [x] The app shell has Keelhouse-specific chrome: top status/action bar, persistent side drawer, main agent surface, and bottom status strip.
- [x] The side drawer can switch between real Projects/Sessions and Files content without adding decorative navigation chrome.
- [x] Drawer controls switch real side-drawer content, with persisted resizable/collapsible drawers for projects, files, search, source control, browser/tools, and settings.
- [x] Session restore brings back projects, file tabs, browser URL, pane layout, and enough metadata to resume intentionally without pretending old processes are still live.
- [x] Git status is visible in the file rail for modified, untracked/new, staged, renamed, and deleted files without merging it with unsaved editor draft state.
- [x] Changed files can be reviewed in-app through a read-only unified diff view with additions/deletions and hunk-to-editor jumps when the file exists.
- [x] Lightweight Git actions support stage, unstage, discard with confirmation, and copy shown diff from file status/diff surfaces.
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
- Not a general-purpose chat/account product: the Codex-style conversation is project-scoped and action-oriented; social profiles, billing, novelty personas, and unrelated chat features stay out of scope.
- Not a general integration hub: GitHub/GitLab/source-control integrations are allowed because they support code review and shipping; unrelated services stay parked unless they directly improve agent supervision.
- Not decorative UI bloat: chrome polish means consistent workbench surfaces, states, and legibility; it does not mean marketing pages, ornamental graphics, or feature chrome that does not support the workflow.
