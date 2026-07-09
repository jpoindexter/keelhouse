# Composer Harness

COMPOSER-HARNESS turns the bottom composer into a compact control surface around real terminal panes. It does not replace the Codex/Gemini/Claude terminal UI.

## Implemented

- Composer state is scoped by project/session in `composerHarnessBySession`.
- Permission mode is visible and drives the app-owned action gate: Ask, Approve safe, and Full access.
- The harness shows target project, session, and pane beside the selected agent profile.
- The profile selector stores the selected launch profile and can switch future/new pane profile choice between Codex, Gemini, Claude, and Shell.
- Goal text persists per session and is included in prompt payloads when present.
- Attachments support local file references, current editor file, and browser preview/screenshot references with remove controls.
- Prompt sends include transparent goal and attachment context before the draft only when those fields are present.
- Permission, goal, profile, attachment, prompt, and app-action decisions are logged to the activity timeline.

## Boundaries

- Attachments are references, not copied file contents or screenshots. Agents receive paths/URLs in the prompt context; app-owned read/screenshot tools belong to AGENT-HOOKS and DIRECT-AGENT-HARNESS.
- The profile selector does not grant external CLI permissions. Each CLI still enforces its own auth and policy.
- Mic input remains out of scope until voice capture is a real requirement.

## Verification

- `npm run build`
- `npm test`
- `cargo test` with Zig 0.15 path
- `cargo fmt --check`
- `npm run qa:editor`
- Screenshot inspection of selected and narrow captures
- `git diff --check`
