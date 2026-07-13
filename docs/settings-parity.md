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
| Connections | Connections | Codex/Gemini/Claude CLI auth checks, provider API keys, GitHub/GitLab/source-host credentials, CLI health, and API endpoints where needed. |
| Git | Git | Diff/review defaults, stage/discard confirmations, branch/worktree display, source-host remote detection. |
| Environments | Environments | Per-project env vars, PATH/login-shell behavior, secret handling. |
| Worktrees | Worktrees | Defaults for creating, naming, cleaning, and launching agent panes in worktrees. |

## Scope Model

Settings that can vary by project use explicit `Global`, `Workspace`, and `Project` scopes. The UI shows the inherited source and offers a deliberate override/reset action. This applies to agent profiles, model/routing defaults, permission policy, commands, environment variables, hooks, worktree policy, and project lifecycle scripts. Appearance and app-update behavior remain global unless a real workflow proves otherwise.

## Drop

| Codex setting | Reason |
| --- | --- |
| Profile | Single-user local tool; identity belongs inside external provider/CLI auth checks. |
| Pets | Pure novelty; not part of the coding workflow. |
| Usage & billing | Billing belongs to upstream AI providers, not this local workbench. |
| Archived chats | Archive belongs in the project/chat navigation model, not a settings category. |
| Chat Settings | Per-chat draft, context, model, permission, and run state live with the selected chat; global defaults live under Agents. |

## Park

| Codex setting | Possible future equivalent |
| --- | --- |
| Appshots | Visual context capture for browser/app screenshots sent to agents, only after browser preview and agent hooks are real. |
| Computer use | Agent-controlled browser/app actions through explicit, permissioned hooks; not full desktop automation. |

## Done Criteria

- Settings has a searchable left-nav layout with grouped sections and icons.
- Settings is a dedicated full-height workspace with Back to app, not a small modal over active work.
- Every setting maps to a real app behavior or external connection check.
- Scoped settings show whether the effective value is global, workspace, project, or inherited.
- Keyboard shortcuts can be searched and rebound; command-palette sources can be enabled or disabled.
- Dropped categories do not appear in the UI.
- Parked categories remain documented but invisible unless promoted.

## Workspace Chrome Spec (revised 2026-07-13)

The first modal was a useful functional slice but is not the final settings architecture. The replacement follows the accepted Keelhouse control grammar and the useful structural findings from `docs/super-engineering-chrome-audit.md`:

- Full window content area below native/titlebar chrome; no blurred workbench visible behind it.
- A stable 230px searchable left navigation with grouped section labels and a flat `Back to app` command.
- Active navigation uses background-only selection. No decorative side stripe, capsule, or boxed icon button.
- Content uses a readable maximum width, section headings, hairline grouping, and 48px minimum setting rows.
- Global/workspace/project tabs appear only on categories that support scoping.
- Controls keep the existing 28px field grammar. Destructive actions remain explicit and confirmed; one filled primary action per surface at most.
- At narrow widths, navigation collapses into a category menu without clipping labels or controls.
