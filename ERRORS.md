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
