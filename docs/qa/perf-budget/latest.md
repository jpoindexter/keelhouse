# Performance Budget

Generated: 2026-07-11T19:37:33.083Z
Commit: fc76940+dirty
Status: baseline-ready

## Hard Budgets

- PASS Total built JS assets: 1151.9 KiB / 1367.2 KiB
- PASS Total built CSS assets: 73.9 KiB / 87.9 KiB

## Soft Budgets

- WARN Largest JS chunk stays below Vite warning size: 1151.9 KiB / 488.3 KiB
  - Warning only for now because CodeMirror language packages already exceed Vite's default chunk warning.

## Source Checks

- PASS Editor stack uses CodeMirror instead of Monaco/VS Code workbench - app/package.json
- PASS No Monaco dependency is present - app/package.json
- PASS Terminal paint path is frame-coalesced - app/src/App.tsx
- PASS Terminal snapshots are cached by pane - app/src/App.tsx
- PASS Dev-server detection is output driven, not browser-heavy - app/src/browserPreview.ts
- PASS Daily-driver readiness gate has passed - docs/qa/daily-driver/latest.json

## Artifact Checks

- PASS Actual app first-open screenshot - docs/qa/app-shell/first-open-1440.png (70.3 KiB)
- PASS Actual app narrow screenshot - docs/qa/app-shell/first-open-900.png (54.8 KiB)
- PASS Native Tauri run screenshot - docs/qa/app-shell/native-run.png (315.8 KiB)
- PASS Editor selected-state screenshot - docs/qa/editor-parity/selected.png (137.4 KiB)
- PASS Daily-driver report - docs/qa/daily-driver/latest.md (2.1 KiB)

## Next Live Measurements

- Measure Keelhouse memory, CPU, and responsiveness for one-project edit+agent in the packaged Tauri app.
- Measure two-agent same-project pane focus/restart/close with terminal output under load.
- Measure three-project switch/relaunch with restored sessions and previews.
- Measure equivalent VS Code windows/extensions workflow and record the delta, not just Keelhouse alone.

