# Roadmap PRD Gap Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deep-audit the product scope against Jason's real VS Code replacement workflow and add missing requirements/cards to `PRD.md`, `roadmap.json`, `ROADMAP.md`, and regenerated `roadmap.html`.

**Architecture:** Treat `PRD.md` as the product contract, `roadmap.json` as the source of truth for roadmap cards, and `roadmap.html` as generated output. The audit should classify gaps by user workflow stage, then translate only actionable gaps into card-sized roadmap slices with done criteria.

**Tech Stack:** Markdown docs, `roadmap.json`, `rockmap/build-roadmap.mjs`, Node.js JSON validation.

---

### Task 1: Build the Gap Inventory

**Files:**
- Read: `/Users/jasonpoindexter/Documents/GitHub/apps/agent cli/PRD.md`
- Read: `/Users/jasonpoindexter/Documents/GitHub/apps/agent cli/ROADMAP.md`
- Read: `/Users/jasonpoindexter/Documents/GitHub/apps/agent cli/roadmap.json`
- Read: `/Users/jasonpoindexter/Documents/GitHub/apps/agent cli/ARCHITECTURE.md`
- Read: `/Users/jasonpoindexter/Documents/GitHub/apps/agent cli/DECISIONS.md`
- Create: `/tmp/agent-cli-gap-inventory.md`

- [ ] **Step 1: Create the audit matrix**

Create `/tmp/agent-cli-gap-inventory.md` with this exact structure:

```markdown
# agent cli Gap Inventory

## Product North Star
Lean replacement for Jason's real VS Code workflow: project tabs, file explorer, file editor, and real Claude/Codex CLI terminals without the rest of VS Code.

## Workflow Stages

### 1. Open / Switch Project
- Existing cards:
- Missing cards:
- PRD gaps:

### 2. Inspect Files
- Existing cards:
- Missing cards:
- PRD gaps:

### 3. Edit Files
- Existing cards:
- Missing cards:
- PRD gaps:

### 4. Run One Agent
- Existing cards:
- Missing cards:
- PRD gaps:

### 5. Run Multiple Agents In One Project
- Existing cards:
- Missing cards:
- PRD gaps:

### 6. Work Across Multiple Projects
- Existing cards:
- Missing cards:
- PRD gaps:

### 7. Review Agent Changes
- Existing cards:
- Missing cards:
- PRD gaps:

### 8. Recover / Resume / Kill Things
- Existing cards:
- Missing cards:
- PRD gaps:

### 9. Performance / Resource Promise
- Existing cards:
- Missing cards:
- PRD gaps:

### 10. Distribution / Daily Driver
- Existing cards:
- Missing cards:
- PRD gaps:
```

- [ ] **Step 2: Fill existing cards from `roadmap.json`**

Use the current card ids and place them under the matching workflow stages:

```text
APPROOT, OPEN-FOLDER, AGENT-LAUNCH, LAST-WORKSPACE, TERMINAL-HARDEN,
APP-SHELL, FILE-RAIL, EDITOR, EDITOR-TABS, AGENT-PROFILES,
PROJECT-TABS, PANE-MANAGER, PROCESS-LIFECYCLE, SESSION-RESTORE,
GIT-STATUS, PERF-BUDGET, WORKTREE, SEARCH, COMMAND-PALETTE,
SETTINGS, THEME, PACKAGING, REUSE-AUDIT
```

- [ ] **Step 3: Record missing cards**

Add these missing card candidates to the relevant stages:

