# Durable Chat Store Proof

Date: 2026-07-13
Card: `CHAT-DURABLE-STORE`

## Executed Path

1. Built and launched the packaged macOS app with a real legacy `workspace.json` containing two chats and 29 messages.
2. Confirmed the one-time import removed the legacy key only after SQLite contained two chats, 29 messages, and both provider thread ids in WAL mode.
3. Sent `Reply with exactly SQLITE-LIVE-OK-2.` through the restored Codex chat and observed the exact structured response.
4. Quit and relaunched the packaged app, then confirmed the original reply and the new response both rendered in order.
5. Queried the database after relaunch: two chats, 32 messages, two provider thread ids, one usage row, and `journal_mode=wal`.

The first smoke exposed provider item-id reuse across resumed runs (`item_0`) overwriting an older assistant message. Message identity is now scoped by run id, the legacy backup was restored, and a regression test covers the collision before the successful run above.

## Automated Coverage

- Rust: one-time migration, transactional rollback, stale revision rejection, cascade delete, concurrent chats, interrupted-run recovery, and malformed usage.
- Frontend: normalization, run-state transitions, usage persistence, and reused provider item ids.
- Gates: `cargo fmt --check`, `cargo test`, `npm test`, `npm run build`, `npm run qa:chrome-contract`, and `npm run package:mac`.

This proves durable chat behavior for the executed Codex path. It does not complete rich Markdown/tool rendering, provider approvals, history search, or Jason's visual chrome sign-off.
