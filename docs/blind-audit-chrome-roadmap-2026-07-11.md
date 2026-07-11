# Blind-Spot Audit: Chrome Re-Convergence + Roadmap/PRD Coverage — 2026-07-11

Target: the 2026-07-11 chrome re-convergence effort and the roadmap/PRD as planning documents — "what missing items are not yet captured?"
Frameworks applied: all 16 (premortem, inversion, unknown-unknowns, chestertons-fence, falsification, survivorship-bias, outside-view, red-team, steelman, consider-the-opposite, calibration, dunning-kruger, johari-window, ladder-of-inference, curse-of-knowledge, bias-blind-spot) — run as 16 parallel read-only agents against the repo with a shared ground-truth brief. ~60 raw findings merged to 20; 5 debunked; several downgraded after dispatcher fact-checks against primary sources.

Every accepted finding below was landed as a roadmap card (93–106), an existing-card amendment, a PRD edit, or a PARKED entry — see "Disposition" per finding.

## Findings (severity-ranked)

1. **All visual proof is of the empty first-open state — the core product surfaces (live PTY output in the run card, stacked activity rows, populated multi-project sidebar, multi-pane) have never been screenshot-verified.** (via survivorship-bias; convergent with premortem and consider-the-opposite on *different* evidence: screenshot inventory vs gate scope vs demo composition survival.)
   Evidence: `docs/qa/app-shell/first-open-*.png` are empty states; the only populated captures are the stale pre-convergence fixture; `native-run.png` predates the re-convergence. The known missing `docs/qa/chrome-delta/native-run.png` is one slice of this.
   Severity: high — the re-convergence could still "read wack" under real content, and nothing would catch it; plausibility high because terminal content is dense and unlike the demo's placeholder cards.
   Disposition: new card **RUN-CONTENT-DENSITY-QA** (v1, buildOrder 93) — includes the live-pty native capture and a ≥600px run-column legibility floor (folds in the falsification lens's plausible `usableAgentWidth`-vs-run-column test gap and red-team's multi-drawer width math).