```text
FILE-OPS: create, rename, delete, duplicate, reveal in Finder, new folder.
DIFF-VIEW: review modified files and agent changes without opening VS Code.
SAVE-CONFLICTS: detect external file changes before overwriting editor content.
TERMINAL-FIND: search visible terminal/scrollback.
SCROLLBACK: real scrollback viewport, not only active grid copy.
PANE-NAMES: user-editable pane names/task labels.
AGENT-ATTENTION: detect exited/waiting/needs-input states and surface them.
NOTIFICATIONS: notify when a background agent exits or asks for input.
TRANSCRIPTS: optional pane transcript/log capture for completed sessions.
SHORTCUTS: explicit shortcut map for pane, tab, file, and editor actions.
KEYBINDINGS-CONFIG: configurable shortcut overrides later.
DRAG-DROP-FOLDERS: drag a folder onto the app to open it as a project.
RECENT-PROJECTS: quick list of recent folders/projects.
FILE-WATCHER: update rail/editor when files change on disk.
IGNORE-RULES: respect gitignore plus app-level ignored folders.
SYMLINK-POLICY: define how symlinks and external paths show in the rail.
LARGE-FILE-POLICY: avoid freezing editor on large/binary files.
BINARY-PREVIEW: safe preview for binary/image files or explicit unsupported state.
EDITOR-FIND-REPLACE: find/replace inside the editor.
EDITOR-LANGUAGE-MODES: syntax modes for TS/JS/MD/Rust/JSON/TOML first.
CLIPBOARD-INTEGRATION: copy path, copy relative path, paste files if later needed.
GIT-DIFF-GUTTERS: show changed lines in editor gutter.
GIT-ACTIONS-LITE: discard file, stage file, open diff; no full git client.
PROCESS-ENV: PATH/login shell/env handling for Claude/Codex launches.
AUTH-CHECKS: detect missing Claude/Codex auth/command and explain.
CRASH-RECOVERY: app restart after crash preserves workspace metadata.
DATA-STORAGE: define where local state lives and how to reset it.
UPDATE-ROADMAP-METRICS: define daily-driver success metrics and acceptance gates.
ACCESSIBILITY-BASICS: keyboard-only operation, focus rings, screen-reader labels for chrome.
```

- [ ] **Step 4: Rank missing cards**

Use MoSCoW:

```text
Must: FILE-OPS, DIFF-VIEW, SAVE-CONFLICTS, TERMINAL-FIND, SCROLLBACK, PANE-NAMES, AGENT-ATTENTION, SHORTCUTS, RECENT-PROJECTS, FILE-WATCHER, IGNORE-RULES, LARGE-FILE-POLICY, EDITOR-FIND-REPLACE, EDITOR-LANGUAGE-MODES, PROCESS-ENV, AUTH-CHECKS, DATA-STORAGE, UPDATE-ROADMAP-METRICS.
Should: NOTIFICATIONS, TRANSCRIPTS, DRAG-DROP-FOLDERS, SYMLINK-POLICY, BINARY-PREVIEW, GIT-DIFF-GUTTERS, GIT-ACTIONS-LITE, CRASH-RECOVERY, ACCESSIBILITY-BASICS.
Could: KEYBINDINGS-CONFIG, CLIPBOARD-INTEGRATION.
Won't before v1: full git client, debugger, extensions marketplace, LSP, remote SSH, integrated package manager UI.
```

### Task 2: Update `PRD.md` With Missing Product Requirements

**Files:**
- Modify: `/Users/jasonpoindexter/Documents/GitHub/apps/agent cli/PRD.md`

- [ ] **Step 1: Add a `Daily Workflow Requirements` section after `Core Job`**

Insert:

```markdown
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
```

- [ ] **Step 2: Replace `v0 done criteria` with explicit phase criteria**

Keep the current v0 checklist but append:

```markdown
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
```

- [ ] **Step 3: Update non-goals**

Add:

```markdown
- Not a full VS Code clone: no extension marketplace, debugger, LSP-first IDE layer, remote SSH, or full git client before the lean workflow is daily-drivable.
- Not a task database: pane names/status/transcripts exist only to orient agent work, not to become project management software.
```

### Task 3: Expand `roadmap.json` With Missing Cards

**Files:**
- Modify: `/Users/jasonpoindexter/Documents/GitHub/apps/agent cli/roadmap.json`

- [ ] **Step 1: Add the following `v0` cards after `TERMINAL-HARDEN`**

