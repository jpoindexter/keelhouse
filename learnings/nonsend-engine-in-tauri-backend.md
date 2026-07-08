# Isolating a `!Send` engine (libghostty-vt) in a Tauri backend

**Context:** SPIKE-2 — hosting Ghostty's terminal engine (`libghostty-vt` 0.2.0) in a Tauri Rust backend that reads a pty and pushes frames to a canvas frontend.

**Insight:** `libghostty-vt`'s types are all `!Send`/`!Sync` (the underlying C API may use thread-local state). This is the constraint that dictates the whole backend shape — discover it *before* designing, by reading the crate's `lib.rs` thread-safety notes, not after fighting the borrow checker.

**The pattern that works:**
- The `Terminal` lives on **exactly one thread**, and is *created inside that thread's closure* (never constructed elsewhere and moved in — that won't compile).
- A **separate reader thread** does the blocking pty read and forwards raw bytes over an `mpsc` channel. It touches only the pty reader clone (which *is* `Send`), never the `Terminal`.
- The terminal thread `recv`s bytes, calls `vt_write`, serializes the grid into a plain `Send` struct, and emits it via `AppHandle::emit` (`AppHandle` is `Send`+`Sync`).
- Split the pty **writer** (`Box<dyn Write + Send>`) off with `take_writer()` and put *that* — not the Terminal — into Tauri `State` for the input command. Input and parsing thus never share the non-Send object.
- Route resize through the same channel as bytes (enum `Msg::Data | Msg::Resize`) so the single owner applies both; when coalescing queued messages, match *all* variants so a resize can't be silently dropped.

**Generalizes to:** any `!Send` C-binding (parsers, codecs, VMs) embedded in an async/multi-threaded Rust host. Confine it to one actor thread; let only `Send` handles (writers, channel senders, app handles) escape. Serialize state *out* rather than sharing the object.

**Cross-refs:** `spike-2/src-tauri/src/lib.rs`; DECISIONS.md 2026-07-07 "SPIKE-2 PASSED".
