# Command Palette

COMMAND-PALETTE adds a keyboard-first action surface without turning Keelhouse into a full IDE shell.

## Current Behavior

- `Shift+Cmd+P` opens the palette globally, including from editor and composer focus.
- The titlebar **Commands** button opens the same surface.
- The palette filters labels, details, shortcuts, ids, and keywords.
- Arrow Up/Down moves the active row; Enter runs it; Escape closes it.
- Disabled commands stay visible when context is missing, for example Save with no dirty file or Open Detected Dev Server with no detected localhost URL.

## Included Commands

The first slice runs existing app-owned actions only: Open Folder, Save, Find and Replace, Close Tab, new/restart/kill/close terminal pane, Clear Terminal, Reload Preview, Open Detected Dev Server, drawer switches, tray layout switches, and composer attachment helpers.

## Boundaries

This is not quick-open and does not search file contents. `Cmd+P`, ripgrep-backed text search, and terminal scrollback search stay with `SEARCH` and `TERMINAL-FIND`.
