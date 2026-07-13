# Settings Workspace QA

Executed against the packaged macOS app on 2026-07-13.

- `native-general.png`: full-window Settings destination with grouped navigation, search focus, flat selection, and a real Global setting.
- `native-search.png`: cross-category search showing project-scoped Git and remote rows.
- `narrow-tool-tabs.png`: narrow right dock after Files/Editor/Browser/Git labels collapse to icon-only controls.
- `native-scoped-inheritance.png`: Project scope selected after resetting its explicit profile override; the value visibly inherits from Global.
- `native-compact-navigation.png`: packaged app at 904x643 with compact Category navigation active inside the native minimum-width range.

Live interaction also navigated to Agents, created a Project-level Codex override over the Global Shell value, reset it to inheritance, and returned through `Back to app` without losing the active chat. The first native scope change exposed a released-event crash; the handler now captures the value synchronously and the rebuilt package completed the workflow. Automated coverage verifies inheritance resolution/migration, scope change/reset, category navigation, search clearing, a real layout callback, Back/Escape return, and the responsive chrome contracts.