```json
{
  "id": "PROCESS-ENV",
  "title": "Agent launch env and auth checks",
  "column": "now",
  "tier": "rock",
  "track": "core",
  "size": "M",
  "launch": "v0",
  "blocker": true,
  "summary": "Claude/Codex must launch with the same PATH/auth expectations as a normal terminal. Detect missing binaries, auth failures, and bad cwd before dumping the user into a dead pane.",
  "done": "Launching Claude from a picked folder finds the expected command, inherits a useful login-shell environment, reports missing command/auth clearly, and does not create zombie panes on failure."
}
```

```json
{
  "id": "DATA-STORAGE",
  "title": "Local state storage and reset",
  "column": "now",
  "tier": "pebble",
  "track": "workspace",
  "size": "S",
  "launch": "v0",
  "summary": "Define where workspace/session state lives and how to reset it when the app gets confused.",
  "done": "The app stores last workspace/recent project metadata in one documented local location and has a manual reset path for corrupted state."
}
```

- [ ] **Step 2: Add the following `v0_5` cards**

Add after `FILE-RAIL`:

```json
{
  "id": "FILE-WATCHER",
  "title": "File watcher and ignore rules",
  "column": "next",
  "tier": "rock",
  "track": "files",
  "size": "M",
  "launch": "v0_5",
  "blocker": true,
  "summary": "The rail must reflect real project changes without drowning in node_modules, target, build output, or ignored files.",
  "done": "File changes from agents or external tools update the rail; gitignore and app ignore rules are respected; large/noisy folders do not freeze the UI."
}
```

Add after `EDITOR`:

```json
{
  "id": "EDITOR-FIND-REPLACE",
  "title": "Editor find and replace",
  "column": "next",
  "tier": "pebble",
  "track": "files",
  "size": "S",
  "launch": "v0_5",
  "summary": "Basic file editing needs local find/replace; otherwise the editor is too thin to replace the VS Code surface Jason actually uses.",
  "done": "Find, next/previous result, replace one, and replace all work in the active editor without breaking terminal focus shortcuts."
}
```

```json
{
  "id": "SAVE-CONFLICTS",
  "title": "External change and save conflict handling",
  "column": "next",
  "tier": "rock",
  "track": "files",
  "size": "M",
  "launch": "v0_5",
  "blocker": true,
  "summary": "Agents and terminals can edit files while the editor is open. The app must not silently overwrite external changes.",
  "done": "If a file changes on disk after opening, the editor warns before overwrite and offers reload/overwrite choices."
}
```

```json
{
  "id": "FILE-OPS",
  "title": "Basic file operations",
  "column": "next",
  "tier": "pebble",
  "track": "files",
  "size": "M",
  "launch": "v0_5",
  "summary": "Replacing the VS Code shell requires basic rail operations, not only open-file.",
  "done": "Create file, create folder, rename, delete, duplicate, and reveal in Finder work from the rail with confirmation for destructive operations."
}
```

Add after `AGENT-PROFILES`:

```json
{
  "id": "SHORTCUTS",
  "title": "Shortcut map for core workflow",
  "column": "next",
  "tier": "pebble",
  "track": "ui",
  "size": "S",
  "launch": "v0_5",
  "summary": "The app needs predictable keyboard access for open folder, file search, save, copy/paste, new pane, switch pane, and terminal focus.",
  "done": "A documented shortcut map covers the v0.5 workflow and avoids conflicts between terminal, editor, and app chrome."
}
```

- [ ] **Step 3: Add the following `v1` cards**

Add after `PANE-MANAGER`:

```json
{
  "id": "PANE-NAMES",
  "title": "Pane names and task labels",
  "column": "next",
  "tier": "pebble",
  "track": "core",
  "size": "S",
  "launch": "v1",
  "summary": "When several agents run in one project, each pane needs a human label so Jason can remember what it is doing.",
  "done": "Each pane has an editable name/task label shown in the pane header and restored across relaunch."
}
```

```json
{
  "id": "AGENT-ATTENTION",
  "title": "Agent attention and completion state",
  "column": "next",
  "tier": "rock",
  "track": "core",
  "size": "M",
  "launch": "v1",
  "summary": "Background agents need visible status when they exit, wait for input, or need attention.",
  "done": "Pane/project tabs show running, exited, and needs-attention states; background changes are visible without polling every pane manually."
}
```

