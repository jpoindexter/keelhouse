# Codex Multi-Chat Checkpoint

Implementation checkpoint: 2026-07-13.

## Product Correction

Native QA showed that the previous center surface was the raw PTY transcript with chat chrome. That made a project row a terminal session rather than the Codex-style independent chat Jason expected.

The corrected model separates:

- `chatConversations`: persisted user, assistant, tool, status, and error messages keyed by project + chat id.
- Codex provider identity: the `thread.started` UUID is persisted and passed to `codex exec resume --json` on later turns.
- Chat run state: start/stop/completion belongs to the chat and drives rail/title/status indicators.
- Raw terminal state: PTY panes remain optional, start lazily only when Raw terminal is opened, and never supply inferred chat structure.

## Executed Evidence

- Local `codex exec --json -s read-only` used the existing OAuth and emitted `thread.started`, `turn.started`, structured `item.completed`, and `turn.completed` events.
- Frontend build passed.
- All 178 frontend tests passed, including chat normalization, event reduction, tool rendering, title generation, and chat prompt routing.
- All 46 Rust tests passed, including new/resume command construction, sandbox mapping, and provider-thread-id validation.
- `qa:chrome-contract` passed.
- `package:mac` produced the rebuilt `Keelhouse.app`.
- The frontend allocates and persists the active run before invoking Codex, so a fast completion cannot leave the chat stuck in `Working`.
- Opening or switching chats uses `resolve_workspace`; it does not launch a hidden PTY.

## Native Criterion Pending

The rebuilt package must still execute this exact path after macOS is unlocked:

1. Create two chats under the same project.
2. Send a Codex prompt in each and verify message histories never mix.
3. Send a second prompt in each and verify the saved provider thread id resumes the correct conversation.
4. Stop one running turn and verify only that chat changes state.
5. Open raw terminal and verify it is an alternate surface, not duplicate chat content.
6. Quit/relaunch and verify both chat histories and provider thread ids restore.

The latest post-package attempt was stopped by the Mac lock screen. Build/test evidence does not complete this native criterion.
