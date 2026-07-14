# Project Sessions

PROJECT-SESSIONS originally translated Codex chat rows into task-scoped workbench sessions. That model was superseded on 2026-07-13: the rows are real chats with independent structured messages and provider thread identity. The existing `ProjectSession` type and `projectSessions` storage key remain compatibility names for chat metadata and task-scoped workbench state; they are not the product noun.

## Implemented

- `projectSessions` and `activeSessionByProject` are persisted in `workspace.json`.
- Each open project gets at least one default session row.
- Project rows now show nested session rows with active, running, exited, and attention states.
- `New session` creates a named task context and selects it.
- Chat context menus support switch, rename, copy name, pin/archive/delete, and safe workspace checkpoint capture/restore. The last live chat in a project cannot be deleted or archived.
- Completed user and assistant messages expose a branch action. A fork is a linked durable chat with message-bounded history and an independent provider thread.
- Forked chats carry a non-index-mutating workspace checkpoint when capture succeeds; restore is previewed, protects dirty buffers, and creates a retained recovery checkpoint.
- Session lists show three rows by default and expose `Show more` / `Show fewer` when older sessions are hidden.
- Selecting a session snapshots the current session's editor tabs, active file, buffers, and editor view state, then restores the selected session's in-memory editor context.
- Switching projects selects that project's active session and uses the same real workspace-load path as the project rail.
- Pane exits and launch/profile failures update the active session status so session rows do not claim a dead process is still running.

## Deferred

- Browser preview URL memory is implemented by BROWSER-PREVIEW.
- Multiple live panes are implemented by PANE-MANAGER. Pane labels are implemented by PANE-NAMES and persist by project session plus pane slot. Pane layout/process restore and richer background process state belong to SESSION-RESTORE and PROCESS-LIFECYCLE.
- Transcript references and full activity history belong to TRANSCRIPTS and AGENT-ACTIVITY-LOG.
- Cross-relaunch restoration of editor/session snapshots belongs to SESSION-RESTORE.

## QA

Run `cd app && npm run qa:editor`. The fixture shows nested sessions, active/exited/attention status, and collapsed session rows in the project rail.
