# Context Menu Coverage

Keelhouse treats right-click/Control-click as a first-class macOS workflow, not a hidden-only command path. Context menus mirror existing buttons, shortcuts, and menu-bar actions where those commands already exist.

## v0.5 Surfaces

| Surface | Menu Actions | Notes |
|---|---|---|
| Workspace root | Open Folder, New File, New Folder, Reveal in Finder, Copy Workspace Path | New/reveal/copy disable when no workspace is open. |
| Recent project row | Switch to Project, Reveal in Finder, Copy Path, Remove from Recents | Removal only updates the recent-project list; it does not touch files. |
| File explorer row | New File, New Folder, Rename, Duplicate, Reveal in Finder, Copy Path, Delete | Delete keeps the existing destructive confirmation and dirty-buffer guard. |
| Editor tab | Open, Close Tab, Reveal in Finder, Copy Path | Close Tab uses the same dirty-tab confirmation as `Cmd+W`. |
| Editor text surface | Save, Find and Replace, Open Externally, Reveal in Finder, Copy File Path | Save and Find show shortcut labels and disabled states. |
| Terminal pane | Copy Selection, Paste, Clear Terminal, Interrupt Process, Copy Working Directory | Copy Selection disables when no terminal text is selected. |
| Composer / agent controls | Send Draft, Clear Draft, Stop Selected Pane, Copy Target Workspace | Send and Clear disable when there is no draft. |

## Deferred Surfaces

Browser preview and diff/git surfaces are still roadmap cards, so their menus are not faked in v0.5. Add their context menus when `BROWSER-PREVIEW`, `DIFF-VIEW`, `GIT-STATUS`, and `GIT-ACTIONS-LITE` create real surfaces and commands.

## QA

Run `cd app && npm run qa:editor` to refresh screenshot artifacts. The `context-menu` capture shows the production menu styling, shortcut column, and editor-surface action set.
