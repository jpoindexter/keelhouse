# Agent Activity Log

AGENT-ACTIVITY-LOG makes pane activity durable and inspectable. It extends the compact activity strip with a per-pane/session timeline stored in Tauri Store.

## Implemented

- `agentActivityEvents` persists up to 200 recent events with project id, project session id, pane id, kind, label, detail, status, timestamp, and optional target, exit code, output reference, and undo hint.
- The active pane shows a scrollable timeline below the recent activity strip.
- Timeline filters cover All, Prompts, Process, Commands, Files, Tools, Git, App, Approvals, Browser, Errors, and Complete.
- Stored events are normalized on startup; malformed rows, unknown kinds, invalid statuses, and invalid timestamps are dropped.
- Command exit events record cwd target, exit code, terminal output reference, and success/error status.
- The QA fixture includes timeline rows for prompt, file, and command failure states.

## Boundaries

- The log only records app-owned events Keelhouse can observe today: prompts, app commands, file saves, pane lifecycle actions, copied output, and process exits.
- Approval audit rows are produced by `APP-ACTIONS-MINIMAL`. Git/source-control, tool, diff, richer browser action, and undo links have reserved event fields and filters, but their producers become real with `DIFF-VIEW`, `GIT-STATUS`, `GIT-ACTIONS-LITE`, and browser/action cards.
- Hidden chain-of-thought is never stored. User-safe summaries, command names, paths, outputs, statuses, and approval decisions are the durable surface.

## Verification

- `npm run build`
- `npm test`
- `cargo test` with Zig 0.15 path
- `cargo fmt --check`
- `npm run qa:editor`
- Screenshot inspection of selected and narrow captures
- `git diff --check`
