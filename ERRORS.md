# ERRORS — agent cli

Append-only failure log. Approaches that took >2 attempts, or that a 16-framework blind-spot audit caught before they cost real time.

## 2026-07-07 — Demo replaced the trial

**What failed:** Six commits across 23 minutes shipped an interactive HTML demo (typing animation, 3 switchable color themes, a fake syntax-highlighted editor pane, localStorage persistence), a vendored roadmap-board tool, and a README — while zero real zellij KDL config existed and none of zellij/yazi/Ghostty were installed. The polished, controllable artifact (demo) got built instead of the boring, uncertain one (a real week of daily use).

**What worked:** A full 16-framework blind-spot audit (`/blind`) caught it before more time was sunk — 5 of 16 frameworks independently converged on this exact finding (premortem, outside-view, inversion, chestertons-fence, unknown-unknowns).

**Why it failed:** Structural, not a one-off mistake — visible, demoable artifacts are easier to produce and feel more like progress than "logged 3 minor frictions in a TUI editor today." No mechanism existed to catch the drift in the moment; it only surfaced under an explicit audit.

**Next time:** When a request is "extract/demo/push," watch for follow-on asks (add themes, fix colors) quietly becoming a second design pass on a non-deliverable artifact. Name it out loud at the second unrequested addition, not the fifth.

## 2026-07-07 — Trial decision made on stale evidence, not rechecked

**What failed:** "Zellij is the closest match" was decided before Jason said he expected VSCode-level editor fidelity and before he rejected two color-scheme defaults. Both signals arrived after the decision and never triggered a re-evaluation — silence was read as confirmation.

**What worked:** Calibration audit produced an explicit corrected confidence (~55%, not the ~90% implied by proceeding without comment) and named exactly what would move it up or down.

**Why it failed:** No process step existed for "a locked decision + new contradicting evidence = mandatory re-check," so the new evidence just accumulated without ever being weighed against the standing conclusion.

**Next time:** When a design decision is approved and then the user gives feedback that plausibly contradicts a premise of that decision (not just a detail), say so explicitly before continuing — don't let it ride as "noted" without connecting it back.

## 2026-07-07 — indx environment drift (partially fixed, one item needs Jason)

**What was found:** indx checked out on `codex/happy-path-agent-ux`, not `feature/tolaria-shell` as the CLAUDE.md portfolio note claims. A `prunable` orphaned worktree from hashmark's own multi-agent tooling (`/private/tmp/hashmark-worktrees/042f5952-...`, detached HEAD) sitting unpruned.

**Fixed:** Orphaned worktree pruned (`git worktree prune`) — purely mechanical, zero risk, confirmed clean after.

**Not fixed, needs Jason:** `codex/happy-path-agent-ux` (2026-05-31 21:42) and `feature/tolaria-shell` (2026-05-31 15:50) are the same day, 6 hours apart — both ~5 weeks stale relative to today, neither obviously "the" current branch. This isn't a bug to silently fix by guessing; it's a real decision about which line of work is live. Working tree has only untracked files (`.codegraph/`, `.codex/`, some docs) — no risk of lost work either way, so switching is safe once Jason picks.

**Why flagged instead of fixed:** Forcing a branch switch on someone else's active project based on a guess is exactly the kind of silent, hard-to-reverse action that should stop and ask rather than proceed.

## 2026-07-07 — Asserted "cmux's chrome isn't config-themeable" without checking deep enough

**What failed:** Claimed cmux's native sidebar/tab-bar chrome "isn't config-themeable and would require editing the compiled Swift/AppKit source directly." This was wrong — real, shipped appearance tokens (`sidebarAppearance.*`, `workspaceColors.*`: tint color, corner radius, material, blend mode, tab colors) exist in `cmux.json`. I'd checked `AppearanceSettings.swift` (light/dark/system mode) but not the deeper `CmuxSettings` catalog before asserting the negative.

**What worked:** A `/blind` audit flagged the claim as unverified (chestertons-fence, unknown-unknowns); I re-cloned the repo and read the actual settings source myself before writing the correction — didn't just relay the subagents' flag.

**Why it failed:** Asserted an absence ("isn't themeable") from a partial search, not a search that had actually ruled it out. Absence claims need the same verification bar as presence claims — "I didn't find X" is not "X doesn't exist" unless the search was actually exhaustive.

**Next time:** Before claiming a feature/config surface doesn't exist, search the actual settings/config catalog structure (not just the first file that seems relevant) before asserting the negative.

## 2026-07-07 — "cmux is still best" verdict reached on asymmetric evidence

**What failed:** Re-confirmed cmux as the best fork target via two web searches (vs. the source-level clone-and-grep cmux itself got), converging to confidence in the same turn, right after being told the pattern of evaluating-instead-of-building was the problem. The alternatives (Mux0, Supacode) never got equivalent verification; the search queries were confirmation-shaped, never adversarial.

**What worked:** The `/blind` audit's steelman+bias-blind-spot pass named the exact mechanism: pressure to resolve a rebuke quickly favors reconfirming the prior answer over genuinely re-testing it.

**Why it failed:** No pre-committed symmetric-effort rule ("verify the challenger as hard as the incumbent") existed before running the comparison.

**Next time:** When re-checking a standing conclusion under social pressure to resolve fast, apply the same verification depth to the challengers as the incumbent already got — or explicitly flag the asymmetry before stating a confident verdict.
