# Editor and Terminal Parity Scope

The app replaces the parts of VS Code/Codex that matter for agent coding work: a real source editor beside a real terminal. Neither surface can be a preview.

## Robust Editor

- CodeMirror editor with line numbers, syntax highlighting, cursor/selection fidelity, scroll stability, bracket/quote behavior, indentation, undo/redo, and save feedback.
- Breadcrumb/title area showing project and active file path.
- File tree integration with filter, folders, git/file icons, dirty/modified markers, selected file highlight, and open/reveal actions.
- Tabs for several open files with dirty indicators, close protection, and restored selection/scroll position.
- Language modes for TS, TSX/JSX, JS, Markdown, HTML, CSS, Rust, JSON, TOML, YAML, and shell scripts.
- Find/replace, go to line, quick open, file search, and active-file reveal.
- External change detection so agent edits never get overwritten silently.
- Large/binary/unsupported file policy with explicit states instead of freezes.

## Robust Terminal

- Real pty per pane using the Ghostty parser path, not a fake terminal.
- Correct rendering for Claude/Codex TUIs, alternate screen apps, ANSI/truecolor styling, resize, scrollback, mouse selection, copy, paste, bracketed paste, and common keyboard chords.
- Pane header shows profile, cwd, command, running/exited state, task label, restart, kill, and attention-needed status.
- Terminal focus behavior must coexist with editor shortcuts; conflicts are documented.
- Terminal output should remain responsive under fast logs; measure before adding WebGL or dirty-region rendering.

## Visual QA

- Verify editor with a large HTML/JSON file, a TypeScript/TSX file, Markdown, and Rust.
- Verify terminal with shell, Claude/Codex, fast output, resize, copy/paste, scrollback, and a fullscreen TUI.
- Capture screenshots for editor+file tree, editor tabs/dirty state, terminal pane, and editor/terminal split.
