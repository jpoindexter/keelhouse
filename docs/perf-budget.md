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

For the final controlled comparison, prepare the same `one-project-explorer-editor-shell` scenario in packaged Keelhouse and an isolated extension-free VS Code instance. Launch VS Code with a unique `--user-data-dir`, then pass that directory as the process marker:

```bash
KEELHOUSE_PERF_CONTROLLED=1 \
KEELHOUSE_PERF_VSCODE_MARKER=/tmp/keelhouse-vscode-perf-profile \
npm run qa:runtime-perf
```

The controlled run writes `runtime-comparison-controlled.json`; the default command keeps writing the explicitly observational baseline.

The collector writes:

- `docs/qa/perf-budget/latest.json`
- `docs/qa/perf-budget/latest.md`

## Budgets

- **Hard:** built JS assets must stay under `1.75 MB` and CSS under `145 KB`. These are the measured v1 feature-freeze ceilings, with roughly 10% headroom over the 2026-07-14 production build; increases require a new decision and runtime proof.
- **Hard:** required chrome/editor screenshots and daily-driver evidence must exist.
- **Hard:** source checks must preserve the lightweight architecture: CodeMirror instead of Monaco, no Monaco dependency, frame-coalesced terminal painting, cached terminal snapshots, and output-driven local preview detection.
- **Hard:** packaged 1-, 2-, and 4-pane captures must each contain at least 30 frames, p95 paint time at or below `16.7 ms`, jank at or below `2%`, at least one terminal IPC sample, and IPC p95 at or below `256 KiB`.
- **Hard:** a controlled equivalent Keelhouse/VS Code process-tree comparison must contain at least five samples for each app under the same named scenario. The observational comparison does not satisfy this gate.
- **Soft:** largest JS chunk currently warns above Vite's `500 KB` threshold because CodeMirror language packages are bundled. This is tracked as a warning until chunk splitting becomes valuable.

## Current Boundary

The packaged two- and four-pane render snapshots are recorded in `docs/qa/perf-budget/`, along with a repeatable current-workload process-tree comparison. The latter is observational because VS Code and Keelhouse were not running controlled equivalent workflows. Final proof still requires `render-perf-1-pane.json` and `runtime-comparison-controlled.json` from a matching workflow in both apps.
