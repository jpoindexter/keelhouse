# Pane Manager

PANE-MANAGER adds real multi-pane terminal support without turning the terminal into a fake transcript view.

## Implemented

- Backend `PtyState` now owns multiple live `Pane` handles keyed by pane id.
- `open_workspace` spawns and focuses a pane without killing panes from other projects.
- `create_pane` launches an additional Claude/Codex/Shell pane in the active workspace.
- `focus_pane` routes keyboard, paste, scroll, and resize input to the selected pane.
- `close_pane` kills one pane process, removes its route, and focuses a remaining pane when available.
- Grid events include `paneId`; the frontend caches snapshots by pane and paints only the focused pane.
- The terminal header shows a pane strip, active pane state, New pane profile selector, New, and Close controls.
- Project/session running/exited/attention state aggregates all panes for that project, so switching projects does not imply background panes stopped.

## Deliberate Boundaries

- Pane names and task labels are implemented by `PANE-NAMES`.
- Restart, kill-all, and richer lifecycle controls belong to `PROCESS-LIFECYCLE`.
- Cross-relaunch pane layout restore belongs to `SESSION-RESTORE`.
- App-owned send/readTail/session APIs belong to `AGENT-SESSION-HANDLE`.

## Verification

- `npm run build`
- `npm test`
- `cargo test` with Zig 0.15 path
- `npm run qa:editor`
- Screenshot inspection of selected and narrow QA captures
