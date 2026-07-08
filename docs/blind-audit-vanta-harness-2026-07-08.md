# Blind-Spot Audit: Vanta Harness Patterns For Agent Cli

Target resolved: whether `agent cli` should borrow Vanta's custom harness patterns for composer, agent sessions, approvals, activity, and future direct API/MCP orchestration.

Frameworks applied: blind-premortem, blind-outside-view, blind-unknown-unknowns, blind-inversion, blind-consider-the-opposite, blind-red-team, blind-chestertons-fence, blind-falsification, blind-bias-blind-spot, blind-survivorship-bias, blind-steelman, blind-calibration, blind-johari-window, blind-dunning-kruger, blind-ladder-of-inference, blind-curse-of-knowledge - 6 independent findings, 5 same-model-repetition notes.

## Findings

1. **The plan has a missing middle layer: a concrete app-owned agent-session contract.** (via blind-premortem, blind-inversion; same-model repetition from blind-unknown-unknowns)
   Evidence: `PRD.md` says the composer routes prompts to selected panes and app actions, while preserving terminal panes as source of truth. `docs/composer-harness-research.md` says v0.5 sends text through the pty, and v1 adds permission mode, goal, target pane, model/profile, attachments, and logging. Vanta has a much sharper boundary: `agent_session` exposes `open/send/read/close/list`, with persistent session IDs, explicit `coding` mode, and approval-gated state changes.
   Severity: high - expected damage is a confused product model where the composer becomes either a fake chat clone or a thin textarea; plausibility is high because the current docs name controls but not the protocol behind them.
   Mitigation: add a v1 contract named `AGENT-SESSION-HANDLE`: each pane/session has `id`, `project`, `cwd`, `agentProfile`, `processState`, `send`, `interrupt`, `readTail`, `close`, `activityEvents`, and `approvalMode`. Composer uses that contract, not direct component state.

2. **The permission UI can become theater unless the enforcement layer is defined before the controls ship.** (via blind-red-team, blind-falsification, blind-calibration)
   Evidence: `docs/composer-harness-research.md` defines modes like `Ask for approval`, `Approve safe actions`, and `Full access`, and says app-owned tools route through the same approval policy. Vanta's implementation has stronger mechanics: kernel assessment, fail-closed behavior if the kernel is unreachable, approval prompts, delegated auto-approval, and audit events for allow/blocked/approved/denied. The `agent cli` roadmap puts `AGENT-HOOKS` in v2 even though v1 composer controls depend on app-owned action approval.
   Severity: high - expected damage is user trust loss from labels that do not match enforcement; plausibility is medium-high because the UI requirement is ahead of the policy engine.
   Mitigation: before `COMPOSER-HARNESS`, define a minimal v1 `APP-ACTION-GATE`: action descriptor, risk class, approval result, audit event, and visible undo/rollback note where possible. Do not show permission modes until at least app-owned actions use them.

3. **Vanta is a rich reference class, but importing its runtime shape would violate the product boundary.** (via blind-chestertons-fence, blind-steelman, blind-outside-view)
   Evidence: Vanta includes headless `call_agent`, persistent `agent_session`, tmux, Docker-boxed autonomous agents, model routing, compaction, plugins, self-evolution, and loop machinery. `agent cli` is explicitly a lean VS Code replacement centered on explorer, editor, browser preview, and real pty panes. The current docs already reject fake chat replacement and broad plugin bloat.
   Severity: high - expected damage is rebuilding Vanta inside a desktop shell; plausibility is medium because Vanta's solved pieces are tempting and nearby.
   Mitigation: borrow only interfaces and lessons: session handle, approval audit, activity event schema, agent profile registry, and route hints. Reject tmux, Docker autonomous mode, self-evolution loops, and direct model loop as defaults for v0.5/v1.

