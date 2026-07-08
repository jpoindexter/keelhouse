# Agent Activity Timeline Scope

The app should show Codex-style visible agent activity: concise state and event rows that explain what the agent is doing or just did. This is provenance and status, not hidden chain-of-thought.

## Event Types

- Thinking / planning summary: `Thinking...`, `Planning next edit`, `Reviewing output`.
- File events: `Read file`, `Edited a file`, `Created file`, `Deleted file`, `Renamed file`, `Opened diff`.
- Command events: `Ran command`, `Command finished`, `Command failed`, with cwd, exit code, and expandable output link.
- Tool/app events: `Opened browser preview`, `Focused pane`, `Created pane`, `Switched project`, `Requested approval`.
- Git/source-control events: `Viewed diff`, `Staged file`, `Discarded changes`, `Opened PR`, `Pipeline failed`.
- Attention events: `Waiting for input`, `Needs approval`, `Errored`, `Exited`, `Complete`.

## Placement

- Pane header shows the current compact state: thinking, running command, editing, waiting, errored, exited, complete.
- Pane activity strip shows recent event rows like Codex's `Edited a file`.
- Project/session rail shows aggregated badges for running, waiting, errored, exited, and attention-needed.
- Full activity log is available per pane/session with filtering by files, commands, git, approvals, and errors.

## Rules

- Show labels and icons for every event; icon-only activity is not enough.
- Attribute agent-originated actions to the pane/session/profile that caused them.
- Never display hidden chain-of-thought. Show user-safe summaries, command/tool names, file paths, diffs, outputs, approvals, and errors.
- Mutating events should link to review/undo surfaces where possible.
- Retain activity with session metadata and transcript references after the process exits.

## Visual QA

- Verify visible rows for thinking, edited file, ran command, command failed, waiting approval, and complete.
- Verify rail badges update when the active pane is not visible.
- Verify the activity log remains readable in compact and expanded pane layouts.
