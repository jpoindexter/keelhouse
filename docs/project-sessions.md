# Project Sessions

PROJECT-SESSIONS translates Codex chat rows into task-scoped workbench sessions under each open project. They are not editor tabs and not custom chat threads.

## Implemented

- `projectSessions` and `activeSessionByProject` are persisted in `workspace.json`.
- Each open project gets at least one default session row.
- Project rows now show nested session rows with active, running, exited, and attention states.
- `New session` creates a named task context and selects it.
- Session context menus support switch, rename, copy name, and delete. The last session in a project cannot be deleted.
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
