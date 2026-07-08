# Local State

Keelhouse uses Tauri Store for v0/v0.5 state. The current file still uses the `agent-cli` app identifier:

```bash
~/Library/Application Support/com.jasonpoindexter.agent-cli/workspace.json
```

Current schema:

```json
{
  "folder": "/absolute/path/to/last/workspace",
  "launchProfile": {
    "id": "claude",
    "command": "claude",
    "args": [],
    "useLoginShell": true
  }
}
```

`folder` is the last workspace to reopen. `launchProfile` is the command the pane launches in that workspace. The default is Claude through a login shell so shell-managed paths such as `nvm` are available.

## Reset Path

Quit the app first. To force a clean first-launch folder picker and default launch profile:

```bash
STATE_DIR="$HOME/Library/Application Support/com.jasonpoindexter.agent-cli"
mv "$STATE_DIR/workspace.json" "$STATE_DIR/workspace.json.bak.$(date +%Y%m%d-%H%M%S)"
```

Then relaunch:

```bash
cd app
PATH="/opt/homebrew/opt/zig@0.15/bin:$PATH" npm run tauri dev
```

The app will create a fresh `workspace.json` after a folder is picked.

## Repair Without Full Reset

To restore the default Claude profile while keeping the last folder, edit only `launchProfile`:

```json
"launchProfile": {
  "id": "claude",
  "command": "claude",
  "args": [],
  "useLoginShell": true
}
```

If `folder` points at a missing project, move `workspace.json` aside and relaunch. Do not hand-edit paths while the app is running; the store autosaves.
