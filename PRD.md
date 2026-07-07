# PRD — agent cli

**One-liner:** A terminal-first multi-agent coding cockpit — real Claude Code TUI front and center, thin file rail, tabs = projects, each tab holding N agent panes. None of the VSCode chrome.

## Problem

Jason works across 5-10 active projects, sometimes with 3+ Claude/Codex sessions open on one project, sometimes one agent per project. His current setup is N separate VSCode windows, one per project — heavy, and none of it is the terminal CLI experience he actually likes using.

## User

Jason. Solo dev, senior, ND (dyslexia/ADHD/aphantasia) — needs concrete and testable over speculative, dislikes deciding aesthetics from a text description (proven: rejected two color-scheme defaults in a row before picking one by looking at it).

## v0 done criteria

- [ ] One of the two trials (zellij or Superconductor) has a clear keep/kill verdict, reached by a real week of daily use, not a demo.
- [ ] The editor-fidelity question (does a TUI editor satisfy "I expected it to look like VSCode's") is answered by direct comparison, not assumed.
- [ ] Winning config is shipped as `zellij KDL layout(s) + install script + README`, zero application code.
- [ ] Fresh shell → one command → cockpit with your real project tabs, agents running, surviving a restart.

## In scope (v0)

- Zellij + Ghostty + yazi trial (tabs=projects, panes=agents, worktree per task)
- Superconductor daily-driver trial (parallel data point, not the shipped artifact — closed source)
- The install script + KDL config that results from whichever wins

## Out of scope → PARKED.md

- Tauri native rewrite (gated — only if both trials fail on named frictions, see DECISIONS.md)
- Zed stripped-down fallback config
- Worktree helper keybinding
- Mining Superconductor's UX patterns

## Constraints

- Zero application code in v0 — config only.
- Must work with Jason's existing multi-project workflow (indx, brutal, hashmark, prova, gripe, lint, Portfolio) without corrupting any of their git state.
- Claude Code's global `"tui": "fullscreen"` setting means every agent pane runs a fullscreen alt-screen app — TUI-in-TUI focus/keybind conflicts are a real risk, not hypothetical.

## Non-goals

- Not a general-purpose terminal emulator replacement.
- Not trying to replicate VSCode's rendering — if that's a hard requirement, that's the signal R3 (Tauri) should fire, not a reason to add GUI chrome to the TUI trial.
