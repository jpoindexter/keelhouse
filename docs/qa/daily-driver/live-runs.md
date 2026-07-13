# Packaged Daily-Driver Runs

Captured 2026-07-12 through 2026-07-13 in the arm64 packaged `Keelhouse.app`.

- **Executed:** a 4,000-line shell burst; overlapping 2,000-line output in two shells; four-pane performance capture; three-project switch and restoration; Gemini TUI startup.
- **Project switching:** Greg 1.55s, NeuroNav 1.16s, and agent cli 0.92s. These include Computer Use and accessibility refresh overhead, so they are conservative upper bounds.
- **Gemini:** launched in 3.21s and rendered the folder-trust prompt. No trust choice or prompt was submitted. Evidence: `gemini-tui.png`.
- **Structured two-chat workflow (executed 2026-07-13):** two same-project Codex chats ran concurrently, kept independent message/provider histories, and restored after relaunch. Stopping Chat A returned it to Ready within 1.8 seconds while Chat B remained Running and completed normally. The first attempt exposed wrapper-only cancellation; the rebuilt package now terminates the selected chat's full process group. Evidence: `codex-multi-chat.md` and `codex-multi-chat-native.png`.
- **Raw-terminal boundary:** Raw terminal replaced the center chat surface and toggled back without becoming duplicate chat content. Optional raw-terminal isolation also passed: two same-project chats owned independent labelled shells before and after relaunch. Evidence: `session-pane-isolation.md`.
- **Still required:** timed one-project edit + agent + browser-preview run, complete three-project relaunch timing, full Gemini prompt/response smoke, and a controlled equivalent VS Code comparison.

Raw observations are in `live-runs.json`; render measurements are in `../perf-budget/`.
