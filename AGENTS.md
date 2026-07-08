# Repository Guidelines

## Project Structure & Module Organization

This repo is a native macOS agent-terminal app in early build-out. Start with `README.md`, `PRD.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `DECISIONS.md`, `PARKED.md`, and `ERRORS.md`; they are the project source of truth.

- `app/`: current Tauri 2 + React/TypeScript/Vite app.
- `app/src-tauri/`: Rust backend for terminal/process/workspace handling.
- `spike-ghostty-vt/`: Rust proof for `portable-pty` output parsed by `libghostty-vt`.
- `rockmap/`: vendored zero-dependency roadmap-board generator.
- `ghostty/`, `zellij/`: terminal theme/config references.
- `docs/`, `demo/`, `resources/`, `learnings/`: audits, prototypes, references, and captured decisions.

## Build, Test, and Development Commands

Run commands from the relevant subdirectory unless shown otherwise.

```bash
cd app && npm install
cd app && npm run dev              # Vite dev server for the React frontend
cd app && npm run build            # TypeScript check plus Vite production build
cd app && npm run tauri dev        # Run the Tauri app shell
cd spike-ghostty-vt && cargo run   # Exercise real pty -> libghostty-vt parsing
node rockmap/build-roadmap.mjs roadmap.json roadmap.html
```

Pin Zig to `0.15.2` for Ghostty-related Rust work; default `0.16` is known to break `libghostty-vt` builds.

## Coding Style & Naming Conventions

Use the existing style in each app/spike. TypeScript uses ES modules, React function components, two-space indentation, double quotes, `PascalCase` components, and `camelCase` helpers. Rust uses `rustfmt`, explicit `expect(...)` context where failures are unrecoverable in spikes, and small focused functions. Keep comments sparse; explain terminal, pty, rendering, or decision constraints.

## Testing Guidelines

There is no unified test suite yet. Treat `npm run build` in `app/` and `cargo test` in `app/src-tauri/` as minimum verification for touched app code. For terminal/rendering work, prefer real-path checks: pty bytes, Ghostty parsing, canvas paint, keyboard roundtrip, and paste/resize behavior. Name future tests after behavior, for example `keyboard_roundtrip_handles_ctrl_l`.

## Commit & Pull Request Guidelines

History uses short conventional prefixes such as `docs:`, `feat:`, and `fix:`. Keep that pattern and make the scope concrete, for example `feat: verify ghostty parser resize path`. PRs should include the problem, changed paths, verification commands/results, linked decisions or roadmap items, and screenshots or recordings for UI-visible changes.

## Agent-Specific Instructions

Do not replace working spikes with mock demos. Preserve the decision trail in `DECISIONS.md` and add repeatable pitfalls to `ERRORS.md`. Avoid deleting parked references unless the docs explicitly say they are obsolete.
