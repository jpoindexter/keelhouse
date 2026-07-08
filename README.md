# agent cli

A lean native macOS replacement for the parts of VS Code Jason actually uses: project tabs, file explorer, file editor, and real Claude/Codex CLI terminals — built on Ghostty's terminal engine, without the rest of the IDE chrome.

## Current state — building it (direction locked 2026-07-07)

**Build our own app, leveraging open-source components** — not adopting a finished third-party app. cmux/Superconductor/hashmark/zellij were all evaluated and are reference only (see `DECISIONS.md` for the full trail, `PARKED.md` for what's shelved).

The core architecture is **verified working** — `spike-ghostty-vt/` proves a real pty → `libghostty-vt` (Ghostty's actual parsing engine, in a Rust backend) → correct cell readback, and `app/` contains the promoted Tauri render/input loop, shortcuts, paste, copy/selection, folder picker, persisted workspace, agent launch, and scrollback hardening.

**Next up (v0.5):** build the stable app shell: file rail area, editor area, and terminal pane area. See `ROADMAP.md`.

- **Stack:** Tauri 2 + React/TS/Vite + `libghostty-vt` + `portable-pty` + Canvas 2D + CodeMirror 6. Full design in `ARCHITECTURE.md`. Locked (`DECISIONS.md`).
- **Toolchain gotcha:** Zig must be pinned to **0.15.2** (`brew install zig@0.15`) — the default 0.16 breaks the libghostty-vt build. See `spike-ghostty-vt/README.md`.
- **Theme:** mono-ghost palette approved (`ghostty/config` has the values); applied in v1, not before the core loop works.

Read `PRD.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `DECISIONS.md`, `PARKED.md`, `ERRORS.md` at the start of any session on this project.

## In this repo

| Path | What |
|---|---|
| `PRD.md` / `ROADMAP.md` / `DECISIONS.md` / `PARKED.md` / `ERRORS.md` | Planning docs — source of truth |
| `ARCHITECTURE.md` | Stack, data flow, terminal architecture, risks |
| `app/` | Current Tauri app — canvas terminal, keyboard roundtrip, paste, shortcuts, copy/selection, folder picker, agent launch |
| `docs/local-state.md` | Tauri Store path, `workspace.json` schema, and reset commands |
| `spike-ghostty-vt/` | **Verified** libghostty-vt-in-Rust spike — the terminal engine proof |
| `roadmap.json` / `roadmap.html` | The plan as a rockmap board — open `roadmap.html` in a browser |
| `ghostty/config` | **The theme** — contrast-verified mono-ghost palette cmux inherits for terminal rendering |
| `spike/` | The editor-fidelity test — `cd spike && hx sample.tsx` (passed 2026-07-07; informs the CodeMirror editor slice) |
| `zellij/agent.kdl` | Earlier trial config — not deleted, not the shipped path. See `DECISIONS.md`. |
| `rockmap/` | Vendored [rockmap](https://github.com/jpoindexter/rockmap) (board generator) |
| `demo/cockpit-demo.html` | Early interactive mockup — reference only; superseded by the build-our-own Tauri app direction |
| `docs/brainstorm/` | Design-phase mockups (platform options, approaches, tab models) |
| `docs/blind-spot-audit-2026-07-07.html` | 16-framework audit that caught the demo-replaced-the-trial drift |
| `docs/blind-audit-cmux-fork-decision-2026-07-07.html` | 16-framework audit of the fork-cmux decision — found cmux's chrome is config-themeable |
| `resources/superconductor-reference/` | Superconductor UX notes (settings-key feature map) + icon — signed binary removed, see `DECISIONS.md` |

Rebuild the board after editing `roadmap.json`:

```bash
node rockmap/build-roadmap.mjs roadmap.json roadmap.html
```
