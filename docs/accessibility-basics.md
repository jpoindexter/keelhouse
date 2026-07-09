# Accessibility Basics

Keelhouse v0.5 targets a practical keyboard and labelling baseline for the dense workbench chrome. This is not a full WCAG audit; it is the minimum daily-driver accessibility contract for the current surfaces.

## Implemented Baseline

- File rail action buttons have explicit accessible names for create file, create folder, and open folder.
- The workspace root control has a useful workspace/no-workspace label.
- Editor tabs put `role="tab"` and `aria-selected` on the actual focusable tab button, not a wrapper.
- The terminal canvas is keyboard focusable and labelled as the active terminal pane.
- The composer textarea has a real accessible name instead of relying on placeholder text.
- Browser preview controls are native buttons/form controls with labels for Back, Forward, Reload, Preview URL, Open, and Open externally; the iframe has a descriptive title.
- The agent profile picker has an explicit accessible name.
- Context menus keep focus, focus the first enabled item on open, support Arrow Up/Down, and close with Escape.
- Terminal canvas focus uses the shared visible focus ring.

## Deferred

- Full modal focus trapping and focus return.
- Screen-reader review of the Ghostty canvas terminal transcript.
- Automated accessibility scanning once a browser-driven app harness exists.
- Git/diff, settings, deeper project rail, and multi-pane accessibility rules when those surfaces exist.

## QA

Run `cd app && npm run qa:editor`. The fixture mirrors the labelled rail buttons, browser toolbar, terminal canvas, composer input, tab semantics, and context-menu role/label structure used by the app.
