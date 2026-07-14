# Agent Hooks

`AGENT-HOOKS` exposes a small app-owned MCP surface for local agents. It is not a plugin runtime and does not let remote code load into Keelhouse.

## Connection

Keelhouse starts a random loopback HTTP listener on each launch and writes an MCP client configuration to:

```text
~/Library/Application Support/com.jasonpoindexter.agent-cli/agent-hook-mcp.json
```

The file contains the current endpoint and bearer header, is written with mode `0600`, and is replaced with a new random token whenever the app restarts. The endpoint binds only to `127.0.0.1`, accepts `POST /mcp`, rejects missing or incorrect bearer tokens, caps request bodies at 1 MiB, and sends `Cache-Control: no-store`.

## Tools

| Tool | Behavior | Approval |
| --- | --- | --- |
| `list_projects` | Lists open project paths and status. | Read only |
| `get_workspace_state` | Reads the active project/chat, panes, open files, and selected file. | Read only |
| `focus_pane` | Focuses an existing pane in the active chat. | Low-risk app-action gate |
| `open_file` | Opens a workspace-relative path in the editor tray. Absolute paths and `..` are rejected. | Low-risk app-action gate |
| `create_shell` | Creates a blank shell pane in the active project/chat. | Medium-risk app-action gate; asks unless policy allows it |
| `report_status` | Adds an attributed status or typed run card to the active chat. Optional `kind`, `state`, and file `targets` are validated by the app. | Logged app event |

Mutating requests are queued for the renderer and are discarded if their caller has already timed out. The renderer responds with the final approved, denied, or failed result. Agent-originated actions use `requestedBy: agent`, so existing permission modes and approval audit rows remain authoritative.

## Boundaries

- No tool writes files, changes Git state, or runs an arbitrary command.
- The endpoint never returns its token through renderer status IPC; Settings shows only the endpoint and protected configuration path.
- UI actions require the webview to be active. A locked macOS session can continue serving read-only state, but UI action calls time out rather than executing invisibly.
- Adding file writes, Git mutations, layout changes, or lifecycle scripts requires a new named tool, explicit risk classification, approval/undo behavior, attribution, and real packaged-app verification.
- `report_status` cards are always marked `agent-hook`; terminal text is never parsed into structured activity.

## Verification

Rust tests cover the fixed tool catalog, private bearer configuration, and stale-request filtering. The packaged app executed authenticated `initialize`, `tools/list`, and `get_workspace_state`, rejected an unauthenticated request with HTTP 401, and completed a real `create_shell` request through the native approval sheet. Selecting **OK** returned `ok: true`, created a blank shell pane, and added attributed `Action approved` and `Created pane` rows to the active chat.
