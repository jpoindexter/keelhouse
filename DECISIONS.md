# DECISIONS — agent cli

Append-only. Don't edit past entries — add a new one that supersedes.

## 2026-07-07 — Zellij + Ghostty as first trial

**Choice:** Trial zellij (terminal multiplexer) + Ghostty + yazi (TUI file manager) as the primary candidate, before building anything custom.

**Alternatives considered:** Tauri native app from scratch, Zed stripped to terminal+rail, extending hashmark, Superconductor.app as the sole answer.

**Why:** Closest textual match to Jason's stated wants (real Claude TUI, explorer+open-files, light/fast, tabs=projects) per July 2026 OSS survey. Zero build cost.

**Caveat added 2026-07-07 (same day, post-audit):** This verdict was computed *before* two later signals arrived — Jason expected the file editor to "look like VSCode's" (screenshot: tabs, syntax highlighting, GUI rendering) and rejected two color-scheme defaults before picking one by eye. Both signals point toward wanting more GUI fidelity than a TUI structurally delivers. Corrected confidence in "zellij is the right first trial": **~55%**, not treated as settled. The editor-fidelity spike (below) exists to resolve this before sinking a week into config.

**Reversible?** Yes — zero app code committed to this choice yet.

**Update 2026-07-07 — editor-fidelity spike verdict: PASS.** Jason ran `hx spike/sample.tsx`, compared against his VSCode screenshot: line numbers/gutter present, real tree-sitter syntax highlighting with distinct colors for keywords/strings/types/comments/JSX tags, readable and usable for real editing. Confidence in "zellij is the right first trial" restored to ~85%. R1 (the real week-long trial) starts now — `zellij/agent.kdl`.

## 2026-07-07 — R3 (Tauri rewrite) firing threshold

**Choice:** R3 only fires if the zellij and/or Superconductor trials surface frictions matching this list. Decided *before* either trial starts, specifically to prevent a post-hoc, sunk-cost-biased call.

