# Shortcut Baseline

Keelhouse keeps VS Code/macOS muscle memory for the workflow it actually supports today. This is the v0.5 baseline, not the future configurable keybinding system.

## Active Shortcuts

| Scope | Shortcut | Action | Notes |
|---|---|---|---|
| Workspace | `Cmd+O` | Open Folder | Native folder picker; switches the active workspace and agent profile cwd. |
| Workspace | `Cmd+P` | Quick Open | Opens files by name or path in the selected workspace. |
| Editor | `Cmd+S` | Save File | Uses the guarded write path, conflict detection, and dirty-state recovery. |
| Editor | `Cmd+F` | Find/Replace | Opens CodeMirror search. `F3`, `Cmd+G`, and `Shift+Cmd+G` use the CodeMirror search keymap. |
| Editor | `Cmd+W` | Close Editor Tab | Dirty tabs still confirm before discard. |
| Terminal | `Cmd+C` | Copy Selection | Copies selected terminal text. With no selection, Keelhouse does not send Ctrl+C by accident. |
| Terminal | `Cmd+V` | Paste | Reads clipboard and sends through the bracketed-aware pty paste path. |
| Terminal | `Cmd+K` | Clear Terminal | Sends Ctrl+L to the selected pane. |
| Terminal | `Shift+PageUp` / `Shift+PageDown` | Scroll Page | Scrolls Ghostty scrollback. |
| Terminal | arrows, `Ctrl+key`, `Option+Arrow`, `Option+Backspace`, `Shift+Enter` | TUI Input | Encoded with Ghostty and passed to the real pty. |
| Composer | `Enter` | Send Draft | Sends to the selected pane or routes an app command such as `>save`. |
| Composer | `Shift+Enter` | Newline | Keeps editing the draft. |
| Composer | `Escape` | Blur Composer | Leaves the composer without discarding text. |
| Composer | `Up` / `Down` | Draft History | Recalls previous submitted drafts. |
| Chrome | `Shift+Cmd+P` | Command Palette | Opens app-owned actions; `Cmd+K` remains terminal clear. |

## Planned or Deferred

| Shortcut | Planned Action | Current Exception |
|---|---|---|
| <code>Cmd+Shift+`</code> | New terminal pane | Pane UI exists; shortcut binding remains deferred until keybinding conflicts are settled. |
| `Cmd+\` | Split terminal pane | Deferred; PANE-MANAGER uses a pane strip before split layout. |
| `Cmd+Option+Left/Right` | Move between panes/projects | Deferred until multi-pane/project focus exists. |

## Conflict Rules

- Editor and composer shortcuts win while focus is inside their surfaces.
- Terminal shortcuts apply when focus is in the terminal area or no editor/composer control owns the event.
- App-owned `Cmd` shortcuts do not get forwarded to the pty unless explicitly listed.
- Terminal-interrupt stays deliberate: use the composer `Stop` button or send Ctrl+C from inside the terminal, not accidental `Cmd+C`.
