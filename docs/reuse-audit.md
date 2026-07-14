# Reuse Audit (REUSE-AUDIT, amended 2026-07-13)

What existing projects and references can contribute to Keelhouse without changing its chat-first product shape. The 2026-07-12 pass covered only this repository and incorrectly concluded that nothing remained to extract. The 2026-07-13 amendment audits `/Users/jasonpoindexter/Documents/GitHub/apps/hashmark`, which is directly relevant prior art.

## Pulled in (reused, shipped)

| Source | Reused as | Where |
| --- | --- | --- |
| `spike-ghostty-vt/` | The entire terminal foundation: real pty → `libghostty-vt` → cell-grid snapshot. Its verified API shape (`Terminal::vt_write`, `Point::Screen/Viewport`, `graphemes` on `GridRef`) is exactly what `app/src-tauri/src/lib.rs` uses. | `app/src-tauri` terminal thread, `snapshot`, `search_terminal_rows` |
| `spike/` (editor-fidelity) | Decision input only — resolved "does a TUI editor satisfy the VS Code expectation?" (no) and steered the app to a real GUI CodeMirror editor. Documented in DECISIONS.md 2026-07-07. | ARCHITECTURE.md editor choice |
| `rockmap/` | Live tooling: `build-roadmap.mjs` renders `roadmap.json` → `roadmap.html` and is run on every card close. Not a spike — an in-use build step. | `roadmap.html`, every roadmap commit |
| `demo/keelhouse-chrome-demo.html` | The binding chrome contract. Drove the entire chrome re-convergence (control grammar, run/composer cards, sidebar rhythm, overlays, first-open layout). | `docs/chrome-contract.md`, `docs/chrome-delta-audit.md`, `App.css` |
| `demo/cockpit-demo.html` | Mood reference for the graphite substrate; the THEME `mono-ghost` palette derives from it. | `[data-theme="mono-ghost"]` block in `App.css` |
| `ghostty/config` | Terminal theme/config reference used while tuning ANSI/truecolor rendering. | palette resolution in `snapshot` |

## Parked (available, not yet pulled in)

| Source | Why parked | Promotion trigger |
| --- | --- | --- |
| `zellij/agent.kdl`, `install.sh` | The zellij trial path was superseded by the Tauri build (DECISIONS.md 2026-07-07). Kept as the record of the trial that justified building custom. | None — historical; do not resurrect without a DECISIONS.md entry. |
| `resources/superconductor-reference/` (Info.plist, super.icns, NOTES.md) | Reference-only competitor material. `super.icns` is another product's icon — must NOT ship. NOTES.md is UX-pattern reference. | App-icon and packaging work (PACKAGING card) may mine NOTES.md for patterns, never the icon. |
| `rockmap/examples`, `roadmap.schema.json` | Schema/examples for the vendored generator; only `build-roadmap.mjs` + `roadmap.json` are load-bearing. | Only if the roadmap board gains features. |

## Hashmark extraction map

Hashmark already solves much of the agent-chat layer Keelhouse had omitted. Reuse the contracts and tested behaviors; port code only where the framework and safety boundary match.

Hashmark is licensed under Business Source License 1.1 with personal, non-commercial production use allowed and a 2029-01-01 MIT change date. Jason owns both repositories, but direct source copying into a differently licensed or commercial Keelhouse release still needs an explicit relicensing decision. Until then, treat Hashmark as source-grounded behavioral prior art and reimplement narrowly.

| Hashmark source | Decision | Keelhouse use |
| --- | --- | --- |
| `app/src-tauri/src/db.rs`, `sessions.rs` | Adapt | SQLite WAL migrations; durable chats/messages; provider/model/thread metadata; pin, fork lineage, token counts, and checkpoint references. Keep layout preferences in Tauri Store. |
| `web/server/harness-cli.ts`, `web/client/src/hooks/useChatStream.ts` | Adapted behavior, independently implemented | Provider-event normalization, per-chat streaming state, cancellation, usage, compaction, plans, questions, and tool results now run through a provider-neutral Rust contract for Codex and Claude. Reconnect/poll recovery and spawned-session events remain separate roadmap work. |
| `app/src/components/ChatPane.svelte`, `Compose.svelte` | Reimplement in React | Markdown/code rendering, copy/retry, jump-to-latest, inline tool approvals/results, per-chat drafts/history, `@file` context chips, pasted images, model selection, and visible elapsed state. |
| `app/src-tauri/src/mcp.rs`, `mcp_oauth.rs` | Adapt after hardening | Stdio and HTTP MCP lifecycle, tool discovery/calls, server health, bearer/OAuth configuration. Replace blocking reads and plaintext token-bearing config with async I/O and OS-safe secrets. |
| `app/src-tauri/src/checkpoint.rs`, `sessions.rs::fork_session` | Concept only | Fork/restore UX and message lineage. Do not copy checkpoint creation: `git add -A` mutates the user's index, and restore uses destructive `reset --hard` plus `clean -fd`. Design a non-index-mutating snapshot and previewed restore gate first. |
| `app/src-tauri/src/harness.rs` | Pattern only | Pending-approval registry, allow-once/deny/limited-always decisions, tool danger analysis, MCP dispatch, and sub-agent lineage. Keelhouse should keep provider execution in adapters instead of owning a second LLM tool loop. |
| Hashmark shell/sidebar screenshots and activity rail | Reject | They are editor/orchestrator-first and reintroduce the activity rail, dense dashboard, and VS Code-copy direction already rejected for Keelhouse. |

### Unsafe details not to copy

- `web/server/harness-cli.ts` passes the prompt in argv and uses `--dangerously-skip-permissions`; Keelhouse must keep prompts off argv and preserve visible approval policy.
- `ChatPane.svelte` renders `marked` output through raw HTML without an explicit sanitizer; use a safe React Markdown pipeline.
- The desktop Compose stop button changes frontend state but does not prove process cancellation; Keelhouse's stop path must terminate only the selected chat run.
- Hashmark's global streaming state is not sufficient for simultaneous independent chats; Keelhouse keeps run state keyed by chat id.
- Hashmark's BSL 1.1 does not automatically become Keelhouse's license. Record an explicit same-owner relicensing decision before copying implementation code into a commercial or differently licensed release.

## Findings

- **The prior audit missed the highest-value prior art.** Hashmark should have been inspected before Keelhouse implemented its chat harness.
- **Reuse backend behavior, not product chrome.** Hashmark validates the multi-chat, approvals, persistence, MCP, checkpoint, and orchestration requirements while Keelhouse retains its approved Codex/Zed-derived shell.
- **Port in dependency order.** Finish the current Codex multi-chat native proof, then durable storage, rich messages, real approvals, composer context, history/forking, provider adapters, MCP, and orchestration.
- **One licensing watch-item:** `resources/superconductor-reference/super.icns` is a third-party app icon. The PACKAGING card must source Keelhouse's own icon; this file is reference only and must not be bundled.
