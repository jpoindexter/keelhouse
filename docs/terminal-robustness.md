# Terminal Robustness

This is the v0.5 single-pane terminal robustness gate. The terminal remains a real pty parsed by `libghostty-vt`; the app does not synthesize a transcript.

## Covered Behavior

| Requirement | Evidence |
|---|---|
| Agent launch path | `codex --version` -> `codex-cli 0.141.0`, `gemini --version` -> `0.47.0`, and `claude --version` -> `2.1.197 (Claude Code)` when available; agent launch profiles run through a login shell so nvm-managed CLIs resolve. Fresh test state defaults to Codex. |
| Real pty + Ghostty parser | `open_workspace` spawns `portable-pty`, sets `TERM=xterm-256color`, and owns `Terminal`/`Encoder` on one terminal thread. |
| ANSI/truecolor | Rust test `snapshot_resolves_ansi_truecolor_cells`. |
| Alternate screen | Rust test `snapshot_reads_alternate_screen_and_restores_main_screen`. |
| Resize | Rust test `terminal_resize_updates_snapshot_dimensions` plus frontend `ResizeObserver` -> `resize_pty`. |
| Scrollback and fast output | Rust test `fast_output_preserves_scrollback_and_live_tail`; runtime path uses 5000 rows of Ghostty scrollback. |
| Selection/copy | `selection.test.ts` covers cell selection and text extraction; terminal `Cmd+C` copies only selected canvas text. |
| Paste and bracketed paste | Rust test `bracketed_paste_wraps_payload_when_terminal_mode_is_enabled`; frontend `Cmd+V` and composer send both use `paste`. |
| Common keyboard chords | Rust tests cover Ctrl+L, Option+Left/Right, and Option+Backspace; `docs/shortcuts.md` documents active terminal chords. |
| Command/cwd/status header | Terminal titlebar shows profile, command, launch mode, running/exited status, and cwd. Pane ids prevent stale exit events from overwriting a newer pane state. |
| Screenshot QA | `npm run qa:editor` captures the workbench split with terminal header/status/composer in `docs/qa/editor-parity/*.png`. |

## Manual Runtime Checklist

Run these before changing terminal internals:

```bash
cd app
PATH="/opt/homebrew/opt/zig@0.15/bin:$PATH" npm run tauri dev
```

1. Open this repo and launch Claude, Codex, and Shell profiles.
2. Confirm the terminal header updates command, cwd, and `Running`.
3. Run `printf '\e[38;2;255;80;80mred\e[0m\n'` and confirm truecolor renders.
4. Run `less README.md`, then quit, to verify alternate-screen entry/restore.
5. Run `for i in {1..300}; do echo "line $i"; done`, then use wheel and `Shift+PageUp/PageDown`.
6. Drag-select terminal text and press `Cmd+C`; paste into the composer or another editor.
7. Paste multiline text into shell/agent and confirm bracketed paste does not execute partial lines unexpectedly.
8. Resize the window and verify the prompt/cursor remain aligned.
9. Switch profiles; old pane exit events must not change the new pane status.

## Verification Commands

```bash
cd app && npm test
cd app && npm run build
cd app && npm run qa:editor
cd app/src-tauri && PATH="/opt/homebrew/opt/zig@0.15/bin:$PATH" cargo test
cd app/src-tauri && PATH="/opt/homebrew/opt/zig@0.15/bin:$PATH" cargo fmt --check
git diff --check
```

## Scrollback Find (TERMINAL-FIND, 2026-07-11)

- Backend `search_terminal_scrollback(query)` searches the focused pane's full screen space (scrollback + active area) through `Point::Screen` grid reads on the real Ghostty terminal; case-insensitive substring, 200-hit cap, replies over a per-request channel with a 1.5s timeout guard.
- `scroll_terminal_to_row(row)` jumps the viewport (Top + Delta) so a selected hit is visible; closing the find bar snaps back to the live tail.
- UI: Find control in the terminal titlebar and a `Find in Terminal` palette command open a find strip (query, match count, prev/next with wraparound, current-hit preview, Escape closes). Enter re-runs on a changed query and steps to the next hit otherwise.
- Tests: `terminal_search_finds_scrollback_and_active_rows_case_insensitive` feeds real VT bytes and asserts scrollback + active hits, case-insensitivity, and empty/blank-query behavior; `terminalFind.test.ts` covers label collapsing, wraparound navigation, and count labels.
- Boundary: regex and highlight-in-canvas rendering are deferred; the jump positions the hit row at the viewport top rather than highlighting cells.
