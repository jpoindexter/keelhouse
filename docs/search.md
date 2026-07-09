# Search

SEARCH gives Keelhouse the two VS Code search behaviors that matter while supervising agents: quick file opening and project text search.

## Current Behavior

- `Cmd+P` opens Quick Open globally, including from editor and composer focus.
- Quick Open filters workspace files by name or path and opens the selected file with Enter.
- The Search drawer has **Files** and **Text** scopes.
- Files scope filters the already-loaded workspace tree.
- Text scope searches project contents after two characters, debounced in the frontend.
- Text results show file, line, column, and a one-line snippet; selecting a result opens the file and jumps to the matching line.

## Backend

The `search_workspace_text` Tauri command uses `rg --json --fixed-strings --ignore-case` when ripgrep is available. If `rg` is missing, it falls back to the same `ignore::WalkBuilder` rules used by the file tree. Both paths skip noisy dependency/build directories and cap scanned file size plus result count so the workbench stays responsive.

## Boundaries

This is project-local search only. It does not yet search terminal scrollback, closed transcripts, archived sessions, or all projects at once. Those remain with `TERMINAL-FIND`, `TRANSCRIPTS`, and later cross-project search work.
