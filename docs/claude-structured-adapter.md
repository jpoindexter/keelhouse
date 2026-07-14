# Structured Claude Adapter

`CLAUDE-STRUCTURED-ADAPTER` adds Claude Code as the second provider behind Keelhouse's provider-neutral chat contract. It does not parse terminal output and does not replace the optional raw Claude terminal profile.

## Implemented

- Starts a new Claude session or resumes a stored provider session through `--input-format stream-json` and `--output-format stream-json`.
- Writes the prompt as newline-delimited JSON to stdin. Prompt text is never placed in process arguments.
- Normalizes partial text, visible thinking status, tool calls/results, usage, compaction, plan updates, questions, completion, and failure into the same chat events used by Codex.
- Routes Bash, file-change, and other tool permission requests through the shared chat approval surface and returns allow/deny control responses to Claude.
- Stops only the selected Claude run and preserves per-chat provider/session ownership.
- Checks the installed CLI for the required structured-stream flags before launch.
- Preserves Claude's existing OAuth/session environment. Keelhouse does not copy Hashmark's prompt-in-argv or `--dangerously-skip-permissions` behavior.

## Verification

Rust fixtures cover malformed input, partial message and tool JSON, usage, questions, compaction, plan updates, approval decisions, capability failures, and argv safety. Frontend tests cover Claude provider persistence, labels, and shared event rendering. The installed CLI was inspected without sending a paid prompt: Claude Code `2.1.197` advertises the required stream, resume, session, and permission flags, and `claude auth status` reports an existing `claude.ai` session.

Run from `app/`:

```bash
npm test
npm run build
cd src-tauri && cargo test claude_adapter
```

## Remaining Gate

The card is not Done until the packaged app executes authenticated new-session, resume, approval, stop, usage, and relaunch flows. That live pass is deferred while the macOS session is locked and must not consume Claude quota without explicit approval.
