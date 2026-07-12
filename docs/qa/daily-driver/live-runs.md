# Packaged Daily-Driver Runs

Captured 2026-07-12 in the arm64 packaged `Keelhouse.app`.

- **Executed:** a 4,000-line shell burst; overlapping 2,000-line output in two shells; four-pane performance capture; three-project switch and restoration; Gemini TUI startup.
- **Project switching:** Greg 1.55s, NeuroNav 1.16s, and agent cli 0.92s. These include Computer Use and accessibility refresh overhead, so they are conservative upper bounds.
- **Gemini:** launched in 3.21s and rendered the folder-trust prompt. No trust choice or prompt was submitted. Evidence: `gemini-tui.png`.
- **Failed contract:** creating a new same-project thread retained the previous thread's panes. This blocks a valid two-agent/thread isolation claim and is tracked as `SESSION-PANE-ISOLATION`.
- **Still required:** timed one-project edit + agent + browser-preview run, isolated two-agent same-project run, relaunch timing, and a controlled equivalent VS Code comparison.

Raw observations are in `live-runs.json`; render measurements are in `../perf-budget/`.