2. **"Verified (partial)" wording on DAILY-DRIVER-METRICS/PERF-BUDGET reads as North-Star proof while the actual measurements (timed live runs, VS Code memory/CPU comparison) don't exist.** (via calibration; convergent with red-team on different evidence: STATE wording vs docs boundary text.)
   Evidence: `docs/daily-driver-metrics.md` "Current Boundary" says readiness only; STATE.md leads with "VERIFIED".
   Severity: med-high — the product's central claim is unproven while the docs sound proven; plausibility high (wording already misled two audit lenses).
   Disposition: new card **DAILY-DRIVER-LIVE** (rock, v1, 94) with explicit fail thresholds + Gemini TUI smoke (johari #4 folded in); DAILY-DRIVER-METRICS summary reworded to "readiness gate".

3. **The demo shows structured agent cards that v1 cannot render (gated on AGENT-HOOKS), and no doc or in-app copy sets that expectation; nothing mechanically prevents a future "infer cards from terminal text" regression.** (via red-team + steelman + consider-the-opposite — three lenses, three evidence trails: demo composition, provenance-gate absence, CSS-only nature of the fix.)
   Severity: med — expectation mismatch + architectural-integrity risk; plausibility med (the boundary is currently prose-only).
   Disposition: RUN-CARDS-ADAPTER amended (provenance test in done criteria: run cards render only from real event sources, enforced by an automated check); PRD Chrome UI Polish gains a one-line v1/v2 expectation caveat.

4. **No WCAG contrast computation exists for any of the 2026-07-11 token retargets (`#252732`, `#22242d`, steel-cyan pairs), and only one `prefers-reduced-motion` block guards the chrome.** (via dunning-kruger + chestertons-fence + survivorship-bias.)
   Evidence: DECISIONS.md shows contrast was computed for Ghostty ANSI colors (2026-07-07) but never for chrome tokens; `grep -c prefers-reduced-motion App.css` = 1.
   Severity: med — a11y regressions invisible to the builder's eye; plausibility med.
   Disposition: new card **A11Y-CHROME-AUDIT** (v1, 95) — contrast ratios recorded, target-size verification (note: dispatcher downgraded the pseudo-element hit-area claim — `::after` regions are part of the button's pointer hit-testing and SR users activate via focus, so this is a verify-item, not a defect), reduced-motion sweep, icon-only control labels.

5. **The drawer mode switcher hides its labels unconditionally (`.drawer-mode-switcher__button span { display:none }` even expanded) and the `>` app-commands are discoverable only via the composer placeholder.** (via curse-of-knowledge + consider-the-opposite, same CSS line independently found.)
   Severity: med — discoverability debt that lands on future-Jason; plausibility high (confirmed in shipped screenshots).
   Disposition: icon-switcher labels/tooltips folded into **A11Y-CHROME-AUDIT** (95); new card **APP-COMMANDS-DISCOVERABLE** (v2, 104) for `>help` + palette listing; the in-app shortcut reference remains KEYBINDINGS-CONFIG scope.

6. **Inter is the first font in `--font-ui` but is not bundled — every screenshot baseline was captured against whatever fonts the build machine has.** (via dunning-kruger; dispatcher-confirmed: zero font deps/preloads in package.json + index.html.)
   Severity: med — the shipped look silently depends on local font installation; plausibility high.
   Disposition: new card **CHROME-FONT-LOCK** (v1, 96/97 ordering below).

7. **The re-convergence loop was fully self-referential: the same session diagnosed the drift, authored the contract, implemented, and verified — Jason's eye never formally signed off on the converged shell, and the demo's 3-control grammar was never audited for whether it scales to a real app's ~50 needed controls.** (via bias-blind-spot + ladder-of-inference + johari-window — different evidence: process history, inference rungs, zero-outside-eyes structure.)
   Severity: med-high — this exact pattern produced the original drift; plausibility high (it already happened once).
   Disposition: new card **CHROME-EYEBALL-SIGNOFF** (v1, 96) — side-by-side sign-off before CHROME-CONTRACT-V2 locks, with grammar-scale exceptions documented; **OUTSIDE-REVIEW** (v2, 105) for one external pass; SECOND-MODEL-SPOT-CHECK parked (PARKED.md).

8. **Reference-class gaps: crash resilience, persisted-state schema migration, IME/international input, window/display lifecycle, uninstall/reset — zero cards existed for any of them.** (via outside-view; partially convergent with unknown-unknowns.)
   Severity: med (crash/migration/IME) to low (window, uninstall) — all pre-existing gaps, not caused by the chrome work.
   Disposition: new cards **CRASH-RESILIENCE** (v2, 100), **STATE-MIGRATION** (v2, 99), **TERMINAL-INTL-INPUT** (v2, 101), **WINDOW-LIFECYCLE** (v2, 102), **UNINSTALL-RESET** (v3, 106).

9. **Built-feature guards nobody named: concurrent pane exit/restart status atomicity, pane-cwd vs active-editor project mismatch, titlebar project-ownership when pane/editor/browser projects differ, activity-log 200-event overflow policy.** (via unknown-unknowns.)
   Severity: med (cwd mismatch) to low — classic "feature built, guard unnamed."
   Disposition: one consolidated card **WORKBENCH-STATE-GUARDS** (v2, 98).

10. **Motion/interaction feel was never part of the re-convergence — 5 transition declarations and zero entrance/selection animations against chrome-ui-polish.md's own micro-motion criteria.** (via consider-the-opposite; dispatcher note: the demo is also static, so this is not demo-divergence — it's an unexecuted polish criterion.)
    Severity: low-med (post-launch polish per anti-drift rules).
    Disposition: new card **MOTION-POLISH** (v2, 103).

11. **Smaller foldable items:** FIRST-OPEN-LAYOUT needs true-first-launch vs persisted-layout tests, a reset-to-demo affordance, and a first-spawn-failure recovery banner (inversion + premortem); CHROME-CONTRACT-V2 needs the fixture refresh, titlebar-crumb overflow/detached-HEAD rules, and overlay side-by-side captures (premortem + falsification + consider-the-opposite); PERF-BUDGET needs the render-perf gate (frame time at 1/2/4 panes, IPC payload, jank threshold) (steelman); TRAY-TAB-CHROME carries an "M may be L" risk note (calibration).
    Disposition: existing-card amendments.

## Debunked (the failure mode is live — lenses drift on facts)

- Red-team claimed the shipped composer still has a boxed text "Send" button — false; slice 1 shipped the icon-only filled send. The lens cited the delta-audit's *baseline* column as current state.
- Consider-the-opposite claimed the drawer defaults to collapsed — false; collapse is a persisted user choice, default expanded. (Its label finding survives on other evidence.)
- Inversion claimed the gate "violates the CHROME-CONTRACT-V2 promise" — mis-framed; the card is planned `next` work, not a broken promise. (Its substance confirms the card's priority.)
- Card-number/column drift across several lenses (e.g. "SETTINGS buildOrder 47 now", "card 154", "116 cards") — canonical: 92 cards pre-audit, SETTINGS bo69 next.
- Unknown-unknowns claimed detected dev-server URLs open ungated — STATE.md records opens route through the existing app-action gate; downgraded to a wording clarification.

## Residual (what this audit could not see)

- No lens ran the app. Every finding is static-analysis of code/docs/screenshots; runtime behavior (jank, focus order, real TUI rendering in the new cards) remains unobserved until RUN-CONTENT-DENSITY-QA and DAILY-DRIVER-LIVE execute.
- No outside human or second model: all 16 lenses are the same model with different prompts. Convergence between them is weaker evidence than it looks; three "convergent" findings were counted only where evidence trails genuinely differed.
- Jason's actual taste — the thing the re-convergence serves — is represented here only by two quoted sentences. CHROME-EYEBALL-SIGNOFF exists precisely because this audit cannot substitute for his eye.
- The demo itself was not audited against *its own* quality (is the demo right?) beyond the ladder-of-inference note that it hardened from hedged approval ("I think") into a "binding" contract.
- Self-audit caveat: this audit graded its own evidence; the dispatcher fact-checked numeric/factual claims against primary sources, but no finding was spot-checked by an outsider or a second model.

## Null results

No framework returned zero findings; the weakest yields were falsification (mostly confirmed existing card scope) and chestertons-fence (removals were largely documented decisions).
