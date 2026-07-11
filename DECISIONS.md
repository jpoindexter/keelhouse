# DECISIONS — Keelhouse

Append-only. Don't edit past entries — add a new one that supersedes.

## 2026-07-07 — Zellij + Ghostty as first trial

**Choice:** Trial zellij (terminal multiplexer) + Ghostty + yazi (TUI file manager) as the primary candidate, before building anything custom.

**Alternatives considered:** Tauri native app from scratch, Zed stripped to terminal+rail, extending hashmark, Superconductor.app as the sole answer.

**Why:** Closest textual match to Jason's stated wants (real Claude TUI, explorer+open-files, light/fast, tabs=projects) per July 2026 OSS survey. Zero build cost.

**Caveat added 2026-07-07 (same day, post-audit):** This verdict was computed *before* two later signals arrived — Jason expected the file editor to "look like VSCode's" (screenshot: tabs, syntax highlighting, GUI rendering) and rejected two color-scheme defaults before picking one by eye. Both signals point toward wanting more GUI fidelity than a TUI structurally delivers. Corrected confidence in "zellij is the right first trial": **~55%**, not treated as settled. The editor-fidelity spike (below) exists to resolve this before sinking a week into config.

**Reversible?** Yes — zero app code committed to this choice yet.

**Update 2026-07-07 — editor-fidelity spike verdict: PASS.** Jason ran `hx spike/sample.tsx`, compared against his VSCode screenshot: line numbers/gutter present, real tree-sitter syntax highlighting with distinct colors for keywords/strings/types/comments/JSX tags, readable and usable for real editing. Confidence in "zellij is the right first trial" restored to ~85%. R1 (the real week-long trial) starts now — `zellij/agent.kdl`.

## 2026-07-07 — R3 (Tauri rewrite) firing threshold

**Choice:** R3 only fires if the zellij and/or Superconductor trials surface frictions matching this list. Decided *before* either trial starts, specifically to prevent a post-hoc, sunk-cost-biased call.

