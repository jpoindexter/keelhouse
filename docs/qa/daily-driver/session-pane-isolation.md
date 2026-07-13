# Session Pane Isolation

Completed in the packaged app on 2026-07-13.

## Code Evidence

- Live pane and active-pane maps are keyed by `project root + session id` through `paneContextKey`.
- Project badges aggregate all session contexts; session rows use only their owned panes.
- Creating or switching a same-project thread runs the target context through the real workspace/pane restore path without copying the outgoing pane set.
- Background pane exits update the owning session and aggregate project status.
- Deleting a thread closes only its owned backend panes and switches to the fallback context.
- `paneOwnership.test.ts` covers context keys, same-project separation, malformed keys, and project cleanup.

`npm run build`, all 176 frontend tests, all QA gates, and `npm run package:mac` pass.

## Packaged Live Evidence

As of the 2026-07-13 Codex-style chat correction, this criterion applies only to optional raw-terminal panes. Structured chat identity remains covered by `codex-multi-chat.md`.

The packaged app executed this sequence with an isolated two-chat store:

1. Isolation A opened `Alpha shell`, printed `ISOLATION-A`, and reported PID `59144`.
2. Isolation B opened `Beta shell`, printed `ISOLATION-B`, and reported PID `62755`.
3. Switching A → B → A restored only the selected pane and preserved both live processes.
4. Killing and relaunching the package terminated both old shells.
5. A restored `Alpha shell` at fresh PID `84110`; B restored `Beta shell` at fresh PID `89143`.
6. Switching back to A reported PID `84110` again, proving B did not restart or replace A.

Evidence:

- `session-pane-isolation-before-a.png`
- `session-pane-isolation-before-b.png`
- `session-pane-isolation-relaunch-a.png`
- `session-pane-isolation-relaunch-b.png`

The QA store was temporary. The pre-QA app-support directory was restored and verified against an exact copy after the run.
