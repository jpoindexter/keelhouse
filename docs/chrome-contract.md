# Chrome Contract

Status: v2 gate prepared and the 2026-07-13 composer/selection correction has refreshed packaged-native evidence. Jason's explicit sign-off remains before the contract is formally locked. Control grammar was added after the boxed-button drift; see `docs/chrome-delta-audit.md` and DECISIONS.md 2026-07-11.

Keelhouse chrome follows the accepted `demo/keelhouse-chrome-demo.html` direction: graphite surfaces, steel-cyan accent, direct project/thread drawer, agent-first center, Files/Editor/Browser/Git right dock, and a bottom utility tray for Terminal/Processes/Logs. Browser exists once, in the right dock. The demo is binding at the control-grammar and shell-geometry levels, not only tokens.

## Control Grammar (v2, normative)

Exactly three default control types, from the demo:

- **Flat text action:** no background, no border, weight 600, `--color-text` ink, hover → `--steel-cyan-400`. Used for Review/Approve-class actions, lifecycle controls, and labelled toolbar commands. Danger variants stay flat in danger ink.
- **Transparent icon button:** 16px glyph, no box, color-only hover (muted → ink). Hit area extended to ≥40px via padding.
- **Filled Send/Stop position:** the single default filled control position — 28px circular Send at rest; Stop replaces Send while a chat run is active. Modal-confirm primaries are the only other filled buttons.

Actives: tabs may use a steel-cyan top/bottom underline with subtle tint; rows use quiet `#252732` background contrast only. Decorative left stripes are prohibited in project/chat rows, files, settings, command results, and user prompts. Cards: 6px radius, `#191a22`, shadow elevation (`0 12px 34px rgba(0,0,0,.18)`). Composer: integrated 8px-radius surface with restrained depth. Type scale: Inter/SF Mono 14px conversation / 13px controls / 12px meta+mono / 11px uppercase labels.

## First-Open Layout (v2)

First open shows the demo layout: 332px Threads drawer, centered conversation+composer column (`min(860px, 100% - 56px)`), 430px right dock open on Files, collapsed 42px bottom utility tray, and 24px statusbar. Returning users keep persisted layouts. The right dock remains movable/closable; the bottom tray is vertically resizable and never replaces chat. Codex's observed `48rem` variant was a useful reference, not a transferable requirement.

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
- Decorative cyan side highlights on selected rows, prompts, files, settings, or palette results.
- Pill-heavy active rows and obvious rounded-rectangle action chrome.
- Boxed default buttons (`--control-bg` fill + border) anywhere in titlebar, toolbars, composer, or drawer — this shipped once and passed the token-level gate; CHROME-CONTRACT-V2 makes it a failing check.
- Border-heavy depth in place of shadow elevation on cards, composer, menus, and overlays.

## Agent Run Surface

- Structured agent chat is the persistent primary surface; raw terminal is a bottom-tray escape hatch for direct TUI interaction.
- Each user prompt starts one visual turn; assistant, tool, status, and error events remain directly beneath that prompt until the next user prompt.
- Observable prompt, approval, file, command, error, browser, git, and app events appear as inline provenance in the conversation.
- Keelhouse does not infer structured chat, tool events, or thinking from terminal text. Codex and Claude use explicit provider JSON adapters; providers without one route to raw terminal.
- The composer stays pinned below output and activity.
- Its footer exposes real attachment, permission, goal, Codex model, reasoning effort, stop, and send controls. Static labels must not stand in for hidden settings.
- Permission, goal, model, and reasoning state persist per chat and reach the native Codex run request. Unsupported controls such as voice input stay absent rather than appearing as dead chrome.

## Real App Port Signals

- The side drawer uses mode-aware product nouns. The default Projects mode is `Project chats`, not a generic `Drawer`.
- The center work surface is labelled as an agent conversation and remains mounted while utilities open. The bottom tray exposes Terminal, Processes, and Logs; its splitter resizes vertically and its tabs collapse back to a 42px strip. Right-clicking a utility or pane tab exposes lifecycle actions.
- First open shows Files in the right dock. Files, Editor, Browser, and Git can be selected from the shared tray tabs; tools can dock left, right, or bottom or be hidden.

