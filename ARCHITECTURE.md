# ARCHITECTURE — Keelhouse

The technical design that doesn't fit the one-page PRD. Stack is locked (DECISIONS.md 2026-07-07). The repository/package slug is still `agent-cli`; Keelhouse is the product name used in user-facing docs and app metadata.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Shell | Tauri 2 | Native window, tiny footprint, Rust backend. Jason's stack (indx/hashmark/brutal). |
| Frontend | React + TypeScript + Vite | Matches existing projects; the chrome (sidebar/tabs/panes) is genuinely just UI. |
| Terminal engine | `libghostty-vt` 0.2.0 (Rust) | Ghostty's *actual* parsing engine, extracted for embedding. Real VT/xterm correctness without reinventing it. **Verified** (`spike-ghostty-vt/`). |
| PTY | `portable-pty` | Real ptys hosting real `claude`/`codex` processes. Verified. |
| Terminal render | Canvas 2D (v0) | Ship-ugly. WebGL only if perf demands it (measure first). |
| Editor (v0.5) | CodeMirror 6 | Lighter than Monaco, good for the VS Code-shell replacement slice, real syntax highlighting. |
| State | React state / Zustand | Keep it boring for v0. |
| Persistence | Tauri Store for lightweight workbench preferences; direct `rusqlite` WAL database for chats | JSON remains appropriate for layout and recent-project preferences. Chat conversations, messages, provider thread ids, run state, and usage require transactions, migration ordering, recovery, and later relational search. |

## Primary chat flow

The center surface is not a terminal transcript. A chat is keyed by `project root + chat id` and persists app-owned user/assistant/tool messages plus the provider's resumable thread id.

```text
[composer prompt]
      ↓ Tauri command (stdin; prompt is not placed in argv)
[codex exec --json / exec resume --json]
      ↓ JSONL stdout events
[Rust chat_harness event bridge]
      ↓ chat-run-event
[typed frontend reducer]
      → transactional SQLite chat timeline
      → independent run/stop/error state per chat
```

Codex is the first structured adapter and reuses the user's local OAuth. Provider-native JSON owns message/tool semantics; terminal text is never parsed into chat structure. Gemini and Claude remain explicit raw-terminal fallbacks until equivalent adapters are implemented.

## Raw terminal flow (one pane)

```
[agent process: claude / codex]
      ↕  stdin / stdout over pty
[portable-pty master]  ────────────────┐
      ↓ raw bytes (incl. ANSI)         │  RUST BACKEND (Tauri)
[libghostty-vt Terminal::vt_write]     │
      → cell grid state (chars +       │
        fg/bg/style per cell)          │
      ↓ serialize (dirty cells)        │
──────────── Tauri IPC event ──────────┘
      ↓
[canvas renderer]  ────────────────────┐
      → pixels                          │  REACT FRONTEND
[keyboard / mouse capture]              │
      ↑ encode via libghostty-vt key.rs │
──────────── Tauri command ────────────┘
      ↑
[portable-pty master write] → agent stdin
```

**Ownership boundary:** backend owns provider processes, ptys, and terminal state; frontend owns persisted chat presentation, rendering, and input capture. Structured provider events and terminal grids are separate IPC channels. Per raw-terminal pane: one pty + one `Terminal` instance + one render surface.

## Terminal foundation status

The parsing spike proved bytes → correct cell grid. The promoted `app/` code, originally built as `spike-2/`, then proved the real Tauri render/input loop:
1. **Rendering** the cell grid to pixels on a canvas in a native window.
2. **Input** roundtrip — keyboard → encoded bytes → pty → shell/agent reacts.
3. **Shortcut and clipboard basics** — paste, clear, Option word movement/delete, canvas selection, copy.

The remaining v0 work is not terminal architecture discovery; it is hardening the app wiring around the proven loop: package/root promotion, launch env/auth checks, and local state reset behavior.

### Rendering approach (v0)
- Canvas 2D, monospace grid. Each cell: glyph + fg/bg. Redraw dirty cells only (libghostty-vt exposes cell state; diff against last frame).
- Batch on `requestAnimationFrame` — don't repaint per byte; coalesce backend updates into one frame.
- IPC payload: start with full-grid snapshots for correctness; move to dirty-region deltas if the snapshot is too heavy. Measure before optimizing.

### Input approach (v0)
- Capture keydown on the focused pane's canvas. Encode via libghostty-vt's `key.rs` (handles ctrl/alt/arrows/function keys, kitty keyboard protocol, bracketed paste).
- Send encoded bytes to the pty master over a Tauri command.

## Concurrency (v1+, note now)
N panes = N ptys + N `Terminal` instances + N render loops. Each pty read runs on its own backend task; frontend renders only the visible/focused panes at full rate, throttles background panes. Watch memory/CPU with many agents — a real risk at Jason's "3+ agents per project" usage.

## Known risks

| Risk | Severity | Mitigation |
|---|---|---|
| Render pipeline can't keep up with fast output / TUI redraws | Med | SPIKE-2 proved the path; keep rAF batching, add dirty-region deltas only if measured jank appears |
| Input fidelity (every key/mod/escape right) | Med | Lean on libghostty-vt `key.rs`; keep regression tests for shortcuts and real-app smoke tests |
| Zig 0.15.2 pin (build breaks on 0.16) | Med (setup friction) | Documented; `zig@0.15` scoped to build; pin in any CI |
| libghostty-vt is v0.2.0, young, API may churn | Med | Pin the version; the spike already caught one API shape (`graphemes` on `GridRef` not `Cell`) |
| Many concurrent panes exhaust memory/CPU | Med (v1+) | Throttle non-focused panes; measure at 3-4 agents |
| Scope creep (this is a big app) | **High — session history proves it** | v0 is one pane; v0.5 is the file rail/editor shell; tabs/panes wait for v1 |
