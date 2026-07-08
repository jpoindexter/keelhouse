# Settings Parity Scope

This app should borrow the Codex settings shape where it supports the lean VS Code replacement workflow, then cut account/chat/product settings that do not apply.

## Keep

| Codex setting | agent cli equivalent | Scope |
| --- | --- | --- |
| General | General | Startup folder, session restore, update/reset links, telemetry off by default. |
| Appearance | Appearance | Color theme, terminal/editor font, density, pane layout. |
| Configuration | App configuration | Ignored folders, file limits, default shell, state path, reset/export config. |
| Personalization | Behavior | Defaults for focus, restore, composer target, confirmations. |
| Keyboard shortcuts | Keyboard shortcuts | VS Code/macOS shortcut map, conflict view, overrides. |
| MCP servers | MCP servers | Local MCP server entries, enable/disable, health checks. |
| Browser | Browser preview | Localhost URL memory, external-open behavior, auth/doc preview settings. |
| Hooks | Agent hooks | Permissioned app-owned hooks/events, approvals, attribution log. |
| Connections | Connections | Claude/Codex CLI auth checks, provider API keys, GitHub/GitLab/source-host credentials, CLI health, and API endpoints where needed. |
| Git | Git | Diff/review defaults, stage/discard confirmations, branch/worktree display, source-host remote detection. |
| Environments | Environments | Per-project env vars, PATH/login-shell behavior, secret handling. |
| Worktrees | Worktrees | Defaults for creating, naming, cleaning, and launching agent panes in worktrees. |

## Drop

| Codex setting | Reason |
| --- | --- |
| Profile | Single-user local tool; identity belongs inside external provider/CLI auth checks. |
| Pets | Pure novelty; not part of the coding workflow. |
| Usage & billing | Billing belongs to upstream AI providers, not this local workbench. |
| Archived chats | The app runs real terminal agents; use pane transcripts, not chat archives. |
| Chat Settings | Do not build a custom chat product. Keep only composer routing settings. |

## Park

| Codex setting | Possible future equivalent |
| --- | --- |
| Appshots | Visual context capture for browser/app screenshots sent to agents, only after browser preview and agent hooks are real. |
| Computer use | Agent-controlled browser/app actions through explicit, permissioned hooks; not full desktop automation. |

## Done Criteria

- Settings has a searchable left-nav layout with grouped sections and icons.
- Every setting maps to a real app behavior or external connection check.
- Dropped categories do not appear in the UI.
- Parked categories remain documented but invisible unless promoted.
