# Chrome Contract

Status: active guardrail, verified 2026-07-09.

Keelhouse chrome follows the accepted `demo/keelhouse-chrome-demo.html` direction: graphite surfaces, steel-cyan accent, direct project/thread drawer, agent-first center, and editor/browser/git/raw terminal as trays.

## Required Tokens

- Primary accent: `#67c3d1`
- Strong accent: `#9bd9e3`
- Muted accent surface: `#162c33`
- App CSS exposes these through `--steel-cyan-*`, `--blue-*`, and semantic `--color-accent-*` tokens.

## Rejected Drift

- Orange/warm accent dominance.
- Purple-heavy gradients or one-note palettes.
- Fake browser/window chrome inside the app shell.
- Decorative activity rails that do not map to real app modes.
- Chat/avatar identity blocks such as `You ·` or `Keelhouse ·`.
- Pill-heavy active rows and obvious rounded-rectangle action chrome.

## Agent Thread Surface

- Chat/activity is the default surface; raw terminal remains available as an escape hatch.
- Activity renders as a thread of prompt, approval, file, command, error, browser, git, and app events.
- Event rows use `agent-thread-event` cards with status icons and compact metadata, not a spreadsheet-like log table.
- The composer stays pinned below the thread.

## Verification

Run from `app/`:

```bash
npm run qa:chrome-contract
```

The gate checks the accepted demo, app chrome sources, required chrome screenshots, steel-cyan tokens, rejected warm accent tokens, rejected avatar labels, and flat active-thread treatment.

For visible chrome changes, also run:

```bash
npm run qa:editor
```

Spot-check at least `docs/qa/editor-parity/selected.png` and `docs/qa/editor-parity/narrow-composer.png`.
