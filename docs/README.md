# Keelhouse Docs

Keelhouse is the product name. The repo, package, binary, app identifier, and local-state slug remain `agent-cli` until an explicit migration.

## Naming

- Product name: **Keelhouse**
- Category: native agent workbench
- Repo/package/storage slug: `agent-cli`
- Naming source of truth: `product-positioning.md`

## Start Here

- `../README.md`: product overview, local run commands, and repository map.
- `../PRD.md`: product requirements, scope boundaries, and release criteria.
- `../ROADMAP.md`: readable roadmap companion to `../roadmap.json`.
- `../STATE.md`: current handoff, verified slices, and next execution step.
- `product-positioning.md`: name decision, one-liner, and language rules.
- `reference-products.md`: source-backed reference products and what Keelhouse should borrow or reject.
- `zed-reference-framework.md`: local Zed source audit and Keelhouse workbench-shell translation.

## Product Scope

- `settings-parity.md`: Codex-inspired settings shape; kept, dropped, and parked sections.
- `navigation-parity.md`: project/session rail model and Codex sidebar translation.
- `project-rail.md`: v1 open-project rail implementation and deferred session/pane work.
- `project-sessions.md`: v1 named workbench session rows under projects.
- `browser-preview.md`: v1 lightweight browser/web preview pane.
- `pane-manager.md`: v1 real multi-pane terminal manager.
- `pane-names.md`: v1 editable terminal pane names/task labels.
- `process-lifecycle.md`: v1 restart, kill, close, status, command, and cwd controls.
- `integrations-scope.md`: Git, GitHub, GitLab, and adapter-lane boundaries.
- `composer-harness-research.md`: bottom composer and future harness scope.
- `composer-harness.md`: v1 implemented composer permission, goal, profile, and attachment controls.
- `harness-contract.md`: app-owned pane/session handle contract.
- `agent-hooks.md`: permissioned loopback MCP endpoint, tool catalog, and security boundary.
- `app-actions-minimal.md`: v1 app-owned action gate and audit contract.
- `agent-session-handle.md`: v1 implemented pane/session handle layer.
- `agent-activity.md`: v1 visible current/recent agent activity rows.
- `agent-activity-log.md`: v1 durable, filterable pane/session activity timeline.
- `activity-drawers.md`: v1 functional side-drawer modes for Projects, Files, Search, Git, Browser, and Settings.
- `diff-view.md`: v1 read-only Git diff review from Source Control and file rail Git markers.
- `git-actions-lite.md`: v1 minimal stage, unstage, discard, and copy-diff actions.
- `shortcuts.md`: active v0.5 shortcut map and planned exceptions.
- `search.md`: Cmd+P quick-open plus project file/text search behavior.
- `chat-history-discovery.md`: global chat/message search, bookmarks, pin/archive behavior, and packaged persistence proof.
- `context-menus.md`: right-click/Control-click coverage and deferred Git mutation actions.
- `chrome-polish-system.md`: current token/state system and deferred chrome surfaces.
- `reuse-audit.md`: 2026-07-12 audit of spike/reference reuse vs parked material.
- `chrome-delta-audit.md`: 2026-07-11 audit of the drift from the accepted demo that drove the chrome re-convergence cards.
- `codex-chrome-extraction-2026-07-13.md`: source-grounded extraction of the installed Codex shell and Keelhouse adopt/adapt/reject mapping.
- `blind-audit-chrome-roadmap-2026-07-11.md`: 16-framework blind-spot audit of the re-convergence and roadmap coverage; source of cards 93-106 and the contract caveats.
- `icon-system.md`: SVG icon family, status mapping, and QA fixture coverage.
- `accessibility-basics.md`: v0.5 keyboard, focus, and accessible-name baseline.
- `command-palette.md`: keyboard-first app action surface and current command scope.

## Quality References

- `../demo/keelhouse-chrome-demo.html`: standalone chrome walkthrough for first open, drawer modes, movable trays, styled menus, settings, command palette, and constrained layouts.
- `chrome-ui-polish.md`: workbench chrome quality bar.
- `daily-driver-metrics.md`: replacement-workflow metrics, scenarios, and collector command.
- `qa/daily-driver/chat-durable-store.md`: executed SQLite migration, real Codex turn, and relaunch-restoration proof.
- `qa/chat-rich-messages/README.md`: packaged rich Markdown/code rendering, Copy, Stop transcript, and automated behavior proof.
- `perf-budget.md`: static resource budget gate and next live measurement plan.
- `editor-terminal-parity.md`: editor and terminal parity criteria.
- `terminal-robustness.md`: v0.5 terminal runtime evidence and checklist.
- `agent-activity-timeline.md`: user-visible agent activity events.
- `local-state.md`: Tauri Store path, schema, and reset steps.
- `qa/`: repeatable screenshot fixtures and captures.

When `../roadmap.json` changes, rebuild the board with:

```bash
node rockmap/build-roadmap.mjs roadmap.json roadmap.html
```
