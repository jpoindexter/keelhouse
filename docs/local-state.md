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
  "sessionEditorSnapshots": {
    "/absolute/path/to/workspace\nsession-lt72gs": {
      "tabs": [
        {
          "id": "/absolute/path/to/workspace/src/App.tsx",
          "name": "App.tsx",
          "path": "/absolute/path/to/workspace/src/App.tsx",
          "kind": "file"
        }
      ],
      "activePath": "/absolute/path/to/workspace/src/App.tsx",
      "buffers": {},
      "viewStates": {}
    }
  },
  "paneLayoutsBySession": {
    "/absolute/path/to/workspace\nsession-lt72gs": [
      {
        "slot": 0,
        "profileId": "codex",
        "label": "API fix"
      },
      {
        "slot": 1,
        "profileId": "shell",
        "label": "Dev server"
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
`paneLabelsBySession` stores user-edited terminal pane names by project-session key and pane slot. It restores labels when the same session/slot is recreated.
`sessionEditorSnapshots` stores per-session editor tabs, active file, dirty buffers, and CodeMirror view state. `paneLayoutsBySession` stores per-session pane slots, launch profile ids, and labels. Relaunch creates fresh panes from this layout; it does not restore live process memory or transcripts.
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

## Schema Versioning (STATE-MIGRATION, 2026-07-11)

`workspace.json` carries a `schemaVersion` integer (current: 1). On startup the app reads all store entries, runs `migrateWorkspaceStore` (`app/src/workspaceMigrations.ts`), and persists the result once if anything changed. The contract:

- Each migration step upgrades exactly one version and never deletes keys it does not understand — a newer app leaves unknown keys intact so an older app can still read what it recognizes (downgrade-safe).
- Missing or garbage `schemaVersion` values are treated as version 0.
- v0 → v1 stamps the version and canonicalizes `recentFolders` (dedupe/drop blanks) — the shape the read-path normalizers already produced in memory.
- Future shape changes to any persisted key (sessions, pane layouts, composer harness, activity events) MUST land as a new migration step plus a version bump, with a test loading the previous shape.

## Crash Resilience (CRASH-RESILIENCE, 2026-07-12)

- `begin_session` writes `.session-lock` in the app data dir on startup and returns whether a stale lock was found (previous session did not close cleanly). `end_session_clean` removes it; the frontend calls it on `beforeunload`.
- Recovery is only claimed when a stale lock coincides with restorable projects (`deriveCrashRecovery`), so first-ever and clean-slate launches never show a false notice. On recovery the shell shows a dismissible banner and relies on existing SESSION-RESTORE to reopen projects/sessions.
- `log_health_event` appends to a size-capped (128 KB, drop-and-restart) local `health.log`; pty/open-workspace launch failures are logged. Local-only — nothing leaves the machine.
- Boundary: SIGKILL/SIGTERM leave the lock in place (that is the point — it signals the crash on next launch); only the real close path clears it.

## On-Disk Artifacts & Reset (UNINSTALL-RESET, 2026-07-12)

All local state lives under `~/Library/Application Support/com.jasonpoindexter.agent-cli/`:

| File | Owner | Contents |
| --- | --- | --- |
| `workspace.json` | Tauri Store | projects, sessions (incl. archived), pane labels/layouts, editor snapshots, browser URLs, composer harness, activity events, pane transcripts, keybinding overrides, theme, notification toggle, schemaVersion |
| `.session-lock` | `begin_session`/`end_session_clean` | crash-detection marker |
| `health.log` | `log_health_event` | capped local failure log |
| `.window-state.json` | tauri-plugin-window-state | window frame |
| `workspace.json.*-bak-*` | legacy sync backups | older ad-hoc backups (safe to delete) |

**Reset all local data** (Settings → App configuration) confirms, then clears the Tauri Store (`store.clear()`) and calls the `reset_local_state` Rust command to delete `.session-lock`, `health.log`, and `.window-state.json`, then reloads. WebView caches are managed by the OS.

**Manual uninstall:** drag `Keelhouse.app` to Trash, then delete the app-support directory above to remove all state and any cached credentials the CLIs stored there.