**Would justify R3:**
- The editor-fidelity spike (see below) shows a TUI editor is visually unusable for real work, not just "different" — e.g. can't tell diff hunks apart, syntax highlighting absent for TS/Swift.
- Real, reproducible TUI-in-TUI input routing failures — a keybind or mouse action that goes to zellij instead of the agent inside it, more than occasionally, with no config fix found in an hour of searching.
- Losing the real Claude Code TUI (Superconductor's chat-UI substitute) is confirmed to actively hurt trust/legibility in agent output after a real week of use, not just "feels different."

**Would NOT justify R3:**
- Minor yazi/zellij keybind friction that's fixable by config.
- "I'd prefer it look nicer" without a concrete task it blocked.
- Wanting more panes/tabs than tested — that's a config change, not an architecture failure.
- Superconductor's chat UI being "fine but not preferred" — preference alone isn't a blocker.

**Why:** Per blind-spot audit 2026-07-07 (`docs/blind-spot-audit-2026-07-07.html`): the roadmap's original done-criterion asked "does this friction alone justify the Tauri build?" *after* the trial week, when sunk-cost pressure is highest. Naming the bar now removes that bias.

**Reversible?** Yes — this is a documented threshold, not code. Can be revised with a new dated entry if the trial surfaces something not anticipated here.

## 2026-07-07 — S2 (mine Superconductor for UX patterns) re-gated

**Choice:** S2 only runs if R3 actually fires. Previously scheduled in the roadmap regardless of trial outcome, which meant 2 of 3 trial outcomes (zellij loses, or Superconductor "wins" but is closed-source and can't be forked) both routed back toward the Tauri rewrite anyway — undermining the claim that R3 is genuinely gated on trial failure.

**Why:** Per blind-spot audit — a gate that's structurally pre-wired toward firing isn't a gate.

**Reversible?** Yes.

## 2026-07-07 — Course correction: zellij's static-config model rejected

**What happened:** After R1 (zellij) shipped as a real KDL config with hardcoded project tabs, Jason said plainly: "this should work like VSCode — you open, pick a folder." A text config with fixed paths is a fundamentally different interaction model than an app with a folder/workspace picker — no amount of KDL polish closes that gap.

**Choice:** Pause presenting zellij/KDL as the primary path. Try Superconductor's actual open/pick-folder flow now, promoted ahead of a full R2 trial week — a few minutes of hands-on use answers "is this the right interaction model" faster than either roadmap card does.

**Why this isn't a surprise:** The blind-spot audit (2026-07-07) already flagged this exact risk — corrected confidence in "zellij is right" was ~55%, specifically because Jason's VSCode-editor-fidelity expectation and color pickiness both pointed toward wanting more GUI-app behavior than a TUI delivers. This is that risk landing, on the interaction model this time instead of just the editor.

**Not thrown away:** `zellij/agent.kdl` stays in the repo — cheap to revisit if Superconductor's model doesn't fit either. The real cost so far is small (a few hours), which is the point of trialing cheap things first.

**Reversible?** Yes.

## 2026-07-07 — Pivot to cmux; theme built for it

**What happened:** Jason found `cmux` (manaflow-ai, GPL-3.0, Swift/AppKit, built on libghostty) — a native macOS terminal built specifically for running AI coding agents in parallel. Verified in source (not docs): `showOpenFolderPanel()` gives a real native folder picker creating a workspace (matches "open, pick a folder"); `openDirectoryInInlineVSCode()` runs `code serve-web` and opens the **actual installed VS Code** in a browser pane split next to the terminal (matches "editor should look like VSCode's" — literally, not a lookalike); Workspaces → Surfaces → Split panes gives real simultaneous multi-agent panes running actual CLI tools via a real pty. Closes every gap the zellij/hashmark comparison found.

**Choice:** cmux is now the primary path. `zellij/agent.kdl` stays in the repo (cheap, still usable if needed) but is no longer the shipped artifact.

**Design:** Jason called cmux's stock look "horrible," wants clean/modern even as a terminal. Built an OKLCH-derived, contrast-verified palette (see `color-and-elevation` skill) for Ghostty (which cmux's terminal panes inherit directly) — chrome tones reused from the already-approved mono-ghost demo palette for consistency; ANSI accent colors (red/green/yellow/blue/magenta/cyan) newly built, desaturated per dark-mode convention, all pairs verified >=4.5:1 contrast against bg (not eyeballed). Font: JetBrains Mono (confirmed already installed). Config: `~/.config/ghostty/config`. cmux's own appearance mode set to Dark via `defaults write com.cmuxterm.app appearanceMode dark`.

**Also registered:** `terminal-love` MCP (Jason's own server, wraps Terminal Trove — real screenshots/GIFs of TUI/CLI tools) via `claude mcp add --scope user`, for future design-reference lookups without web-search guessing.

**Reversible?** Yes — theme is config-only, no app code changed. zellij work not deleted.

## 2026-07-07 — Trials run sequentially, not in parallel

**Choice:** R1 (zellij) runs its full week first; R2 (Superconductor) starts only after R1 concludes.

**Alternatives considered:** Running both simultaneously (original roadmap — both in "now" column).

**Why:** Daily-driving two competing cockpits in the same week confounds every friction with tool-switching cost — no way to attribute a papercut to the right tool.

**Reversible?** Yes.

## 2026-07-07 — Superconductor binary removed from git

**Choice:** `resources/super.engineering.app` (117MB signed closed-source binary) removed from the repo going forward. Kept as a screenshot + settings-key notes instead.

**Why:** Per blind-spot audit — you can't mine UX patterns from a compiled binary, so committing the actual executable had no benefit, only downside (licensing exposure if repo is ever made public or shared; permanently bloats git LFS history).

**Reversible?** The removal is reversible (can re-add). The historical LFS object stays in git history either way — full purge would need a history rewrite, not done here since this is a private repo with no other clones/collaborators to disrupt.
