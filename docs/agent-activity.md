# Agent Activity

AGENT-ACTIVITY adds visible, Codex-style current and recent activity rows for the selected pane. It surfaces status and provenance without exposing hidden chain-of-thought.

## Implemented

- `app/src/agentActivity.ts` normalizes visible activity events with project id, session id, pane id, kind, label, detail, status, and timestamp.
- The active pane always contributes a current activity row from its agent session handle: Running, Waiting for input, Process exited, or Process error.
- Recent rows are shown in a compact horizontal strip between the terminal canvas and composer.
- Composer prompt send records `Prompt sent` with a thinking status.
- App-command routes record `Ran command` or `Command failed`.
- Successful file saves record `Edited a file`.
- Pane creation, stop, close, process exit, copy output, and non-zero exits record visible rows.
- Rows use the shared icon/status system and accessible labels. Hidden reasoning is never shown.
- QA fixture rows cover Running, Prompt sent, Edited a file, Ran command, and Command failed.

## Boundaries

- Activity rows are persisted by AGENT-ACTIVITY-LOG and scoped by project/session/pane. The compact strip still shows only the current pane's latest rows.
- Approval-specific rows become real when APP-ACTIONS-MINIMAL adds the action gate.
- Command/file/git event detection is limited to app-owned actions already observable by Keelhouse. Parsing arbitrary terminal text is out of scope for this slice.
- The row strip is provenance/status UI, not a transcript replacement.

## Verification

- `npm run build`
- `npm test`
- `cargo test` with Zig 0.15 path
- `cargo fmt --check`
- `npm run qa:editor`
- Screenshot inspection of selected and narrow captures
- `git diff --check`