**Would justify R3:**
- The editor-fidelity spike (see below) shows a TUI editor is visually unusable for real work, not just "different" — e.g. can't tell diff hunks apart, syntax highlighting absent for TS/Swift.
- Real, reproducible TUI-in-TUI input routing failures — a keybind or mouse action that goes to zellij instead of the agent inside it, more than occasionally, with no config fix found in an hour of searching.
- Losing the real Claude Code TUI (Superconductor's chat-UI substitute) is confirmed to actively hurt trust/legibility in agent output after a real week of use, not just "feels different."

**Would NOT justify R3:**
- Minor yazi/zellij keybind friction that's fixable by config.
- "I'd prefer it look nicer" without a concrete task it blocked.
- Wanting more panes/tabs than tested — that's a config change, not an architecture failure.
- Superconductor's chat UI being "fine but not preferred" — preference alone isn't a blocker.

**Why:** Per blind-spot audit 2026-07-07 (`docs/blind-spot-audit-2026-07-07.html`): the roadmap's original done-criterion asked "does this friction alone justify the Tauri build?" *after* the trial week, when sunk-cost pressure is highest. Naming the bar now removes that bias.

**Reversible?** Yes — this is a documented threshold, not code. Can be revised with a new dated entry if the trial surfaces something not anticipated here.

## 2026-07-07 — S2 (mine Superconductor for UX patterns) re-gated

**Choice:** S2 only runs if R3 actually fires. Previously scheduled in the roadmap regardless of trial outcome, which meant 2 of 3 trial outcomes (zellij loses, or Superconductor "wins" but is closed-source and can't be forked) both routed back toward the Tauri rewrite anyway — undermining the claim that R3 is genuinely gated on trial failure.

**Why:** Per blind-spot audit — a gate that's structurally pre-wired toward firing isn't a gate.

**Reversible?** Yes.

## 2026-07-07 — Course correction: zellij's static-config model rejected

**What happened:** After R1 (zellij) shipped as a real KDL config with hardcoded project tabs, Jason said plainly: "this should work like VSCode — you open, pick a folder." A text config with fixed paths is a fundamentally different interaction model than an app with a folder/workspace picker — no amount of KDL polish closes that gap.

**Choice:** Pause presenting zellij/KDL as the primary path. Try Superconductor's actual open/pick-folder flow now, promoted ahead of a full R2 trial week — a few minutes of hands-on use answers "is this the right interaction model" faster than either roadmap card does.

**Why this isn't a surprise:** The blind-spot audit (2026-07-07) already flagged this exact risk — corrected confidence in "zellij is right" was ~55%, specifically because Jason's VSCode-editor-fidelity expectation and color pickiness both pointed toward wanting more GUI-app behavior than a TUI delivers. This is that risk landing, on the interaction model this time instead of just the editor.

**Not thrown away:** `zellij/agent.kdl` stays in the repo — cheap to revisit if Superconductor's model doesn't fit either. The real cost so far is small (a few hours), which is the point of trialing cheap things first.

**Reversible?** Yes.

## 2026-07-07 — Pivot to cmux; theme built for it

**What happened:** Jason found `cmux` (manaflow-ai, GPL-3.0, Swift/AppKit, built on libghostty) — a native macOS terminal built specifically for running AI coding agents in parallel. Verified in source (not docs): `showOpenFolderPanel()` gives a real native folder picker creating a workspace (matches "open, pick a folder"); `openDirectoryInInlineVSCode()` runs `code serve-web` and opens the **actual installed VS Code** in a browser pane split next to the terminal (matches "editor should look like VSCode's" — literally, not a lookalike); Workspaces → Surfaces → Split panes gives real simultaneous multi-agent panes running actual CLI tools via a real pty. Closes every gap the zellij/hashmark comparison found.

**Choice:** cmux is now the primary path. `zellij/agent.kdl` stays in the repo (cheap, still usable if needed) but is no longer the shipped artifact.

**Design:** Jason called cmux's stock look "horrible," wants clean/modern even as a terminal. Built an OKLCH-derived, contrast-verified palette (see `color-and-elevation` skill) for Ghostty (which cmux's terminal panes inherit directly) — chrome tones reused from the already-approved mono-ghost demo palette for consistency; ANSI accent colors (red/green/yellow/blue/magenta/cyan) newly built, desaturated per dark-mode convention, all pairs verified >=4.5:1 contrast against bg (not eyeballed). Font: JetBrains Mono (confirmed already installed). Config: `~/.config/ghostty/config`. cmux's own appearance mode set to Dark via `defaults write com.cmuxterm.app appearanceMode dark`.

**Also registered:** `terminal-love` MCP (Jason's own server, wraps Terminal Trove — real screenshots/GIFs of TUI/CLI tools) via `claude mcp add --scope user`, for future design-reference lookups without web-search guessing.

**Reversible?** Yes — theme is config-only, no app code changed. zellij work not deleted.

## 2026-07-07 — Correction: cmux's chrome IS config-themeable; fork question likely moot

**What happened:** Earlier this entry claimed cmux's native sidebar/tab-bar chrome "isn't config-themeable" and would need Swift source edits. A `/blind` audit (`docs/blind-audit-cmux-fork-decision-2026-07-07.html`) flagged this as unverified. Re-cloned cmux and read the real source directly: `Packages/macOS/CmuxSettings/Sources/CmuxSettings/Keys/SidebarAppearanceCatalogSection.swift` and `WorkspaceColorsCatalogSection.swift` are real, shipped files exposing `tintColorHex`, `lightModeTintColorHex`/`darkModeTintColorHex`, `tintOpacity`, `blurOpacity`, `cornerRadius`, `material`, `blendMode`, `preset`, `selectionColorHex`, `customColors` — all settable via `~/.config/cmux/cmux.json`, zero Swift editing.

**Choice:** try cmux's real appearance config before considering a fork. The earlier claim was simply wrong — I hadn't searched the settings catalog deeply enough before asserting it.

**Why:** verified firsthand against the actual source, not relayed from a subagent.

**Reversible?** Yes — this is a correction to a prior DECISIONS.md entry, not a new irreversible commitment.

## 2026-07-07 — Course correction: build our own app, not adopt cmux

**What happened:** After the cmux config-correction, planning docs were updated to frame "cmux + config" as the v0 plan. Jason rejected this directly: "why are you pushing cmux we are trying to build our own." Correct — cmux was answering "is this app good" when the actual instruction, stated back in `demo/cockpit-demo.html`'s own caption, was to build our own thing while leveraging real open source *projects* (zellij, yazi, Ghostty's terminal engine) as components — not adopt a finished third-party app.

**Choice:** Build a native app — Tauri (Rust backend, matches Jason's existing stack across indx/hashmark/brutal) + React chrome (sidebar, tabs — matches the demo's UI) + real terminal panes hosting real `claude`/`codex` processes.

**Terminal engine choice, verified via spike (`spike-ghostty-vt/`):** `libghostty-vt` — Rust bindings to Ghostty's actual parsing engine (same core cmux/Mux0/Supacode use, extracted specifically for embedding) — not `xterm.js` (weaker parser, extra webview rendering layer, closer to "the vscode shit" Jason rejected). Spike proved: real pty → real `ls -la -G` → real ANSI codes → `libghostty-vt` parses correctly → cell-by-cell readback matches exactly. Runs in Tauri's Rust backend directly, no cross-language FFI hack needed.

**Toolchain note:** requires Zig pinned to exactly 0.15.2 (Homebrew's default 0.16.0 breaks the build) — real but minor setup cost, documented in `spike-ghostty-vt/README.md`.

**Why:** Terminal rendering fidelity is the core value proposition of this app — the engine matters more than the chrome framework. `libghostty-vt` gives real Ghostty-grade parsing without reinventing VT100/xterm emulation from scratch (a non-starter) and without settling for a weaker, heavier alternative.

**Reversible?** Yes — spike only, no production code committed yet.

## 2026-07-07 — Trials run sequentially, not in parallel

**Choice:** R1 (zellij) runs its full week first; R2 (Superconductor) starts only after R1 concludes.

**Alternatives considered:** Running both simultaneously (original roadmap — both in "now" column).

**Why:** Daily-driving two competing cockpits in the same week confounds every friction with tool-switching cost — no way to attribute a papercut to the right tool.

**Reversible?** Yes.

## 2026-07-07 — Superconductor binary removed from git

**Choice:** `resources/super.engineering.app` (117MB signed closed-source binary) removed from the repo going forward. Kept as a screenshot + settings-key notes instead.

**Why:** Per blind-spot audit — you can't mine UX patterns from a compiled binary, so committing the actual executable had no benefit, only downside (licensing exposure if repo is ever made public or shared; permanently bloats git LFS history).

**Reversible?** The removal is reversible (can re-add). The historical LFS object stays in git history either way — full purge would need a history rewrite, not done here since this is a private repo with no other clones/collaborators to disrupt.

## 2026-07-07 — Full stack locked

**Choice:** Tauri 2 (native shell, Rust backend) + React/TS/Vite (frontend) + `libghostty-vt` 0.2.0 (terminal engine) + `portable-pty` (ptys) + Canvas 2D (terminal render, v0) + CodeMirror 6 (editor, v2) + `tauri-plugin-sql`/SQLite (persistence). Toolchain: Zig pinned to 0.15.2. Full rationale in ARCHITECTURE.md.

**Alternatives considered:** xterm.js for terminal rendering (rejected — reimplements VT parsing weakly + adds a webview render layer, closer to the "vscode shit" rejected; libghostty-vt gives real Ghostty parsing in the same Rust backend). Monaco for the editor (heavier than CodeMirror for an inline pane). Native Swift/AppKit (Jason isn't a Swift dev; Tauri matches his actual stack).

**Why:** Terminal fidelity is the product's core value, so the engine (libghostty-vt) matters most and is verified. Everything else is the stack Jason already ships in (indx/hashmark/brutal).

**Reversible?** Per the anti-drift rule: locked until v0 ships. Switching before then = explicitly throwing away the work. After v0, a change needs its own DECISIONS entry.

## 2026-07-07 — Repeatedly converting "evaluate X" into "adopt X" in the plan (logged, corrected)

**Choice:** Named as a recurring failure this session (also in ERRORS.md): "check out cmux" → wrote "adopt cmux + config" into PRD/ROADMAP as the plan, twice, without Jason ever choosing it. Corrected to build-our-own on his direct pushback ("why are you pushing cmux we are trying to build our own"). The `demo/cockpit-demo.html` caption stated the real instruction all along — leverage open-source *projects* as components, build our own app.

**Why it matters:** The mechanical tool-streak hook (added this session, `~/.claude/settings.json`) is a partial backstop, but the specific failure here was writing a not-yet-chosen option into the source-of-truth docs as decided. Fix: an evaluation writes to PARKED or a DECISIONS "considering" note, never to PRD/ROADMAP scope, until Jason picks it.

**Reversible?** N/A — this is a process note, not a technical choice.

## 2026-07-07 — SPIKE-2 PASSED: render+input loop proven; scaffold merged into it

**What happened:** Built `spike-2/` — a real Tauri 2 app (React/Vite + Rust backend) that runs the full terminal loop: pty (`portable-pty`) → `libghostty-vt` parse → grid snapshot serialized over Tauri IPC → Canvas 2D paint; keydown → minimal JS encoder → bytes → `write_pty` command → pty. Verified by hand in the real window: zsh prompt renders (JetBrains Mono, color, block cursor), typing echoes, arrows/ctrl-c work, and `claude`'s fullscreen TUI renders correctly. **The one remaining rock is dead** — rendering, input, and TUI fidelity are all proven, not just parsing.

**Design call (refines ROADMAP):** merged SPIKE-2 with the "minimal scaffold" step instead of proving the loop in a standalone Rust window. Rationale: the render risk I flagged lives at the **Tauri IPC seam** (Rust cell-grid → webview → canvas), which only exists once Tauri is in play — a pure-Rust window would have proven the wrong thing. `spike-2/` is therefore the real app foundation, not a throwaway.

**Architecture forced by the engine:** all `libghostty-vt` types are `!Send`/`!Sync`, so the `Terminal` cannot cross threads. Structure: a **reader thread** does the blocking pty read and forwards raw bytes over an `mpsc` channel; a **terminal thread** owns the `Terminal` (created in-thread) + the pty master (for resize) + the child, applies bytes, and emits grid snapshots via `AppHandle`. Only the pty *writer* (which is `Send`) goes into Tauri state for the input command. See `spike-2/src-tauri/src/lib.rs`.

**Shortcuts taken (ship-ugly, logged, non-blocking):** minimal JS key encoder (no kitty protocol / full modifier encoding), full-grid snapshots per frame (rAF-coalesced, not dirty-region diffed), no wide-CJK / scrollback handling. Upgrade only if measured need appears (e.g. fast-output jank → dirty-region deltas).

**v0 remaining (small):** folder picker (`tauri-plugin-dialog`) → spawn `claude` in chosen cwd (currently hardcoded `$SHELL` in `$HOME`) → persist last folder + reopen on relaunch. Then promote `spike-2/` to the repo's app root.

**Reversible?** The spike code is disposable-but-promotable; the *finding* (the loop works on this stack) is the durable result. Stack stays locked (v0 not yet shipped).

## 2026-07-08 — Product framing corrected: lean VS Code workflow replacement

**What happened:** Jason clarified the actual job this project exists to do. His current workflow is not "use VS Code as an IDE"; it is "use VS Code as a project/file shell around real Claude/Codex CLI terminals." The useful VS Code parts are the file explorer and file editor. The rest is resource-heavy chrome. He often runs multiple agent terminals against one project and has multiple projects open as separate VS Code windows.

**Choice:** The product is framed as a lean replacement for that workflow: project tabs, file rail, real file editor, and real Claude/Codex CLI terminal panes. The terminal foundation remains v0, but file rail/editor are not distant garnish; they are the v0.5 shape that makes the app a plausible VS Code-shell replacement.

**Why:** Earlier PRD/ROADMAP drafts under-translated this into "terminal cockpit first, rail/editor later." That misses the point: replacing the VS Code shell requires the explorer/editor surfaces as core product value, even if they follow the one-pane terminal foundation by one release slice.

**Reversible?** Only if Jason's actual workflow changes. Treat this as the product north star for roadmap sequencing.

## 2026-07-08 — Library choices locked from deep research

**What happened:** Ran a deep-research pass (6 angles, 26 sources fetched, 119 claims extracted, 24/25 survived 3-vote adversarial verification) on how to execute each remaining build area without dead-ends. Full report + citations: `docs/vision-to-reality-2026-07-08.html`.

**Choices (all primary-sourced):**
- **Editor:** `@uiw/react-codemirror` (v4.25.x, wraps CM6). CM6 core ~300KB vs Monaco ~5–10MB; Monaco doesn't support webview apps, CM6 does. Add languages via the `extensions` prop. Don't hand-roll the React bridge.
- **File rail:** `ignore::WalkBuilder` (respects .gitignore/.ignore/global by default) + `notify` (FSEvents) + `notify-debouncer-mini` (debouncing is NOT in notify core — omitting it = event storms on npm install/builds) + **React Arborist** 3.12.0 (virtualized VS-Code-style tree, built-in rename/keyboard/ARIA/filter).
- **Persistence:** Tauri **Store plugin** (JSON, 100ms autosave) for v0/v0.5 workspace state → Tauri **SQL plugin** (SQLite, transactional migrations) only when state turns relational (v1).
- **Multi-process:** `portable-pty` (already in use) scales to many panes — SPIKE-2's two-thread-per-pty design is exactly WezTerm's `LocalPane` shape. Reuse per pane.
- **Packaging:** ad-hoc sign for local use; Developer ID + notarization only to distribute. Avoid `externalBin` sidecars (break notarization in Tauri 2.x).

**Terminal render nuance (important):** the xterm.js "WebGL is 3–10× faster than Canvas" benchmark is for xterm.js, where JS does VT parsing. Here parsing is already in Rust and only the cell grid crosses IPC — so the bottleneck is **IPC volume, not draw calls**. Canvas 2D already passed the render test. Fix order if fast-output stutters: **dirty-region deltas first** (what Ghostty's render thread does), WebGL only if measured IPC-bound. The "WebKit lacks WebGL2" blocker was **refuted** — GPU path is available, just not yet needed.

**Not settled (measure, don't search):** exact high-frequency IPC pattern + WKWebView throughput ceiling; CM6 vs Monaco for >1MB files; memory/CPU ceiling at 4–8+ concurrent agent ptys. See report open questions.

**Reversible?** Library picks are per-phase and swappable before each is built; the research is a decision aid, not a lock. Re-check version pins at implementation time.

## 2026-07-08 — Execution discipline for the build-out

**Choice:** Execute the remaining roadmap as thin vertical slices under fixed guardrails (full detail in ROADMAP.md "Execution discipline"):
- One slice at a time, each usable end-to-end before the next; app runnable at every commit.
- Measure-don't-preempt: dirty-region IPC deltas (not WebGL) only when fast output stutters; measure the pty process ceiling only when running 4–8 agents; SQL/worktrees/WebGL/theming built at the phase that needs them, not earlier.
- One driver per file per slice (`lib.rs`/`App.tsx` get a single owner per slice) to prevent concurrent-edit clobbers — a real risk this session, when Jason and Claude edited `lib.rs` in parallel.
- First concrete step: **APPROOT** — promote `spike-2/` to the app root, remove the diagnostic `[key]`/`[paste]` `eprintln!` traces, then the v0 folder-picker → spawn-claude → persist-last-folder slice.

**Why:** The roadmap plus research is now detailed enough to invite building breadth ahead of proven need — the documented over-engineering failure mode (CLAUDE.md §4). Naming the discipline in the source-of-truth docs, not just chat, is the countermeasure.

**Reversible?** It's a working method, adjustable per slice; not a technical lock.

## 2026-07-08 — Agent launch profile for v0

**Choice:** v0 launches the selected workspace with a persisted `launchProfile` stored in Tauri Store (`workspace.json`). The default profile is `claude` with `useLoginShell: true`, so user-shell PATH setup such as nvm is honored. The Rust backend accepts the profile from the frontend and executes it in the selected cwd; it does not hardcode Claude inside the pty layer.

**Why:** The v0 product wants "pick folder → real Claude pane" by default, but the app must not bake one CLI forever into the terminal engine. A small profile object gives the next slices a path to Codex/shell profiles without building settings UI early.

**Verified:** 2026-07-08 real app run: `spike-2` launched a direct child process `claude`, the child cwd was `/Users/jasonpoindexter/Documents/GitHub/apps/agent cli`, and a cropped screenshot confirmed Claude Code v2.1.197 rendered in the canvas.

**Reversible?** Yes. The profile schema is intentionally small and can be replaced by the later SETTINGS/AGENT-PROFILES work without changing the terminal-thread architecture.

## 2026-07-08 — Terminal hardening uses Ghostty viewport state

**Choice:** Scrollback is implemented through `Terminal::scroll_viewport` and `Point::Viewport` snapshots, not a parallel JavaScript history buffer. The frontend sends scroll deltas (`scroll_pty`) for wheel and Shift+PageUp/PageDown; the terminal thread owns viewport position and emits the visible grid. Key and paste input snap the viewport back to live output.

**Why:** `libghostty-vt` already owns scrollback, reflow, alternate-screen behavior, and tracked grid semantics. Duplicating history in React would drift from the real terminal state and break the "Ghostty engine is the source of truth" architecture.

**Verified:** 2026-07-08 real app run with a shell profile: a 300-line burst stayed responsive; Shift+PageDown showed live output through `LINE-300`; Shift+PageUp moved to older `LINE-245` history; resize smoke kept the app and shell child alive; drag selection plus Cmd+C copied scrolled text (`LINE-246` through `LINE-250`).

**Reversible?** The controls can change later, but the state ownership should stay in Ghostty unless measured evidence shows the viewport API cannot support a needed workflow.

## 2026-07-08 — APPROOT promotion complete

**Choice:** Promote the working Tauri app from `spike-2/` to `app/` and drop throwaway package names. The app identity is now: npm package `agent-cli`, Rust package `agent-cli`, lib crate `agent_cli_lib`, Tauri product/window title `agent cli`, and identifier `com.jasonpoindexter.agent-cli`.

**Why:** The render/input/folder/agent/scrollback foundation is no longer a disposable experiment. Daily development should start from the real app root, with stable package names and docs pointing contributors to the runnable app.

**Verified:** 2026-07-08 from `app/`: `cargo test` passed 6 Rust tests, `cargo build` passed, `npm run build` passed, and `npm test` passed. A real `npm run tauri dev` launch started `target/debug/agent-cli`, spawned direct child `claude`, and `lsof` showed the Claude child cwd was `/Users/jasonpoindexter/Documents/GitHub/apps/agent cli`.

**Reversible?** Low-cost rename reversal is possible before commits, but the decision should stand unless the repo layout itself changes. Historical SPIKE-2 entries remain as history; current development uses `app/`.

## 2026-07-08 — PROCESS-ENV launch checks

**Choice:** `open_workspace` now validates the selected cwd, preflights the selected command before replacing the current pane, returns launch errors to the frontend, and emits a `pane-exit` event when a launched process exits. The frontend renders a visible launch/error banner and does not persist a newly picked folder if launch preflight fails.

**Why:** The app should not dump Jason into a blank/dead pane when `claude`/`codex` is missing from PATH, the workspace path is bad, or the agent exits immediately because of auth/session problems. This keeps the pty/Terminal ownership model intact: only Send handles cross threads; `Terminal` and `Encoder` still live only inside the terminal thread.

**Verified:** 2026-07-08: Rust tests increased to 10 and passed; `npm run build`, `npm test`, and `cargo build` passed. Real bad-command launch rendered a missing-command banner and process inspection showed no child process under `agent-cli`. Real immediate-exit launch with `false` left no child process and exercised the `pane-exit` monitor path. Real Claude launch regression still spawned direct child `claude`, and `lsof` showed cwd `/Users/jasonpoindexter/Documents/GitHub/apps/agent cli`.

**Reversible?** Yes. The preflight and exit banner can evolve into richer process lifecycle UI in v1, but the v0 behavior should remain: fail before replacing the pane when cwd/command preflight fails, and surface process exits visibly.

## 2026-07-08 — DATA-STORAGE v0 state reset documented

**Choice:** Keep v0/v0.5 state in Tauri Store and document the exact local file, schema, and reset path in `docs/local-state.md`. Current state lives at `~/Library/Application Support/com.jasonpoindexter.agent-cli/workspace.json`.

**Why:** Store JSON is enough for last workspace and launch profile. SQL waits until v1, when state becomes relational across project tabs, pane layouts, process lifecycle metadata, and editor tabs. A manual reset path is needed now because bad folder/profile state can otherwise make the app feel stuck.

**Verified:** 2026-07-08: `docs/local-state.md` documents the `workspace.json` schema, reversible `mv` reset command, relaunch command with the Zig pin, and default Claude `launchProfile` repair snippet. `roadmap.json` marks DATA-STORAGE done and `roadmap.html` was rebuilt.

**Reversible?** Yes. The storage backend can move to SQL in v1 as already planned; the reset doc should remain the human recovery entrypoint.

## 2026-07-08 — Remaining sequencing calls after v0

**Choice:** Use the most logical sequence:
1. v0 finishes package/root stability before env/auth hardening. This is now done: APPROOT landed before PROCESS-ENV.
2. v1 includes both DIFF-VIEW and GIT-ACTIONS-LITE as must-have review workflow. DIFF-VIEW comes first because actions need a review surface; GIT-ACTIONS-LITE follows with only stage, unstage, discard with confirmation, and copy diff. This is not a full git client.
3. Pane attention is layered by reliability: process exits first, explicit Claude/Codex prompt heuristics second, generic prompt-idle detection later only if measured useful.

**Why:** The app exists to supervise real agents without VS Code. Diff viewing without basic cleanup actions leaves Jason bouncing back to VS Code/terminal for common review moves. Attention based only on idle time is too noisy for v1; explicit prompts and process exits are more reliable and easier to trust.

**Reversible?** Yes. GIT-ACTIONS-LITE can shrink if implementation risk gets too high, and attention heuristics should be revised from real daily-use logs.

## 2026-07-08 — Product name: Keelhouse

**Choice:** Use **Keelhouse** as the product name. Keep `agent-cli` as the repo/package/binary slug for now, and use Keelhouse in product-facing docs and app window metadata.

**Why:** The name needs to carry the real product shape: a stable workbench around heavy agent processes, project files, panes, and sessions. Obvious alternatives like "Switchyard" and "Termdock" collide with terminal/workbench-adjacent products or sound like generic category labels. Keelhouse is distinctive, avoids AI/code-name mush, and still implies the structural spine of the app.

**Verified:** 2026-07-08 quick web sanity check found direct conflicts for the obvious terminal/workbench names and no obvious active terminal/developer-tool product using "Keelhouse." This is product naming sanity, not trademark clearance.

**Reversible?** Yes. The app identifiers, package names, and storage paths remain `agent-cli` until a later explicit rename/migration slice.

## 2026-07-11 — Chrome re-convergence to the accepted demo + first-open layout

**Choice:** `demo/keelhouse-chrome-demo.html` is the binding visual contract, now at the control-grammar level, not only tokens. Three-control grammar locked: flat 600-weight text actions (hover → accent-strong), transparent icon buttons (color-only hover), and a single filled Send as the only default filled control. First open now shows the demo layout — threads drawer, centered run+composer, tabbed right dock open on Files, bottom tray strip, statusbar — superseding the 2026-07-10 hidden-first-open default. Trays remain movable/openable/closeable (TRAY-DOCKING-UX retained); the demo look applies to trays wherever they dock (hybrid, not fixed positions).

**Alternatives considered:** (a) full fixed demo layout — rejected because Jason explicitly wants nothing fixed, windows must move/open/close; (b) restyle-only without the tab-strip metaphor or first-open change — rejected because the first-open impression and tray navigation are part of what reads as drift.

**Why:** The shipped chrome passed `qa:chrome-contract` while visually diverging hard from the accepted demo: ~50 controls rendered as boxed rounded-rect buttons against the demo's three-control grammar, and the Run surface was a bare output dump instead of the centered card composition. The gate greps tokens/strings and cannot see visual weight — it verified structure, not taste. Jason confirmed the drift by eye ("looks wack") and re-affirmed the demo as the direction. Delta audit: `docs/chrome-delta-audit.md`. Execution: roadmap cards CHROME-CONTROL-GRAMMAR, RUN-SURFACE-COMPOSITION, COMPOSER-ELEVATION (slice 1, now), then SIDEBAR-RHYTHM, TITLEBAR-STATUSBAR-PARITY, TRAY-TAB-CHROME, FIRST-OPEN-LAYOUT, OVERLAY-PARITY, CHROME-CONTRACT-V2; structured run cards stay gated on AGENT-HOOKS (RUN-CARDS-ADAPTER, v2) — never inferred from terminal text.

**Reversible?** Yes for the first-open default (one constant + re-baselined screenshots). The control grammar is a CSS/component-class change; reverting means re-pointing the shared button classes. CHROME-CONTRACT-V2 will make reintroducing boxed buttons a failing gate, so future reversal requires an explicit DECISIONS.md entry.

## 2026-07-11 — Bundle Inter for the chrome UI font

**Choice:** Bundle Inter locally via `@fontsource/inter` (v5.2.8, font under OFL-1.1, weights 400/500/600/700/800 imported in `app/src/main.tsx`). `--font-ui` keeps Inter first; the system stack remains the fallback.

**Alternatives considered:** system-first stack (drop Inter) — rejected because the accepted demo and the re-converged chrome were designed against Inter's metrics, and an unbundled first-choice font makes the shipped look depend on what happens to be installed (blind-audit 2026-07-11 finding: every screenshot baseline silently inherited the build machine's fonts).

**Why:** the chrome contract is only enforceable if the type it specifies actually ships. Local woff2 assets keep the no-CDN/offline posture; per-weight latin files are ~45KB each at runtime.

**Reversible?** Yes — remove the five imports and the dependency; fallback stack takes over.
