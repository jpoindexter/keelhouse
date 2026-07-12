# Performance Budget

PERF-BUDGET protects Keelhouse's core promise: replace the user's VS Code-plus-agent workflow with a lighter native agent workbench, not a heavier editor clone.

## Current Gate

Run from `app/` after a production build and daily-driver readiness check:

```bash
npm run build
npm run qa:daily-driver
npm run qa:perf-budget
npm run qa:runtime-perf
```

The collector writes:

- `docs/qa/perf-budget/latest.json`
- `docs/qa/perf-budget/latest.md`

## Budgets

- **Hard:** built JS assets must stay under `1.4 MB` and CSS under `90 KB`.
- **Hard:** required chrome/editor screenshots and daily-driver evidence must exist.
- **Hard:** source checks must preserve the lightweight architecture: CodeMirror instead of Monaco, no Monaco dependency, frame-coalesced terminal painting, cached terminal snapshots, and output-driven local preview detection.
- **Soft:** largest JS chunk currently warns above Vite's `500 KB` threshold because CodeMirror language packages are bundled. This is tracked as a warning until chunk splitting becomes valuable.

## Current Boundary

The packaged two- and four-pane render snapshots are now recorded in `docs/qa/perf-budget/`, along with a repeatable current-workload process-tree comparison. The latter is observational because VS Code and Keelhouse were not running controlled equivalent workflows. Final proof still requires a packaged one-pane sample and matching one-project, two-agent, and three-project runs in both apps.