4. **The direct API/MCP harness may be parked too late if v1 controls need app-owned actions, but too early if it competes with pty panes.** (via blind-consider-the-opposite, blind-ladder-of-inference)
   Evidence: `ROADMAP.md` puts `COMPOSER-HARNESS` in v1 and `AGENT-HOOKS` plus `DIRECT-AGENT-HARNESS` in v2. But the v1 harness includes permission logging, attachments, model/profile selector, and app-owned action state. Those features need a small app-action/tool substrate even if direct model orchestration waits.
   Severity: medium-high - expected damage is rework from building v1 UI without a real backend contract; plausibility is high because the dependency is visible in the roadmap ordering.
   Mitigation: split the work: v1 gets `APP-ACTIONS-MINIMAL` for local commands/events/approval, v2 gets direct model/MCP orchestration. Keep "direct agent" separate from "app-owned action surface."

5. **"Codex-level polish" can mask whether the actual workflow is faster than VS Code.** (via blind-survivorship-bias, blind-curse-of-knowledge, blind-johari-window)
   Evidence: PRD and roadmap correctly ask for dense chrome, iconography, context menus, settings, activity rows, and composer controls. The user's real job is narrower: open projects, inspect/edit files, run multiple Claude/Codex terminals, preview browser output, and switch projects without VS Code bloat. There is not yet a task-based daily-driver metric for "is this better than the current VS Code workflow?"
   Severity: medium - expected damage is spending polish effort on surfaces that look right but do not reduce workflow friction; plausibility is medium because the roadmap does include `PERF-BUDGET` and `DAILY-DRIVER-METRICS`, but those are v1 and not yet concrete.
   Mitigation: add three workflow scripts as acceptance tests: one-project edit+agent loop, two-agent same-project loop, and three-project switch loop. Measure steps, seconds, memory, and recovery after quit.

6. **The current docs assume the user will understand the split between terminal pane, composer, session row, agent profile, and direct harness.** (via blind-curse-of-knowledge, blind-ladder-of-inference)
   Evidence: PRD distinguishes terminal panes, project sessions, composer, agent hooks, activity log, and direct harness. That is internally coherent, but the names are close enough that a future implementer could map Codex chat rows to chats, composer to a chat box, sessions to tabs, or model selector to direct API mode.
   Severity: medium - expected damage is implementation drift by future agents; plausibility is high because the docs already had several correction passes from misunderstood translations.
   Mitigation: add a short architecture glossary: `project`, `project session`, `pane`, `agent profile`, `composer`, `app action`, `activity event`, `direct harness`. Include "is / is not" bullets and one diagram.

## Same-Model-Repetition Notes

- Premortem, inversion, and unknown-unknowns all surfaced the missing session contract from the same evidence, so the convergence raises priority but not certainty.
- Red-team and falsification both surfaced permission theater from the same roadmap ordering; this is one finding, not two.
- Chesterton's Fence and steelman both warned against over-importing Vanta; the evidence differs slightly because one protects `agent cli`'s boundary while the other gives Vanta's best case.
- Survivorship bias and Johari Window both point to missing user/workflow validation; this is same-model repetition until a real timed workflow test or user run confirms it.
- Curse of knowledge and ladder of inference both flagged naming confusion; this is one documentation/architecture finding.

## Residual

- This audit did not run a separate model or true subagent; all findings are from one reasoning pass over the real files, so correlated blind spots remain.
- The audit did not execute Vanta, `agent cli`, or a prototype composer flow; it inspected source/docs only.
- The audit did not compare against CMUX, Ghostty, VS Code internals, or Codex app internals beyond the local screenshots and existing research notes.
- The audit did not interview the user with a clickable prototype; workflow-fit claims still need a live task run.
- No finding from blind-dunning-kruger beyond the general caution that direct API/MCP harness implementation is outside the currently proven `agent cli` path and must be externally verified when built.
- Self-audit caveat: this audit graded its own evidence; nothing here was spot-checked by an outsider or a second model.
