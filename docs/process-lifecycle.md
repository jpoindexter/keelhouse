# Process Lifecycle

PROCESS-LIFECYCLE makes pane process controls explicit without turning panes into disposable fake transcripts.

## Implemented

- Backend `terminate_pane` calls the pane child killer but keeps the pane route/transcript present for the eventual exit event.
- Backend `restart_pane` validates cwd/profile, spawns a fresh process, focuses it, and then removes/kills the replaced process.
- The frontend preserves pane slot and task label across restart while replacing the stale pane id and snapshot.
- Project and session rail status updates after terminate, restart, and exit events.
- The terminal header shows profile, command, launch mode, status, cwd, New, Restart, Kill, and Close.
- Restart and Kill route through the app action gate and write activity timeline events.
- Narrow widths collapse lifecycle actions to titled icon buttons so the header does not overlap.

## Semantics

- **Restart** means replace the selected process with a new process using the same profile and cwd, preserving pane label/slot.
- **Kill** means terminate the selected process and keep the pane visible for transcript/exit review.
- **Close** means remove the selected pane from the UI and kill its process if still alive.
- **Interrupt** means send Ctrl+C through the terminal input path; it does not guarantee process termination.

## Boundaries

- Relaunch restore does not resurrect live processes; that belongs to `SESSION-RESTORE`.
- Kill-all, bulk restart, and resource ceiling measurement remain future workflow/measurement work.
- Process auth checks still belong to profile/preflight logic.

## Verification

- `npm run build`
- `npm test`
- `cargo test` with Zig 0.15 path
- `cargo fmt --check`
- `npm run qa:editor`
- Screenshot inspection of selected and narrow composer captures
- `git diff --check`
