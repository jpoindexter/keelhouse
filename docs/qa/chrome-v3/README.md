# Native Chrome V3 Evidence

Captured from the packaged macOS app on 2026-07-13 after reconverging production chrome with `demo/keelhouse-chrome-demo.html`.

- `native-collapsed.png`: Threads drawer, persistent structured chat/composer, right Git dock, and collapsed bottom utility tray.
- `native-terminal.png`: real Codex PTY open in the resized bottom tray while chat remains visible.
- `native-processes.png`: live pane shown in the Processes tray without replacing chat.
- `native-dock-left.png`: the same tool dock moved left without replacing or obscuring chat.
- `native-dock-bottom.png`: the tool dock moved below chat while preserving the independent utility strip.
- `native-reset.png`: Reset Interface restored the approved Threads/chat/right Files/default layout.

Computer Use executed the collapse control after switching to Processes, moved the tool dock left and bottom, and reset the interface. Static gates: 197 frontend tests, 59 Rust tests, production build, package build, and `qa:chrome-contract`.

These captures prove the implemented native states. They do not substitute for Jason's explicit `CHROME-EYEBALL-SIGNOFF` verdict.
