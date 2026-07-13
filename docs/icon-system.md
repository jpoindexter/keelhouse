# Icon System

Keelhouse uses `lucide-react` as the single SVG icon family for v0.5 chrome. Icons are outline-first, inherit `currentColor`, and sit on a 16px dense-workbench grid.

The native app identity is separate from toolbar glyphs. `app/resources/branding/keelhouse-app-icon.png` is the 1024-class source; Tauri-generated PNG/ICNS/ICO assets live in `app/src-tauri/icons/`. The mark is one warm-white geometric `K` on a graphite macOS squircle. It has no internal panels, crest, character illustration, gradient orb, orange accent, cyan band, or generic AI sparkle motif.

## Implementation

- `app/src/icons.tsx` is the local contract. App code imports `AppIcon` and named mappings instead of importing Lucide icons directly.
- `.app-icon` in `app/src/App.css` fixes size, optical alignment, and color inheritance.
- Object icons cover workspace, folder, open folder, file, file-plus, and folder-plus.
- Action icons cover open, save, search, send, stop, close, copy/path-adjacent file actions, and terminal actions.
- Status icons map current pane states: running -> loading, starting -> waiting, exited/error -> error, idle -> idle.
- Activity status icons are typed for future timeline rows: thinking -> thinking, running -> loading, waiting -> waiting, error/exited -> error, complete -> complete.

## Rules

- Keep labels beside icons unless the glyph is universal and the control has an `aria-label` plus tooltip.
- Use filled/stronger treatment only for active or stateful meaning; default chrome stays outline.
- Do not mix icon families in one surface.
- Keep the native mark legible at 16px: one silhouette, two colors, no fine internal detail, and no duplicate badge container inside the macOS icon mask.
- New icons should be added to `app/src/icons.tsx` first, then consumed by components.
- Git status and diff review now use the shared icon contract. Source-host and multi-pane-specific icons wait until those surfaces exist. Browser preview uses the shared icon contract for navigation, reload, URL, and external-open controls.
- Regenerate native bundle assets with `cd app && npx tauri icon resources/branding/keelhouse-app-icon.png`; do not hand-edit derived sizes.

## QA

Run `cd app && npm run qa:editor`. The fixture uses inline SVG/currentColor to mirror production delivery and captures icon-bearing states in `selected`, `context-menu`, `chrome-states`, and `narrow`.
