# Performance Budget

Generated: 2026-07-14T08:15:33.573Z
Commit: 1f1fbca+dirty
Status: missing-budget-evidence

## Hard Budgets

- PASS Total built JS assets: 1551.1 KiB / 1709.0 KiB
- PASS Total built CSS assets: 125.6 KiB / 141.6 KiB

## Soft Budgets

- WARN Largest JS chunk stays below Vite warning size: 1546.4 KiB / 488.3 KiB
  - Warning only for now because CodeMirror language packages already exceed Vite's default chunk warning.

## Source Checks

- PASS Editor stack uses CodeMirror instead of Monaco/VS Code workbench - app/package.json
- PASS No Monaco dependency is present - app/package.json
- PASS Terminal paint path is frame-coalesced - app/src/App.tsx
- PASS Terminal snapshots are cached by pane - app/src/App.tsx
- PASS Dev-server detection is output driven, not browser-heavy - app/src/browserPreview.ts
- PASS Daily-driver readiness gate has passed - docs/qa/daily-driver/latest.json
- PASS Canvas paint path records frame time for the render-perf gate - app/src/renderPerf.ts

## Artifact Checks

- PASS Actual app first-open screenshot - docs/qa/app-shell/first-open-1440.png (72.5 KiB)
- PASS Actual app narrow screenshot - docs/qa/app-shell/first-open-900.png (55.9 KiB)
- PASS Native Tauri run screenshot - docs/qa/app-shell/native-run.png (315.8 KiB)
- PASS Editor selected-state screenshot - docs/qa/editor-parity/selected.png (124.0 KiB)
- PASS Daily-driver report - docs/qa/daily-driver/latest.md (2.5 KiB)
- PASS Packaged Gemini TUI screenshot - docs/qa/daily-driver/gemini-tui.png (119.0 KiB)

## Render Performance

- FAIL Packaged 1-pane render performance: 0 frames, p95 missing ms, missing jank, IPC p95 missing - docs/qa/perf-budget/render-perf-1-pane.json
- PASS Packaged 2-pane render performance: 117 frames, p95 1.00 ms, 1.71% jank, IPC p95 105.7 KiB - docs/qa/perf-budget/render-perf-2-pane.json
- PASS Packaged 4-pane render performance: 300 frames, p95 1.00 ms, 0.00% jank, IPC p95 105.7 KiB - docs/qa/perf-budget/render-perf-4-pane.json
- FAIL Controlled equivalent Keelhouse and VS Code runtime comparison - docs/qa/perf-budget/runtime-comparison-controlled.json

## Next Live Measurements

- Measure Keelhouse memory, CPU, and responsiveness for one-project edit+agent in the packaged Tauri app.
- Measure two-agent same-project pane focus/restart/close with terminal output under load.
- Measure three-project switch/relaunch with restored sessions and previews.
- Measure equivalent VS Code windows/extensions workflow and record the delta, not just Keelhouse alone.

