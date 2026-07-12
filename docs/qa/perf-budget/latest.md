# Performance Budget

Generated: 2026-07-12T21:56:25.612Z
Commit: f1e5b1e+dirty
Status: baseline-ready

## Hard Budgets

- PASS Total built JS assets: 1187.4 KiB / 1367.2 KiB
- PASS Total built CSS assets: 83.0 KiB / 87.9 KiB

## Soft Budgets

- WARN Largest JS chunk stays below Vite warning size: 1187.4 KiB / 488.3 KiB
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

- PASS Actual app first-open screenshot - docs/qa/app-shell/first-open-1440.png (53.5 KiB)
- PASS Actual app narrow screenshot - docs/qa/app-shell/first-open-900.png (39.4 KiB)
- PASS Native Tauri run screenshot - docs/qa/app-shell/native-run.png (315.8 KiB)
- PASS Editor selected-state screenshot - docs/qa/editor-parity/selected.png (123.7 KiB)
- PASS Daily-driver report - docs/qa/daily-driver/latest.md (2.1 KiB)
- PASS Live-captured render-perf snapshot (frame time/IPC payload/jank) - docs/qa/perf-budget/render-perf-live.json (0.3 KiB)
- PASS Packaged two-pane render-perf snapshot - docs/qa/perf-budget/render-perf-2-pane.json (0.3 KiB)
- PASS Packaged four-pane render-perf snapshot - docs/qa/perf-budget/render-perf-4-pane.json (0.3 KiB)
- PASS Process-tree runtime comparison - docs/qa/perf-budget/runtime-comparison.json (2.4 KiB)
- PASS Packaged Gemini TUI screenshot - docs/qa/daily-driver/gemini-tui.png (119.0 KiB)

## Next Live Measurements

- Measure Keelhouse memory, CPU, and responsiveness for one-project edit+agent in the packaged Tauri app.
- Measure two-agent same-project pane focus/restart/close with terminal output under load.
- Measure three-project switch/relaunch with restored sessions and previews.
- Measure equivalent VS Code windows/extensions workflow and record the delta, not just Keelhouse alone.