## Control Chrome Signals

- Toolbar controls are flat by default: no enclosing segmented-control box around the agent surface or tray layout switchers.
- Active toolbar state uses a small steel-cyan underline and subtle tint, not a filled rounded pill.
- Terminal pane tabs stay flat with an underline active state; they never use rounded or half-capsule selection chrome.
- Pane, browser, collapse, and lifecycle icon buttons use hover/focus feedback without default rectangular chrome.
- The primary titlebar contains global workspace controls only: drawer toggle, workspace identity, provider state, and overflow. Thread-local actions stay in the thread header or drawer.
- The terminal toolbar retains the selected profile label but renders universal New, Find, Restart, Kill, and Close actions as 16px icons with `aria-label` and tooltip text. Toolbar controls keep a 12px outer inset and at least a 28px interaction box.
- The status bar reports real workspace, provider, and active-surface state only. Placeholder integrations such as `Prettier` are prohibited.
- Browser preview chrome responds to tray width; narrow trays hide the redundant Open button before controls overlap.
- Tool tray tabs measure their rendered width in the native split view: full labels become active-label-only, then icon-only, before controls can collide. CSS container queries remain progressive enhancement rather than the sole resize gate.

## Native Engineering Review

**Engineering verdict: corrected composition and controls hold in populated native states.** The rebuilt packaged `Keelhouse.app` was reviewed through Computer Use at 1232px and 900px widths with restored multi-project chat history. Selected project/chat rows and user prompts use surface contrast without cyan side rules. The composer keeps `Attach / Ask / Goal / Codex / Send` visible at both widths; approval and Codex runtime popovers open above it without clipping; long prompts wrap without overlap. Model/reasoning command wiring is covered separately by Rust tests. Jason's aesthetic sign-off remains open.

Native evidence:

- `docs/qa/chrome-v2/native-desktop.png` — packaged desktop layout after Reset interface.
- `docs/qa/chrome-v2/native-900.png` — packaged minimum-width layout with the tool dock collapsed.
- `docs/qa/chrome-v2/native-composer-permission.png` — packaged approval-mode menu.
- `docs/qa/chrome-v2/native-composer-runtime.png` — packaged model/reasoning menu.
- `docs/qa/interaction-contract/shell-simplified-desktop.png` — simplified packaged shell with one Browser surface and reduced global chrome.
- `docs/qa/interaction-contract/shell-simplified-terminal.png` — raw Shell pane in the bottom tray with flat tabs and icon-only universal actions.

The transient crash-recovery notice is dismissible status feedback, not persistent chrome; it was dismissed before sign-off captures. A restored Browser preference may show the target page's own white or error surface, but first-open/reset remains Files-first.

This review is implementation evidence, not a substitute for Jason's explicit visual sign-off. The prior 48rem pass was rejected as visually disjointed; `CHROME-EYEBALL-SIGNOFF` and the formal `CHROME-CONTRACT-V2` lock remain open until Jason accepts the corrected populated state.

## Tool Tray Signals

- The shared strip exposes `Files`, `Editor`, `Browser`, and `Git`; one compact menu controls dock position and optional split mode.
- `Split` shows editor and browser with the secondary splitter.
- Single-tool modes hide unused surfaces and remove the secondary editor/browser splitter.
- Tray mode is a local workbench preference so daily-driver layout does not reset between launches.

## Verification

Run from `app/`:

```bash
npm run qa:chrome-contract
```

The gate checks the accepted demo, real app-shell sources, exact 1440/1024/900 first-open dimensions, populated and overlay evidence, packaged native desktop/minimum-window screenshots, steel-cyan tokens, rejected warm accents/avatar labels, absence of decorative side highlights, functional composer controls, native model/reasoning wiring, flat toolbar grammar, centered composer values, Files-first tray structure, crumb overflow, and detached-HEAD labeling.

For visible chrome changes, run both:

```bash
npm run qa:shell
npm run qa:editor
```

`qa:shell` captures the actual React app. `qa:editor` remains a deterministic fixture for editor, menu, diff, modal, and failure states; fixture evidence alone is not enough to claim the app shell works. Packaged native proof is stored under `docs/qa/chrome-v2/`.