Add after `GIT-STATUS`:

```json
{
  "id": "DIFF-VIEW",
  "title": "Diff view for agent changes",
  "column": "next",
  "tier": "rock",
  "track": "files",
  "size": "M",
  "launch": "v1",
  "summary": "Jason supervises agents by reading what changed. A file status marker is not enough; he needs to inspect diffs without opening VS Code.",
  "done": "Modified files open a readable diff view with additions/deletions; the editor can jump from a diff hunk to the file."
}
```

```json
{
  "id": "GIT-ACTIONS-LITE",
  "title": "Lightweight git review actions",
  "column": "next",
  "tier": "pebble",
  "track": "files",
  "size": "S",
  "launch": "v1",
  "summary": "Add only the git actions needed to review/clean agent work, not a full git client.",
  "done": "Stage file, unstage file, discard file with confirmation, and copy diff are available from file status/diff surfaces."
}
```

Add after `PERF-BUDGET`:

```json
{
  "id": "DAILY-DRIVER-METRICS",
  "title": "Daily-driver success metrics",
  "column": "next",
  "tier": "pebble",
  "track": "quality",
  "size": "S",
  "launch": "v1",
  "summary": "Define how to know the app is actually replacing the VS Code workflow instead of just existing.",
  "done": "Track project opens, agent pane starts, editor saves, crashes, memory/CPU snapshots, and whether Jason can complete a normal multi-project work block without opening VS Code."
}
```

- [ ] **Step 4: Add the following `v2` cards**

Add near `SEARCH`:

```json
{
  "id": "TERMINAL-FIND",
  "title": "Find in terminal scrollback",
  "column": "later",
  "tier": "pebble",
  "track": "core",
  "size": "M",
  "launch": "v2",
  "summary": "Agent output can be long. Search inside terminal scrollback is necessary for reviewing logs and prior agent output.",
  "done": "Find text in the active pane scrollback, jump next/previous, and preserve terminal focus behavior."
}
```

```json
{
  "id": "SCROLLBACK",
  "title": "Real scrollback viewport",
  "column": "later",
  "tier": "rock",
  "track": "core",
  "size": "M",
  "launch": "v2",
  "summary": "The spike copies from the active grid. Daily use needs scrollback navigation and selection beyond the visible viewport.",
  "done": "Mouse wheel/trackpad scrolls terminal history, selection works across scrollback, and fast output does not break the viewport."
}
```

Add near `SETTINGS`:

```json
{
  "id": "NOTIFICATIONS",
  "title": "Background agent notifications",
  "column": "later",
  "tier": "sand",
  "track": "ui",
  "size": "S",
  "launch": "v2",
  "summary": "When an agent in another project or pane stops or needs input, Jason should not have to manually inspect every pane.",
  "done": "Background panes can surface in-app badges and optional macOS notifications for exit/attention events."
}
```

```json
{
  "id": "TRANSCRIPTS",
  "title": "Pane transcript capture",
  "column": "later",
  "tier": "sand",
  "track": "core",
  "size": "S",
  "launch": "v2",
  "summary": "Completed agent sessions should be reviewable after the process exits without keeping panes open forever.",
  "done": "A pane can save a plain-text transcript/log path for later review, with clear retention/reset behavior."
}
```

### Task 4: Update `ROADMAP.md` Narrative

**Files:**
- Modify: `/Users/jasonpoindexter/Documents/GitHub/apps/agent cli/ROADMAP.md`

- [ ] **Step 1: Update v0 list**

Add:

```markdown
8. **PROCESS-ENV:** launch env/PATH/auth checks for Claude/Codex.
9. **DATA-STORAGE:** documented local state location and reset path.
```

- [ ] **Step 2: Update v0.5 list**

Add:

