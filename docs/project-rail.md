# Project Rail

PROJECT-RAIL is the first v1 navigation slice: multiple workspaces are represented in one left rail instead of relying on separate VS Code windows or a recents-only shortcut list.

## Implemented

- `openProjects` is persisted in `workspace.json` separately from `recentFolders`.
- The left rail shows open project rows with active, running, exited, and attention visual states.
- Opening or switching a folder promotes it into the project rail and keeps recents updated.
- Switching away snapshots the current project's editor tabs, active file, editor buffers, and editor view state for the current app session.
- Switching back restores that project's file rail through the existing workspace load path and restores its in-session editor tabs/active file.
- Missing workspace paths are pruned from both recents and open projects.
- Context menus on project rows support switch, reveal, copy path, and close project.

## Deferred

- Project session rows live in PROJECT-SESSIONS.
- Browser preview URL state is implemented by BROWSER-PREVIEW.
- Multiple live panes per project and true background-running project status live in PANE-MANAGER and PROCESS-LIFECYCLE.
- Persisted cross-relaunch editor tab/session snapshots live in SESSION-RESTORE.

## QA

Run `cd app && npm run qa:editor`. The fixture shows three project rows and the active/running, exited, and attention states in selected, context-menu, and narrow captures.
