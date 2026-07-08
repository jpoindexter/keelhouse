# Harness Contract

This document defines the app-owned layer between the Codex-style composer and real terminal panes. The rule is simple: terminal panes stay the source of truth, while the app owns routing, metadata, approval, and activity.

## Glossary

- **Project**: an opened folder with its own file rail, editor tabs, browser preview, panes, git state, and settings context. It is not a window.
- **Project session**: a named work context under a project: editor tabs, browser URL, pane layout, pane labels/status, transcript references, and activity metadata. It is not a chat thread or editor tab.
- **Pane**: one live or exited pty/process surface running Claude, Codex, shell, or another command profile. The pane owns the real terminal transcript.
- **Agent profile**: a launch configuration for a pane: command, args, cwd behavior, env, auth/preflight checks, and supported permission flags.
- **Composer**: the bottom input/control surface. It sends text to a selected pane or triggers app-owned actions. It does not replace the terminal UI.
- **App action**: a deterministic command the app owns, such as focus pane, open file, open diff, attach screenshot reference, interrupt process, or create pane.
- **Activity event**: a user-visible record of what happened: prompt sent, command started, file changed, approval requested, action denied, pane exited, or stop sent.
- **Direct harness**: optional future direct API/MCP agent orchestration. It is separate from terminal-backed panes and must never demote real CLI agents.

## Agent Session Handle

Every pane exposed to the composer should implement this handle:

```ts
type AgentSessionHandle = {
  id: string;
  projectId: string;
  projectSessionId: string;
  cwd: string;
  agentProfileId: string;
  processState: "starting" | "running" | "waiting" | "exited" | "errored";
  approvalMode: "ask" | "approveSafe" | "fullAccess";
  send(text: string): Promise<void>;
  interrupt(): Promise<void>;
  readTail(lines: number): Promise<string>;
  close(): Promise<void>;
};
```

The composer targets a handle, not a React component. The handle is also the boundary for future agent hooks and activity logging.

## App Action Gate

Permission modes apply to app-owned actions before they apply to external CLIs.

- `ask`: prompt before mutating files, git, pane layout, processes, credentials, or project state.
- `approveSafe`: auto-approve low-risk local navigation/read actions; ask for mutation.
- `fullAccess`: allow app-owned actions but still log them and keep hard blocks for destructive or out-of-scope actions.

Each gated action records: `actionId`, `kind`, `target`, `risk`, `requestedBy`, `decision`, `reason`, `timestamp`, and optional `undoHint`.

## Activity Events

Activity events are normalized before UI rendering:

```ts
type ActivityEvent = {
  id: string;
  projectId: string;
  projectSessionId: string;
  paneId?: string;
  kind: "prompt" | "process" | "file" | "git" | "approval" | "browser" | "app" | "error";
  label: string;
  detail?: string;
  status?: "running" | "done" | "failed" | "waiting";
  timestamp: string;
};
```

Never show hidden chain-of-thought. Show user-safe summaries, tool names, paths, diffs, command output links, approvals, and errors.

## Vanta Lessons To Borrow

Borrow:

- session handles similar to `agent_session open/send/read/close/list`
- approval/audit event shape
- route hints that steer agent requests to the app-owned path
- progress streaming for long-running agent actions

Do not borrow by default:

- tmux as the pane backend; this app already owns real ptys
- Docker autonomous agent mode
- self-evolution loops
- a broad plugin/runtime platform
- direct model orchestration before terminal panes and app actions are solid

## Workflow Metrics

Daily-driver validation needs task scripts, not vibes:

- one-project loop: open project, edit file, run agent, inspect diff
- two-agent loop: launch two panes in one project, label them, switch focus, stop one
- three-project loop: open three projects, run different agents, switch sessions, recover after quit

Record steps, elapsed time, memory, CPU, visible jank, crashes, and whether VS Code was needed.
