# PARKED — agent cli

Deferred ideas. Promote, never delete.

## Tauri 2 native harness (R3)

**Captured:** 2026-07-07
**Why parked:** Gated behind both trials failing on named frictions (see DECISIONS.md). No OSS app fills this gap, so it's a real fallback, not a dead idea — just not v0.
**Cost to revisit:** Seed from hashmark's Tauri scaffold + Warp terminal's color/font/icon spec; steal workspace-tab/worktree-per-task UX from Superconductor. Est. 1-2 weeks to v0 once scoped from real trial frictions.

## Zed stripped-down fallback config

**Captured:** 2026-07-07
**Why parked:** Verified working (settings.json/keymap/tasks documented) but Zed has no native project-tabs — top community request since 2024 — so it can't satisfy "tabs = projects" without window-per-project, which is the VSCode pattern being escaped.
**Cost to revisit:** <1h — config already written and verified against current Zed docs, just needs applying.

## Worktree helper keybinding

**Captured:** 2026-07-07
**Why parked:** v1, not v0 — depends on which cockpit wins the trial first.
**Cost to revisit:** Small — one keystroke = `git worktree add` + agent launched inside it, named and disposable.

## Mining Superconductor for UX patterns (S2)

**Captured:** 2026-07-07
**Why parked:** Re-gated (see DECISIONS.md) to only run if R3 actually fires — was previously scheduled regardless of trial outcome, which defeated the point of a gate.
**Cost to revisit:** Small — settings-key notes + screenshot already kept in `resources/`.

## Shipping-velocity done-criterion

**Captured:** 2026-07-07 (from blind-spot audit)
**Why parked:** No current done-criterion checks whether the cockpit actually increases shipping velocity across Jason's broader stalled portfolio (e.g. gripe, stalled ~3 weeks) — it only checks whether the cockpit itself works. Real gap, but adding a portfolio-wide metric is out of scope for a tool-selection trial.
**Cost to revisit:** Cheap — add a line to P1's done-criteria once v0 ships and there's a baseline to compare against.
