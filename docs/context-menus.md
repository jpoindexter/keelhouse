# Context Menu Coverage

Keelhouse treats right-click/Control-click as a first-class macOS workflow, not a hidden-only command path. Context menus mirror existing buttons, shortcuts, and menu-bar actions where those commands already exist.

## v0.5 Surfaces

| Surface | Menu Actions | Notes |
|---|---|---|
| Workspace root | Open Folder, New File, New Folder, Reveal in Finder, Copy Workspace Path | New/reveal/copy disable when no workspace is open. |
| Project row | Switch to Project, Reveal in Finder, Copy Path, Close Project | Closing stops that project's panes, removes it from the open-project set, and switches to a fallback project. It never deletes files. |
| Recent project row | Switch to Project, Reveal in Finder, Copy Path, Remove from Recents | Removal only updates the recent-project list; it does not touch files. |
| File explorer row | Open Diff, Stage File, Unstage File, Discard Unstaged Changes, New File, New Folder, Rename, Duplicate, Reveal in Finder, Copy Path, Delete | Git actions appear only when the row has a Git marker. Delete and discard keep destructive confirmation/dirty-buffer guards. |
| Editor tab | Open, Close Tab, Reveal in Finder, Copy Path | Close Tab uses the same dirty-tab confirmation as `Cmd+W`. |
| Editor text surface | Save, Find and Replace, Open Externally, Reveal in Finder, Copy File Path | Save and Find show shortcut labels and disabled states. |
| Browser preview | Back, Forward, Reload, Open externally, Copy URL | Back/Forward disable when preview history has no matching entry. |
| Bottom utility tab | Show Terminal/Processes/Logs, mode-specific action, Hide Bottom Panel | Browser is intentionally absent because it already exists in the right tool dock. |
| Terminal pane tab | Focus, Rename, Restart, Kill, Close, Remove Worktree, Copy Working Directory | Actions disable when they do not apply; close/kill target only the selected pane. |
| Terminal surface | Copy Selection, Paste, Clear Terminal, Interrupt Process, Copy Working Directory | Copy Selection disables when no terminal text is selected. |
| Composer / agent controls | Send Draft, Clear Draft, Stop Selected Pane, Copy Target Workspace | Send and Clear disable when there is no draft. |

## Deferred Actions

Commit, push, pull, branch, PR, source-host, and multi-file staging actions remain outside this context-menu slice.

## QA

Run `cd app && npm test` for menu behavior and coverage checks. Packaged interaction QA must also right-click a utility tab and a terminal pane tab, execute Close Project, and verify immediate visible feedback.
