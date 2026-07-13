# Super Engineering Chrome Audit

Audited 2026-07-13 from `/Applications/super.engineering.app` using package inspection and live interaction. Super Engineering is a signed native arm64 Rust/GPUI app. It renders its shell through AppKit/Metal and uses WebKit for web content. It is a reference, not a dependency or code source.

## What Is Better

| Area | Super Engineering | Keelhouse delta | Decision |
| --- | --- | --- | --- |
| Persistent chrome | Four quiet top-left controls and a content-first canvas | Titlebar, Threads, dock tabs, tray tabs, status, and composer compete at once | Reduce permanent titlebar information; keep project/chat navigation and trays because they are core |
| Settings | Full searchable workspace with stable navigation | Small 900x560 modal with six broad categories | Adopt a dedicated settings workspace |
| Scope | Global, workspace, and project tabs for agents, commands, and profiles | Mostly active-workspace settings | Adopt explicit scope and inheritance |
| Agent setup | Chat UI vs terminal default, provider routing, profiles, launch behavior | Provider controls are split between composer and basic settings | Consolidate under Agents and Profiles; keep Chat as the default |
| Shortcuts | Searchable, rebindable list with conflict/source state | Reference plus partial override support | Match the discoverability, not every command |
| Command palette | Configurable sources: files, worktrees, tabs, commands, breadcrumbs | One palette with fixed source behavior | Add source filters and shared command registry metadata |
| Worktrees | Location, cleanup, syncing, naming, and lifecycle policy | Basic create/remove flow | Add policy and lifecycle settings after safety checks |
| Project automation | Setup, run, pre-cleanup, teardown, post-cleanup scripts | Hooks card is generic | Use these five explicit lifecycle slots |
| Feedback | Restrained centered modals and bottom-right toasts | Recovery toast is visually heavier and can cover work | Adopt compact non-blocking toast placement and modal rhythm |

## Keep From Keelhouse

- Project-grouped chats remain the primary navigation object. Super is worktree-first; Keelhouse is conversation-first.
- Structured chat and composer remain the center. Raw terminal stays an alternate utility, not the default new tab.
- Files, Editor, Browser, Git, Terminal, Processes, and Logs remain resizable trays. Super's sparse home cannot replace the daily workbench.
- Keep Keelhouse's dark graphite palette and accessible DOM semantics. Super's live GPUI surface exposed very little accessibility structure during inspection.

## Reject

- Do not copy Super's pale palette, oversized empty home canvas, rounded onboarding action cards, worktree-first object model, or provider action taxonomy.
- Do not migrate to GPUI for visual similarity. The current Tauri/React architecture already owns working chat, terminal, editor, browser, and accessibility paths.
- Do not expose setup/cleanup scripts until preview, confirmation, and failure recovery are defined.

## Build Consequence

Add one settings-shell card before connection and hook implementation. Then implement AI connections, agent profiles, lifecycle hooks, worktree policy, and command/shortcut discoverability inside that shared scoped settings architecture. Treat the quiet titlebar and toast rhythm as corrections for the next human chrome sign-off, not as a second visual redesign.
