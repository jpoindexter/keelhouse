# Keelhouse Docs

Keelhouse is the product name. The repo, package, binary, app identifier, and local-state slug remain `agent-cli` until an explicit migration.

## Start Here

- `../README.md`: product overview, local run commands, and repository map.
- `../PRD.md`: product requirements, scope boundaries, and release criteria.
- `../ROADMAP.md`: readable roadmap companion to `../roadmap.json`.
- `../STATE.md`: current handoff, verified slices, and next execution step.
- `product-positioning.md`: name decision, one-liner, and language rules.

## Product Scope

- `settings-parity.md`: Codex-inspired settings shape; kept, dropped, and parked sections.
- `navigation-parity.md`: project/session rail model and Codex sidebar translation.
- `integrations-scope.md`: Git, GitHub, GitLab, and adapter-lane boundaries.
- `composer-harness-research.md`: bottom composer and future harness scope.
- `harness-contract.md`: app-owned pane/session handle contract.

## Quality References

- `chrome-ui-polish.md`: workbench chrome quality bar.
- `editor-terminal-parity.md`: editor and terminal parity criteria.
- `agent-activity-timeline.md`: user-visible agent activity events.
- `local-state.md`: Tauri Store path, schema, and reset steps.
- `qa/`: repeatable screenshot fixtures and captures.

When `../roadmap.json` changes, rebuild the board with:

```bash
node rockmap/build-roadmap.mjs roadmap.json roadmap.html
```
