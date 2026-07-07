# agent cli

Terminal-first multi-agent cockpit. Real CLI agents (claude, codex) running in real terminal panes, a file rail, **tabs = projects**, each tab holding N agent panes — plus the real VS Code, inline, when you actually need it. Not a lookalike of either.

## Current state — running [cmux](https://github.com/manaflow-ai/cmux)

Pivoted 2026-07-07 (see `DECISIONS.md`) after finding cmux: native macOS, Swift/AppKit, built on libghostty. Verified in its own source, not docs — `⌘O` opens a real native folder picker and creates a workspace; the "Open Folder in VS Code (Inline)" panel runs `code serve-web` and opens your **actual installed VS Code** in a browser pane next to the terminal; Workspaces → Surfaces → Split panes gives real simultaneous multi-agent panes running actual CLI tools in a real pty. Closes every gap the earlier zellij/hashmark/Superconductor comparison found.

- **Theme:** stock cmux look was rejected ("horrible... should be clean and modern"). `ghostty/config` — OKLCH-derived, contrast-verified mono-ghost palette (cmux inherits Ghostty's config directly for terminal rendering). `cd ghostty && cp config ~/.config/ghostty/config`.
- **zellij work** (`zellij/agent.kdl`) is not deleted — cheap fallback if needed — but is no longer the shipped path.
- **Superconductor** (closed source) and the **Tauri rewrite** (gated) are parked — see `PARKED.md`.

Read `PRD.md`, `ROADMAP.md`, `DECISIONS.md`, `PARKED.md`, `ERRORS.md` at the start of any session on this project.

## In this repo

| Path | What |
|---|---|
| `PRD.md` / `ROADMAP.md` / `DECISIONS.md` / `PARKED.md` / `ERRORS.md` | Planning docs — source of truth |
| `roadmap.json` / `roadmap.html` | The plan as a rockmap board — open `roadmap.html` in a browser |
| `ghostty/config` | **The theme** — contrast-verified mono-ghost palette cmux inherits for terminal rendering |
| `spike/` | The editor-fidelity test — `cd spike && hx sample.tsx` (passed 2026-07-07; superseded by cmux's real inline VS Code, kept for reference) |
| `zellij/agent.kdl` | Earlier trial config — not deleted, not the shipped path. See `DECISIONS.md`. |
| `rockmap/` | Vendored [rockmap](https://github.com/jpoindexter/rockmap) (board generator) |
| `demo/cockpit-demo.html` | Early interactive mockup — superseded by the real cmux app |
| `docs/brainstorm/` | Design-phase mockups (platform options, approaches, tab models) |
| `docs/blind-spot-audit-2026-07-07.html` | 16-framework audit that caught the demo-replaced-the-trial drift |
| `resources/superconductor-reference/` | Superconductor UX notes (settings-key feature map) + icon — signed binary removed, see `DECISIONS.md` |

Rebuild the board after editing `roadmap.json`:

```bash
node rockmap/build-roadmap.mjs roadmap.json roadmap.html
```
