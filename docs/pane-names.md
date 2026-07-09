# Pane Names

PANE-NAMES makes terminal panes identifiable by task, not just by launch profile.

## Implemented

- Each `ManagedTerminalPane` has a stable `slot` and optional custom `label`.
- Pane labels are normalized before storage: trim, collapse whitespace, ignore empty values, and cap at 48 characters.
- The terminal pane strip displays the custom label when present, otherwise it falls back to `Claude 1`, `Codex 2`, or `Shell 3`.
- Double-clicking a pane button opens the rename prompt.
- The terminal context menu exposes `Rename Selected Pane`.
- The agent composer target shows the selected pane label, so send-target context matches the pane strip.
- Labels persist in Tauri Store under `paneLabelsBySession`, keyed by project path plus active session id and pane slot.

## Boundaries

- Labels are restored by session and slot only. If the user deletes panes or reorders future layouts, the label follows the slot.
- Live process restart, pane layout restore, transcript recovery, and agent session handles are separate roadmap slices.
- Blank rename input clears the custom label and returns the pane to its profile/index fallback.

## Verification

- `npm run build`
- `npm test`
- `npm run qa:editor`
- Screenshot inspection of selected and narrow QA captures
