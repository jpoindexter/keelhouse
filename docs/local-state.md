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
    "id": "codex",
    "label": "Codex",
    "command": "codex",
    "args": [],
    "useLoginShell": true
  },
  "activeFileByWorkspace": {
    "/absolute/path/to/workspace": "/absolute/path/to/workspace/src/file.ts"
  },
  "openProjects": [
    {
      "path": "/absolute/path/to/workspace",
      "status": "running"
    }
  ],
  "projectSessions": {
    "/absolute/path/to/workspace": [
      {
        "id": "session-lt72gs",
        "title": "Current work",
        "status": "running",
        "updatedAt": 1783530000000
      }
    ]
  },
  "activeSessionByProject": {
    "/absolute/path/to/workspace": "session-lt72gs"
  },
  "browserPreviewByProject": {
    "/absolute/path/to/workspace": "http://localhost:3000/"
  },
  "browserPreviewBySession": {
    "/absolute/path/to/workspace\nsession-lt72gs": "http://localhost:5173/"
  },
  "paneLabelsBySession": {
    "/absolute/path/to/workspace\nsession-lt72gs": [
      {
        "slot": 0,
        "label": "API fix",
        "updatedAt": 1783530000000
      }
    ]
  },
  "composerHarnessBySession": {
    "/absolute/path/to/workspace\nsession-lt72gs": {
      "approvalMode": "ask",
      "goal": "Fix API flow",
      "selectedProfileId": "codex",
      "attachments": [
        {
          "id": "file:1783530000000:/absolute/path/to/workspace/src/App.tsx",
          "kind": "file",
          "label": "App.tsx",
          "target": "/absolute/path/to/workspace/src/App.tsx",
          "createdAt": 1783530000000
        }
      ]
    }
  },
  "agentActivityEvents": [
    {
      "id": "pane:4:command:1783530000000",
      "projectId": "/absolute/path/to/workspace",
      "projectSessionId": "session-lt72gs",
      "paneId": "pane:4",
      "kind": "command",
      "label": "Command failed",
      "detail": "npm test",
      "target": "/absolute/path/to/workspace",
      "exitCode": 1,
      "outputRef": "terminal",
      "undoHint": "review diff",
      "status": "error",
      "timestamp": 1783530000000
    }
  ]
}
```

`folder` is the last workspace to reopen. `launchProfile` is the command the pane launches in that workspace. Built-in profile ids are `codex`, `gemini`, `claude`, and `shell`. Codex, Gemini, and Claude run through a login shell so shell-managed paths such as `nvm` are available; Shell launches `/bin/zsh -l` directly. Fresh state defaults to Codex to avoid consuming Claude Code usage during testing.
`activeFileByWorkspace` stores the last active editor file per canonical workspace root; stale paths are ignored instead of being opened.
`openProjects` stores the project rail. `projectSessions` stores named task/workbench session rows under each project, and `activeSessionByProject` stores the selected session id per project. `browserPreviewByProject` and `browserPreviewBySession` remember the lightweight preview URL for project/session context.
`paneLabelsBySession` stores user-edited terminal pane names by project-session key and pane slot. It restores labels when the same session/slot is recreated. It does not restore live processes, pane layout, or transcripts; those belong to `SESSION-RESTORE`, `PROCESS-LIFECYCLE`, and `TRANSCRIPTS`.
`composerHarnessBySession` stores composer permission mode, goal text, selected profile id, and attachment references by project-session key. Attachments are references only; file contents and screenshots are not copied into local state.
`agentActivityEvents` stores up to 200 user-safe activity rows across projects, sessions, and panes. Rows are normalized on startup; unknown kinds/statuses, malformed ids, and invalid timestamps are dropped. Current event kinds are `prompt`, `process`, `command`, `file`, `tool`, `git`, `approval`, `browser`, `app`, `error`, and `complete`.

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

To restore the default Codex profile while keeping the last folder, edit only `launchProfile`:

```json
"launchProfile": {
  "id": "codex",
  "label": "Codex",
  "command": "codex",
  "args": [],
  "useLoginShell": true
}
```

If `folder` points at a missing project, move `workspace.json` aside and relaunch. Do not hand-edit paths while the app is running; the store autosaves.
