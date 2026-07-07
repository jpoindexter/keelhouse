# PRD — agent cli

**One-liner:** A terminal-first multi-agent coding cockpit — real Claude Code TUI front and center, thin file rail, tabs = projects, each tab holding N agent panes, plus the real VS Code inline when actually needed.

**2026-07-07 — this doc is current.** Pivoted to [cmux](https://github.com/manaflow-ai/cmux) — see DECISIONS.md for the full trail (zellij trial → rejected for being a static config, not an app → Superconductor/hashmark evaluated and rejected → cmux found, verified in source, adopted). A 16-framework blind-spot audit (`docs/blind-audit-cmux-fork-decision-2026-07-07.html`) then corrected an earlier false claim: cmux's chrome IS config-themeable (`~/.config/cmux/cmux.json` — `sidebarAppearance.*`, `workspaceColors.*`), which likely makes forking unnecessary.

## Problem

Jason works across 5-10 active projects, sometimes with 3+ Claude/Codex sessions open on one project, sometimes one agent per project. His current setup is N separate VSCode windows, one per project — heavy, and none of it is the terminal CLI experience he actually likes using.

## User

Jason. Solo dev, senior, ND (dyslexia/ADHD/aphantasia) — needs concrete and testable over speculative, dislikes deciding aesthetics from a text description (proven: rejected two color-scheme defaults in a row before picking one by looking at it).

## v0 done criteria

- [x] cmux verified in source as satisfying the core shape — native folder-picker, real terminal panes (real claude/codex CLIs, real pty), real inline VS Code, multi-agent split panes. 2026-07-07.
- [ ] cmux's real appearance config (`sidebarAppearance.*`, `workspaceColors.*` in `cmux.json`) satisfies "clean and modern" — tokens verified to exist in source; Jason to confirm the applied result actually looks right.
- [ ] If config doesn't satisfy: decide fork-cmux vs. build-fresh, weighed against the blind-audit's named fork risks (Sparkle auto-update silently overwriting local changes, multi-platform monorepo scope, Xcode/Zig/Rust toolchain) — not skipped to fork by default.
- [ ] Ship as: cmux (already installed) + a real, versioned `cmux.json` config in this repo — zero Swift/Tauri code unless config genuinely fails the visual bar.

## In scope (v0)

- cmux as daily driver — real terminal panes, real inline VS Code, native folder-picker, tabs=projects via Workspaces→Surfaces→Split-panes.
- `cmux.json` appearance config tuned to Jason's taste (mono-ghost direction, per the demo palette already approved).
- Fork-vs-build-fresh decision, made only *after* config is actually tried — not assumed upfront.

## Out of scope → PARKED.md

- Zellij + Ghostty + yazi trial (real KDL config exists at `zellij/`, cheap to revisit, not the active path)
- Superconductor daily-driver trial (closed source; cmux's real config surface makes this moot)
- Tauri native rewrite (gated — only if cmux's config *and* a scoped fork both fail, see DECISIONS.md)
- Zed stripped-down fallback config
- Worktree helper keybinding
- Mining Superconductor's UX patterns

## Constraints

- Zero application code in v0 unless the config path genuinely fails.
- Must work with Jason's existing multi-project workflow (indx, brutal, hashmark, prova, gripe, lint, Portfolio) without corrupting any of their git state.
- Claude Code's global `"tui": "fullscreen"` setting means agent panes run a fullscreen alt-screen app — lower risk in cmux's native split-pane model than it was under a nested terminal multiplexer, but still worth watching for focus/keybind conflicts.

## Non-goals

- Not a general-purpose terminal emulator replacement.
- Not building a custom code editor — cmux's inline VS Code (real `code serve-web`, your actual installed VS Code) already covers "looks like VSCode's," because it *is* VS Code.
- Not forking cmux's Swift source before trying its real config surface — see DECISIONS.md 2026-07-07 correction.
