# Parallel Chat Orchestration

## Product Contract

Parallel work is an extension of normal Keelhouse chats, not a separate dashboard. From the composer context menu or command palette, a user previews 2-8 child chats before launch. Every child has an explicit task, provider, model override, permission mode, wall-clock budget, intended files, and either the shared project or a new Git worktree.

Children are durable `ProjectSession` records linked to the parent chat and dispatch. The project rail shows child position and live status. Right-clicking a child can stop only that run, return its latest assistant result to the parent as an attributed tool message, or remove its isolated worktree after the run stops.

## Safety And Limits

- Maximum concurrent structured runs: 8 across the app.
- Child budgets: 30-3,600 seconds, enforced by the Rust process owner with exit code 124.
- Shared children warn when intended files overlap or when multiple tasks have no file boundary.
- Isolated worktree creation failures become visible child-chat errors; successful siblings still launch.
- Launch failures remain attached to the affected child and do not cancel other runs.
- Worktrees are never removed automatically; the user retains inspection and merge control.

Hashmark's spawn/parallel concepts informed the behavior, but its anonymous child loops were not copied. Keelhouse uses provider adapters, durable chat ownership, selected-run cancellation, and existing app-action gates.

## Verification Boundary

Automated coverage validates preview limits, conflict warnings, unique child identity, persisted lineage metadata, capacity for parent plus eight children, and native budget validation. Frontend production build and Rust chat-harness tests exercise the integration path. The card remains open until the packaged app executes a real multi-child launch, selective cancellation, result return, failure recovery, relaunch persistence, and worktree cleanup on an unlocked macOS session.
