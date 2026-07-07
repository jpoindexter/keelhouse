# Spike: libghostty-vt in a Rust backend

Proves the core architecture question: can a Tauri app (Rust backend, React chrome) host real terminal panes using Ghostty's actual parsing engine, instead of xterm.js?

## Result: yes, verified

```bash
PATH="/opt/homebrew/opt/zig@0.15/bin:$PATH" cargo build && ./target/debug/ghostty-vt-spike
```

Real pty (`portable-pty`) → real `ls -la -G` process → real ANSI escape codes captured → fed through `libghostty-vt`'s `Terminal::vt_write()` (the actual Ghostty codebase, Rust bindings) → read back cell-by-cell via `grid_ref()`/`graphemes()` → correct output.

## Caught during the spike

- `libghostty-vt-sys`'s build script requires **Zig pinned to exactly 0.15.2** — the latest (`brew install zig`, 0.16.0) breaks the build with a real stdlib signature change (`std.Io.Dir.readFileAlloc`). Fix: `brew install zig@0.15`, scope it onto `PATH` for this build only — don't relink globally, other projects may need the newer zig.
- API note: `graphemes()` lives on `GridRef`, not `Cell` — `grid_ref.graphemes(&mut buf)`, not `grid_ref.cell()?.graphemes(...)`.

## What this doesn't prove yet

- Rendering the parsed cell state to actual pixels (this spike only prints to stdout) — next step would be a canvas renderer in the Tauri frontend consuming this state over IPC.
- Performance under heavy/fast output (large build logs, TUI redraws) — not stress-tested.
- Color/style extraction — `graphemes()` proved text content; `Cell`'s `style.rs`/`semantic_content` APIs exist for fg/bg/bold/etc. but weren't exercised here.
