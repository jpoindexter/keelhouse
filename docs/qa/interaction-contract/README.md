# Interaction Contract Evidence

Packaged native checks for the 2026-07-13 shell/menu correction:

- `terminal-shell-default.png`: opening Terminal creates `Shell 1` and a raw `/bin/zsh -l` process; no agent CLI starts implicitly.
- `shell-simplified-desktop.png`: the packaged shell removes duplicate title/thread actions and reports only real status.
- `shell-simplified-terminal.png`: the packaged terminal tray uses flat tabs, an inset toolbar, and icon-only universal actions.
- Project Close was executed against a two-project temporary fixture: the selected project's panes stopped, the row disappeared, and the fallback project became active without a false pane-exit error.
- App-owned utility-tab menu was executed with Show Terminal, New Shell Pane, Close Selected Pane, and Hide Bottom Panel.
- App-owned terminal-pane menu was executed with Focus, Rename, Restart, Kill, Close, worktree, and Copy Working Directory actions.
- Final package QA also covers the absence of a bottom Browser tab and the flat active-pane underline.

These checks use temporary `/private/tmp` projects. The user's original `workspace.json` is restored after QA.
