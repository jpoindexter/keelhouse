# agent cli

Terminal-first multi-agent cockpit. The real Claude Code TUI front and center, a thin file rail, **tabs = projects**, each tab holding N agent panes (claude ×3 on one repo, codex on another) — none of the VSCode chrome.

## Current state — trials before code

A [16-framework blind-spot audit](docs/blind-spot-audit-2026-07-07.html) on 2026-07-07 found the demo had replaced the actual trial (zero zellij config existed, tools weren't installed) and that the "zellij is closest match" call had gone stale after later feedback (VSCode-editor-fidelity expectation, color rejections). Remediated same day — see `ERRORS.md` and `DECISIONS.md` for the full record. Sequenced plan, in order:

0. **Editor-fidelity spike** (`spike/`, 1-2h): the cheapest, most load-bearing unknown, tested before either trial starts.
1. **Zellij cockpit trial** (1 week): KDL layout in Ghostty — tabs per project, yazi rail, agent panes in worktrees, native persistence.
2. **Superconductor trial** (1 week, *after* #1 concludes, not concurrent): its workspace-tab + worktree-per-task model is exactly the ask; its chat UI instead of the claude TUI is the open question.
3. **Tauri 2 native harness** — gated endgame. Exact firing threshold named in `DECISIONS.md`, decided before the trials, not after.

Read `PRD.md`, `ROADMAP.md`, `DECISIONS.md`, `PARKED.md`, `ERRORS.md` at the start of any session on this project.

## In this repo

| Path | What |
|---|---|
| `PRD.md` / `ROADMAP.md` / `DECISIONS.md` / `PARKED.md` / `ERRORS.md` | Planning docs — source of truth |
| `roadmap.json` / `roadmap.html` | The plan as a rockmap board — open `roadmap.html` in a browser |
| `spike/` | The editor-fidelity test — `cd spike && hx sample.tsx` |
| `rockmap/` | Vendored [rockmap](https://github.com/jpoindexter/rockmap) (board generator) |
| `demo/cockpit-demo.html` | Interactive demo of the target experience — press 1–4 / n / x |
| `docs/brainstorm/` | Design-phase mockups (platform options, approaches, tab models) |
| `docs/blind-spot-audit-2026-07-07.html` | The audit that caught the drift, and the action report |
| `resources/superconductor-reference/` | Superconductor UX notes (settings-key feature map) + icon — the signed binary itself was removed, see `DECISIONS.md` |

Rebuild the board after editing `roadmap.json`:

```bash
node rockmap/build-roadmap.mjs roadmap.json roadmap.html
```
