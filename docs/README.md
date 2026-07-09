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

## Product Scope

- `settings-parity.md`: Codex-inspired settings shape; kept, dropped, and parked sections.
- `navigation-parity.md`: project/session rail model and Codex sidebar translation.
- `project-rail.md`: v1 open-project rail implementation and deferred session/pane work.
- `project-sessions.md`: v1 named workbench session rows under projects.
- `browser-preview.md`: v1 lightweight browser/web preview pane.
- `pane-manager.md`: v1 real multi-pane terminal manager.
- `pane-names.md`: v1 editable terminal pane names/task labels.
- `integrations-scope.md`: Git, GitHub, GitLab, and adapter-lane boundaries.
- `composer-harness-research.md`: bottom composer and future harness scope.
- `composer-harness.md`: v1 implemented composer permission, goal, profile, and attachment controls.
- `harness-contract.md`: app-owned pane/session handle contract.
- `app-actions-minimal.md`: v1 app-owned action gate and audit contract.
- `agent-session-handle.md`: v1 implemented pane/session handle layer.
- `agent-activity.md`: v1 visible current/recent agent activity rows.
- `agent-activity-log.md`: v1 durable, filterable pane/session activity timeline.
- `shortcuts.md`: active v0.5 shortcut map and planned exceptions.
- `context-menus.md`: right-click/Control-click coverage and deferred diff/git surfaces.
- `chrome-polish-system.md`: current token/state system and deferred chrome surfaces.
- `icon-system.md`: SVG icon family, status mapping, and QA fixture coverage.
- `accessibility-basics.md`: v0.5 keyboard, focus, and accessible-name baseline.

## Quality References

- `chrome-ui-polish.md`: workbench chrome quality bar.
- `editor-terminal-parity.md`: editor and terminal parity criteria.
- `terminal-robustness.md`: v0.5 terminal runtime evidence and checklist.
- `agent-activity-timeline.md`: user-visible agent activity events.
- `local-state.md`: Tauri Store path, schema, and reset steps.
- `qa/`: repeatable screenshot fixtures and captures.

When `../roadmap.json` changes, rebuild the board with:

```bash
node rockmap/build-roadmap.mjs roadmap.json roadmap.html
```
