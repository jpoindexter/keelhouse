# Chrome Polish System

This is the v0.5 chrome baseline for Keelhouse. It keeps the app dense and work-focused while giving future surfaces a shared styling contract.

## Token Layers

- **Primitive tokens:** raw grays and status colors live in `:root` in `app/src/App.css`.
- **Semantic tokens:** app background, rail background, surfaces, borders, active rows, focus rings, text levels, danger, warning, success, and info states map primitives to meaning.
- **Component tokens:** controls, menus, badges, overlays, motion, and shadows consume semantic tokens. New chrome should use these before adding new raw colors.

## Current Components

Shared states now cover:

- Chrome buttons: rail actions, editor actions, recovery buttons, composer actions, modal actions, and profile select.
- Menus: context menu surface, item hover/focus, disabled state, danger state, and shortcut column.
- Badges/status: dirty markers, warning badges, terminal running/starting/exited/error/idle states.
- Fields and overlays: composer input, CodeMirror search panel, editor recovery alert, launch alert, and dirty-draft modal.
- Motion: short functional transitions with a `prefers-reduced-motion` override.

## Deferred Surfaces

Browser preview and diff/review now use the shared control, field, focus, and surface tokens. Settings, command palette, and later multi-pane rails will consume the same tokens when their roadmap cards create real surfaces. Icon replacement stays in `ICON-SYSTEM`; this slice only defines the chrome styling contract around current icons and text controls.

## QA

Run `cd app && npm run qa:editor`. The screenshot set now includes:

- one-project workbench: `selected`, `dirty`, `narrow`
- context menu: `context-menu`
- recovery/alerts: `save-error`, `save-conflict`, `dirty-modal`
- state palette: `chrome-states`

## Contrast Audit (A11Y-CHROME-AUDIT, 2026-07-11)

WCAG relative-luminance ratios computed for every chrome text token against every chrome surface (`#141414` app, `#1b1c23` panel, `#191a22` card, `#252732` row-active, `#22242d` row-hover, `#1d1e25` statusbar, `#162c33` accent-soft):

| Token | Worst-case surface | Ratio | AA (4.5) |
| --- | --- | --- | --- |
| `--color-text` #d7d7d7 | accent-soft | 10.12 | pass (AAA) |
| `--color-text-muted` #a6a8b6 | accent-soft | 6.17 | pass |
| `--color-text-subtle` **#8f92a1 (retuned)** | accent-soft | 4.71 | pass |
| — previous subtle #707383 | accent-soft | 3.10 | **fail — replaced** |
| `--steel-cyan-400` #9bd9e3 | accent-soft | 9.31 | pass (AAA) |
| `--steel-cyan-500` #67c3d1 | accent-soft | 7.14 | pass |
| danger #ffb5c0 / warning #e2c06d / success #8fd9a3 | row-active | 8.4–8.9 | pass (AAA) |
| demo red #d16d6d (diff badges only) | row-active | 4.32 | large/mono-badge use only — not for essential small text |

Fix applied: `--color-text-subtle` retuned from `var(--gray-500)` (#707383) to `#8f92a1` at the semantic layer; primitives untouched. Essential small text (recency stamps, section labels, hints, chips) now passes AA on every surface it sits on.

Also verified in this audit:
- **Reduced motion:** the existing `@media (prefers-reduced-motion: reduce)` block applies `transition-duration/animation-duration: 0.01ms !important` via the universal selector — all current and future transitions are covered globally; no per-declaration guards needed.
- **Icon-only drawer switcher:** label spans changed from `display: none` (removed from the accessibility tree, name relied on title fallback) to a visually-hidden clip pattern, in both expanded and collapsed states; `title` tooltips remain for pointer discovery.
- **Pointer targets:** flat controls carry `::after { inset: -7px 0 }` extensions giving ~38-40px vertical pointer targets; pseudo-elements participate in the button's own hit-testing, and keyboard/AT users activate the focusable element directly, so target-size intent is met without DOM changes. Horizontal extension is deliberately zero to keep adjacent toolbar targets non-overlapping.

## Themes (THEME, 2026-07-11)

Themes remap primitive/semantic tokens only — component rules never change (`[data-theme="mono-ghost"]` block at the end of App.css). Graphite + steel-cyan stays the default and the chrome-contract reference; mono-ghost desaturates the substrate to near-black and the accent slots to ghost gray-blue. The theme persists as `appTheme` in workspace.json and applies via `data-theme` on the root element; the selector lives in Settings → App configuration. New surfaces must consume tokens (never raw hexes) or they will not retheme — the 2026-07-11 token promotion (--surface-strip, --overlay-border, --field-bg, --titlebar-top) exists for exactly this reason.
