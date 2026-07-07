# ROADMAP — agent cli

Source of truth: `roadmap.json` → `roadmap.html` (rockmap board). This file is the plain-text index — rebuild the board after editing `roadmap.json`:

```bash
node rockmap/build-roadmap.mjs roadmap.json roadmap.html
```

## v0 — Shippable to one user (Jason)

1. ~~**Editor-fidelity spike**~~ — **PASSED 2026-07-07.** See DECISIONS.md.
2. ~~**R1: Zellij cockpit trial**~~ — **PARKED 2026-07-07**, not abandoned mid-trial for no reason: Jason rejected the static-config interaction model directly ("this should work like vscode — you open, pick a folder"). Real config kept at `zellij/`, cheap to revisit. See PARKED.md.
3. **cmux adopted** — verified in source 2026-07-07 (native folder-picker, real terminal panes, real inline VS Code, multi-agent split panes). See DECISIONS.md.
4. **Blind-spot audit of the fork decision** — **DONE 2026-07-07.** `docs/blind-audit-cmux-fork-decision-2026-07-07.html`. Found and corrected a false claim: cmux's chrome is config-themeable via `cmux.json`, likely making a fork unnecessary.
5. **Try cmux's real appearance config — IN PROGRESS.** `sidebarAppearance.*`/`workspaceColors.*` tokens, applying flow-app-shell + flow-navigation guidance (indicator style, sidebar width/collapse, chrome-vs-content material). Jason to confirm it reads as "clean and modern."
6. **Decide: config satisfies, or fork-vs-build-fresh** — blocked on step 5's verdict. If forking: weigh the named risks first (Sparkle auto-update clobber, monorepo scope, toolchain fragility — see the audit doc).
7. **P1: Ship v0** — a real, versioned `cmux.json` config in this repo, once step 5/6 lands.

## v1 — after real use

- P2: Worktree helper (one keystroke = new git worktree + agent launched in it)

## v2 — only if earned

- R3: Tauri 2 native harness — gated harder now than before: fires only if *both* cmux's config *and* a scoped cmux fork fail. See DECISIONS.md for the exact threshold.
- P3: Zed stripped-down fallback config (documented, not built)
- S2: Mine Superconductor bundle for UX patterns — **only if R3 actually fires**, not scheduled by default.
