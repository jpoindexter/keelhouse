# PARKED — agent cli

Deferred ideas. Promote, never delete.

## Zellij cockpit config

**Captured:** 2026-07-07
**Why parked:** Real, working KDL config (`zellij/agent.kdl`, tabs=projects, yazi rail, agent panes) — but Jason rejected the static-config interaction model directly: "this should work like vscode — you open, pick a folder." Superseded by cmux, which does that natively.
**Cost to revisit:** Near zero — config already exists, tools (zellij/yazi/helix) already installed.

## Superconductor daily-driver trial

**Captured:** 2026-07-07
**Why parked:** Closed source (can't fork/extend), and its chat-UI-instead-of-real-terminal-view was the specific thing Jason said he didn't want. cmux's real config surface (found later) covers the "open, pick a folder" want Superconductor was evaluated for, without the closed-source ceiling.
**Cost to revisit:** Low — `resources/superconductor-reference/` still has the settings-key notes.

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

## Appshots / Computer use settings parity

**Captured:** 2026-07-08
**Why parked:** Codex exposes Appshots and Computer use settings, but this app should not inherit them blindly. Appshots may become visual context capture for browser/app screenshots sent to agents. Computer use may become permissioned agent-controlled app/browser actions. Both depend on browser preview and agent hooks being real first.
**Cost to revisit:** Medium — promote only after `BROWSER-PREVIEW` and `AGENT-HOOKS`; require explicit approvals, attribution logs, and no broad desktop automation.

## Scheduled sessions / session archive sidebar parity

**Captured:** 2026-07-08
**Why parked:** Codex shows Scheduled and archived chat concepts. For this app, Scheduled could mean background agent runs and Archive could mean old project sessions/transcripts, but both require project sessions, transcript capture, and agent hooks first.
**Cost to revisit:** Medium — promote only after `PROJECT-SESSIONS`, `TRANSCRIPTS`, and `AGENT-HOOKS`; keep labels task/workbench-oriented, not chat-oriented.

## Non-source-control integrations

**Captured:** 2026-07-08
**Why parked:** Bitbucket/Azure DevOps, Linear/Jira, Slack/Discord, and similar tools may be useful, but Git/GitHub/GitLab cover the immediate code-review/shipping path. Broader integrations risk turning the app into another plugin hub.
**Cost to revisit:** Medium — promote one integration only when a concrete workflow needs it; require a narrow app-owned adapter, health check, credentials boundary, and no chat/project-management clone.

## Layout-usage telemetry (do layouts actually diverge?)

**Captured:** 2026-07-11 (blind audit, steelman lens). If most sessions revert to the demo layout, the fixed-layout argument resurrects; if layouts stay diverse, movable trays are validated.
**Why parked:** no-telemetry-before-users discipline; local-only counters are still instrumentation ahead of need.
**Cost to revisit:** small — a local counter on layout changes plus a monthly eyeball.

## Composer send-confirmation toast ("Sent to <pane>")

**Captured:** 2026-07-11 (blind audit, red-team lens). Icon-only Send could silently route a prompt to an unexpected pane in fast loops.
**Why parked:** no observed mis-route yet; activity timeline already logs prompt sends. Promote if DAILY-DRIVER-LIVE shows a real mis-route.
**Cost to revisit:** small — transient toast wired to the existing prompt-sent activity event.

## Second-model spot-check gate (codex re-reads critical diffs pre-merge)

**Captured:** 2026-07-11 (blind audit, bias-blind-spot lens). Same-session diagnose-implement-verify loops shipped the chrome drift; codex-cli is installed and could re-read high-risk surfaces before "done".
**Why parked:** process overhead for a solo flow; CHROME-EYEBALL-SIGNOFF + OUTSIDE-REVIEW cover the near-term need.
**Cost to revisit:** small — a documented rule plus `codex exec` invocation per high-risk card.
