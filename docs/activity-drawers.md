# Activity Drawers

Verified 2026-07-09.

The side drawer now exposes six real modes without a decorative activity rail:

- **Projects:** open projects and task sessions, with active/running/exited/attention state.
- **Files:** workspace root, file/folder creation actions, and the virtualized file tree.
- **Search:** filename/path filtering over the current file tree, opening matches in the editor.
- **Git:** real `git status --short --branch` from the selected workspace, including branch, ahead/behind, staged, unstaged, untracked, and changed files.
- **Browser:** preview URL entry, back/forward/reload/open-external actions, and current preview URL.
- **Settings:** current app knobs for default pane profile, permission mode, agent surface, tool tray position, open folder, and file refresh.

The drawer width is pointer-resizable, keyboard-resizable with left/right arrows on the splitter, persisted in `localStorage`, and collapsible to icon-only mode. Collapsed state is also persisted.

Boundaries: the Git drawer proves source-control drawer behavior, but file-tree dirty/new/deleted badges remain the separate `GIT-STATUS` roadmap card. Full text search remains the later `SEARCH` card; this slice intentionally ships filename/path search only.
