# Chrome UI Polish Scope

The app should feel as finished as Codex in the surrounding workbench chrome, while staying lean. Polish means consistent systems, not decorative bulk.

Implementation baseline: `docs/chrome-polish-system.md` records the current v0.5 token/state contract and deferred surfaces.

## Surfaces

- Left project/session rail, file rail, editor tabs, terminal pane headers, browser preview toolbar, settings shell, command palette, context menus, dialogs, toasts, badges, and status strips.
- Use a compact macOS desktop density: dense rows, clear hit targets, hover/focus states, and no oversized landing-page treatment.

## Visual System

- Use a three-tier token model: primitive tokens, semantic role tokens, then component tokens only when needed.
- Define semantic roles for background, sidebar, surface, raised surface, border, active row, hover row, focus ring, text, muted text, danger, warning, success, info, and agent activity.
- Dark mode should avoid pure black and pure white; elevation is surface-lightness plus hairline borders, not heavy shadows.
- Built-in themes are allowed; arbitrary plugin theming is not.

## Icon System

- Use one SVG icon family, sized consistently for 16px/20px dense chrome.
- Outline icons are default; selected/active states may use filled or stronger treatment.
- Non-universal icons need labels or tooltips. Icon-only buttons need accessible names.
- Status badges must cover running, thinking, waiting, attention needed, errored, exited, complete, dirty, untracked, and remote/CI state.

## Interaction Polish

- Every chrome control needs hover, active, disabled, focus-visible, loading, empty, error, and success states where applicable.
- Context menus, command palette labels, tooltips, menu bar labels, and keyboard shortcuts must share the same command names.
- Micro-motion should be short and functional: row selection, pane resize, menu open, toast entrance, progress/status change. Respect reduced motion.
- Text must not truncate critical state unless a tooltip or full label is available.

## Visual QA

- Verify key screens with screenshots before calling chrome done: one-project workbench, multi-project rail, settings, context menu, command palette, browser preview, diff/review, and agent attention state.
- Check 1280px desktop and a narrow minimum window.
- Check light/dark or all built-in themes, keyboard focus traversal, and contrast for body text, icons, badges, and focus rings.