```markdown
- **FILE-WATCHER:** live rail updates, gitignore/app ignores, noisy-folder protection.
- **EDITOR-FIND-REPLACE:** local find/replace inside files.
- **SAVE-CONFLICTS:** detect external file edits before overwrite.
- **FILE-OPS:** create/rename/delete/duplicate/reveal from rail.
- **SHORTCUTS:** documented core shortcut map across terminal/editor/chrome.
```

- [ ] **Step 3: Update v1 list**

Add:

```markdown
- **PANE-NAMES:** pane names and task labels.
- **AGENT-ATTENTION:** visible exited/needs-input state.
- **DIFF-VIEW:** inspect agent-created changes without VS Code.
- **GIT-ACTIONS-LITE:** stage/unstage/discard/copy diff; not a full git client.
- **DAILY-DRIVER-METRICS:** prove the app can replace the current workflow.
```

- [ ] **Step 4: Update v2 list**

Add:

```markdown
- **SCROLLBACK:** real terminal scrollback viewport and scrollback selection.
- **TERMINAL-FIND:** search active terminal output/scrollback.
- **NOTIFICATIONS:** background agent exit/attention badges and optional macOS notifications.
- **TRANSCRIPTS:** save/review completed pane output.
```

### Task 5: Rebuild and Verify

**Files:**
- Modify generated: `/Users/jasonpoindexter/Documents/GitHub/apps/agent cli/roadmap.html`

- [ ] **Step 1: Validate JSON**

Run:

```bash
node -e "JSON.parse(require('fs').readFileSync('roadmap.json','utf8')); console.log('roadmap ok')"
```

Expected output:

```text
roadmap ok
```

- [ ] **Step 2: Rebuild HTML**

Run:

```bash
node rockmap/build-roadmap.mjs roadmap.json roadmap.html
```

Expected output includes:

```text
rockmap: wrote roadmap.html
```

- [ ] **Step 3: Inspect card counts**

Run:

```bash
node - <<'NODE'
const r = JSON.parse(require('fs').readFileSync('roadmap.json','utf8'));
console.log('cards', r.cards.length);
console.log('now', r.cards.filter(c => c.column === 'now').map(c => c.id).join(', '));
console.log('next', r.cards.filter(c => c.column === 'next').map(c => c.id).join(', '));
console.log('later', r.cards.filter(c => c.column === 'later').map(c => c.id).join(', '));
NODE
```

Expected: active card count increases from 23 to at least 42, with the new cards distributed across v0/v0.5/v1/v2.

- [ ] **Step 4: Search for required concepts**

Run:

```bash
rg -n "DIFF-VIEW|FILE-OPS|AGENT-ATTENTION|TERMINAL-FIND|SCROLLBACK|DAILY-DRIVER-METRICS|SAVE-CONFLICTS|PROCESS-ENV" PRD.md ROADMAP.md roadmap.json roadmap.html
```

Expected: each concept appears in `roadmap.json` and `roadmap.html`; PRD-level concepts appear in `PRD.md`.

- [ ] **Step 5: Check git status**

Run:

```bash
git status --short PRD.md ROADMAP.md roadmap.json roadmap.html
```

Expected: only intended roadmap/PRD files are listed for this task.

### Task 6: Self-Review

**Files:**
- Read: `/tmp/agent-cli-gap-inventory.md`
- Read: `/Users/jasonpoindexter/Documents/GitHub/apps/agent cli/PRD.md`
- Read: `/Users/jasonpoindexter/Documents/GitHub/apps/agent cli/roadmap.json`

- [ ] **Step 1: Coverage check**

Confirm every `Must` item from the inventory maps to either a PRD requirement or a roadmap card.

- [ ] **Step 2: Scope check**

Confirm no card attempts to turn the app into a full VS Code clone. The explicit won't-before-v1/non-goals remain:

```text
full git client, debugger, extension marketplace, LSP-first IDE layer, remote SSH, integrated package manager UI
```

- [ ] **Step 3: Sequencing check**

Confirm the sequence still protects the core path:

```text
v0 terminal/process foundation
v0.5 file rail/editor shell
v1 multi-project/multi-agent review workflow
v2 resilience/search/notifications/transcripts
v3 polish/packaging/reuse audit
```
