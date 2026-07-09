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

Settings, command palette, diff/review, and later multi-pane rails will consume the same tokens when their roadmap cards create real surfaces. Browser preview now uses the shared control, field, focus, and surface tokens. Icon replacement stays in `ICON-SYSTEM`; this slice only defines the chrome styling contract around current icons and text controls.

## QA

Run `cd app && npm run qa:editor`. The screenshot set now includes:

- one-project workbench: `selected`, `dirty`, `narrow`
- context menu: `context-menu`
- recovery/alerts: `save-error`, `save-conflict`, `dirty-modal`
- state palette: `chrome-states`
