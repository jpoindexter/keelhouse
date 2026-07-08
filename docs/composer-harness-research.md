# Composer Harness Research

The Codex-style bottom composer can be more than a text box, but it should not replace the real terminal agent UI. Treat it as an app-owned harness around selected terminal agents and app actions.

## Sources Checked

- OpenAI Agents SDK: supports server-owned tools, state, human review, tracing, and app-controlled workflow logic: <https://developers.openai.com/api/docs/guides/agents>
- OpenAI MCP/connectors: Responses API can list/call MCP tools, emits tool-call items, and defaults MCP calls toward approval because data sharing can be sensitive: <https://developers.openai.com/api/docs/guides/tools-connectors-mcp>
- Claude Code permissions: supports ask/allow/deny rules and permission modes for read, shell, and file modification behavior: <https://code.claude.com/docs/en/permissions>
- Claude Code hooks: lifecycle hooks can run deterministic commands when Claude edits files, needs input, or hits other lifecycle points: <https://code.claude.com/docs/en/hooks-guide>
- Tauri plugins/config: Tauri has config and plugin surfaces for native app behavior; community/core plugins include clipboard, native context menu, screenshots, tracing, and typed IPC options: <https://v2.tauri.app/plugin/>

## Recommended Shape

### v0.5: Prompt Router

- Bottom composer sends text to the selected real terminal pane through the pty.
- Shows selected project/session/pane target.
- Supports send, stop/interrupt, multiline input, history, and paste.
- No direct model API and no fake chat transcript.
- Uses the agent session handle contract in `docs/harness-contract.md`, even if the first implementation only wraps one selected pane.

### v1: Harness Shell

- Add Codex-like controls: permission mode, goal chip, model/profile selector, mic placeholder, attachments, and stop/send state.
- Permission modes apply to app-owned actions first: `Ask for approval`, `Approve safe actions`, `Full access`.
- Goal state is session metadata and visible in the rail/activity log.
- Attachments become file/screenshot references the selected agent can inspect through app-owned commands, not opaque prompt blobs.
- Activity timeline records prompt submitted, approval changed, goal changed, attachment added, action approved/denied, and stop sent.
- App-owned actions route through a minimal action gate before permission UI is exposed.

### v2: Direct Agent Harness

- Optional direct API agent path using app-owned tools/MCP, human review, resumable state, and tracing.
- Still coexists with real CLI panes; it does not replace Claude/Codex terminal sessions.
- Use only for workflows that need app-owned orchestration across files, panes, browser preview, source control, and MCP.

## Vanta Harness Notes

Vanta is useful as a reference class, not as a runtime to copy. The portable ideas are:

- persistent agent session handles with `open/send/read/close/list` semantics
- explicit approval-gated state-changing actions
- route hints so agent-related prompts use the app-owned path instead of raw shell commands
- normalized activity events for gate/tool/action output

Reject the Vanta defaults that do not fit this product: tmux as the pane backend, Docker autonomous mode, self-evolution loops, and broad plugin/runtime scope. Agent cli already owns native ptys and should keep real Claude/Codex terminal panes first-class.

## Implementation Implications

- Composer state belongs to the selected project session: target pane, permission mode, goal, draft text, attachments, and model/profile.
- Permission changes must be visible and logged.
- App-owned tools must route through the same approval policy as the UI.
- CLI-specific permission modes should be passed to Claude/Codex only when the CLI supports them; otherwise the app enforces its own actions and labels the limitation.
- Attachments need size/type limits, temp storage, remove controls, and provenance in the activity timeline.
- The composer should be keyboard-first and match VS Code/Codex expectations: Enter send, Shift+Enter newline, Escape blur/close menus, Cmd+K/command palette conflict documented.
- Do not show Codex-style permission controls until app-owned actions have a real action gate and activity audit trail.
