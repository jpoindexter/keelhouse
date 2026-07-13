# Chat History Discovery

Status: executed in the packaged macOS app on 2026-07-13.

## Behavior

- Search covers chat titles and SQLite-backed message text across every open project.
- Message results retain stable `chatId` and `messageId` targets. Opening a result switches project/chat, scrolls to the matching turn, and focuses it.
- Bookmarks are message properties stored in SQLite and can be filtered globally.
- Pin and archive state remain session metadata in the Tauri project store. Pinned chats sort first within their project; archived chats remain searchable and reopen without changing provider thread identity.

## Data Ownership

Rust owns message queries, bookmark persistence, schema migration, snippets, and result limits in `app/src-tauri/src/chat_store.rs`. React merges those hits with project and session metadata for titles, pin order, archive labels, and navigation. Search accepts 2-200 characters, returns at most 100 rows, and excludes status-only messages.

## Executed Proof

The packaged app searched `CHAT-A-ONE` across projects and opened the exact matching message. It bookmarked that message, pinned and archived `New chat 6`, found the archived chat by title, reopened it, and preserved bookmark/archive/pin state after quit and relaunch. Before QA, the app-support directory was copied to `/tmp/keelhouse-chat-history-qa-20260713-192810`; afterward the original user state was restored and verified.

Automated coverage includes SQLite v1-to-v2 migration without history loss, cross-project snippets, bookmark persistence, 3,000-message query latency, frontend merge/filter/navigation behavior, and production wiring. Required gates are `npm test -- --run`, `npm run build`, `cargo test`, and `git diff --check`.
