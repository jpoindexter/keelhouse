# Demo Feature Parity Audit

**Date:** 2026-07-14  
**Contract:** `demo/keelhouse-chrome-demo.html`  
**Compared with:** current React/Tauri shell, product docs, tests, and roadmap

## Verdict

The current app implements the demo's primary product shape: projects and chats at left, structured conversation and composer in the center, Files/Editor/Browser/Git at right, Terminal/Processes/Logs below, and a compact status strip. The largest remaining mismatch is behavioral completeness around chats and project acquisition, not another shell redesign.

## Feature Matrix

| Area | Demo behavior | Current status | Roadmap result |
| --- | --- | --- | --- |
| Project/chat rail | grouped projects, chats, recency, selection | Present; adds search, pin, archive, bookmarks, lineage | Existing cards cover it |
| Conversation | user/assistant turns, thinking, plans, edits, approvals | Present from provider/app/hook events; terminal text is not fabricated | Existing `CHAT-RICH-MESSAGES`, `RUN-CARDS-ADAPTER` |
| Composer | attach, permission, goal, model, reasoning, send/stop | Present and persisted per chat | Existing `CHAT-COMPOSER-CONTEXT` |
| Right dock | Files, Editor, Browser, Git | Present, resizable, movable, collapsible | Existing chrome/tray cards |
| Bottom tray | Terminal, Processes, Logs | Present; raw Terminal opens a login shell | Existing tray/process cards |
| Long-history navigation | thin tick rail with preview and jump | Missing | New `CHAT-HISTORY-MINIMAP` |
| Chat actions | new-window, fork, rename, stop, export | Partial; lifecycle actions are split and export/new-window are absent | New `CHAT-ACTION-MENU`, `CHAT-TRANSCRIPT-EXPORT`, `MULTI-WINDOW-CHAT` |
| Create workflow | new chat, open project, clone, browser, review | Partial; clone is absent, other actions exist through direct controls/palette | New `CLONE-REPOSITORY` |
| Project commands | search, switch, recent worktree | Present through palette, rail, and worktree flows | No new card |
| Settings | general, appearance, agents, MCP, Git, shortcuts | Present and broader, with Global/Project/Chat scope | Existing `SETTINGS-PARITY`, `AI-CONNECTIONS` |
| Status strip | branch/sync/errors/provider/tools/file/formatter | Partial; repo/provider are real, remaining signals are incomplete | New `WORKSPACE-STATUS-SIGNALS` |
| Context menus | projects, chats, files, tabs, terminal, browser, Git | Present with shared commands; chat entry points need consolidation | New `CHAT-ACTION-MENU` |

## Intentional Departures

- No duplicate **Browser Preview** in the bottom tray; Browser belongs in the right dock.
- No fake **Prettier**, diagnostic count, sync, provider, or activity labels.
- No decorative side activity rail or fabricated hidden reasoning.
- No separate file-preview product surface; the Editor tray already owns inspect/edit/review.
- No plugin marketplace, account/billing, debugger, or full VS Code extension model.

## Build Order

1. Finish the open chrome/native verification gates and packaged workflows already ahead of this audit.
2. Consolidate chat actions so later features have one command path.
3. Add the history minimap on the durable SQLite message store.
4. Add deterministic structured transcript export.
5. Complete truthful workspace status signals.
6. Add clone-and-open repository flow.
7. Add separate native chat windows last because shared chat/run/pane ownership is the highest-risk state change.

## Evidence Boundary

This audit is based on source and product-contract inspection. It proves roadmap coverage and identifies implementation deltas; it does not claim the six new behaviors are implemented or that the packaged app has received final visual sign-off.
