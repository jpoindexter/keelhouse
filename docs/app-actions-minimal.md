# Minimal App Actions

APP-ACTIONS-MINIMAL adds a small enforcement layer for deterministic actions owned by Keelhouse. It exists so permission controls and future agent hooks have a real contract underneath them.

## Implemented

- `app/src/appActions.ts` defines action descriptors with `actionId`, kind, target, risk, requester, reason, and optional undo hint.
- The gate resolves every descriptor to an audit event with approval mode, decision, prompt state, reason, timestamp, and undo hint.
- Low-risk user actions auto-approve. Destructive actions prompt even when user-initiated. Composer/agent-originated medium and high risk actions prompt in `ask` and `approveSafe`; `fullAccess` auto-approves non-destructive in-scope actions.
- Existing app-owned paths now route through the gate: focus pane, open file, open browser preview, interrupt process, create pane, close pane, and composer app commands (`>save`, `>find`, `>open`, `>clear`).
- Prompted, denied, blocked, and composer-originated decisions are written to the activity timeline as approval audit rows.

## Current Risks

| Action | Risk | Undo/rollback |
|---|---:|---|
| Focus pane, open file, find, browser preview, attach reference | Low | Navigation is reversible by selecting the previous target; attachments can be removed. |
| Create pane, open folder, clear terminal | Medium | Close pane or switch back; terminal clear is not restored by the app. |
| Save file, interrupt process | High | Use editor/source-control undo; restart or create a pane if needed. |
| Close pane | Destructive | Create a new pane; live process state is not recoverable. |
| Open diff | Blocked until the real diff surface exists | Implement with `DIFF-VIEW`. |

## Boundaries

- This is not the full Codex permission UI. It is the enforcement/audit foundation.
- The gate does not grant external CLI permissions; Codex/Gemini/Claude still enforce their own CLI policies.
- Blocked future actions are represented in the type model but not shown as usable controls until their surfaces exist.

## Verification

- `npm run build`
- `npm test`
- `cargo test` with Zig 0.15 path
- `cargo fmt --check`
- `npm run qa:editor`
- Screenshot inspection of selected and narrow captures
- `git diff --check`
