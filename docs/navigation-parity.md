# Navigation Parity Scope

Codex's sidebar is the interaction reference: projects contain multiple independent chats. Each chat also restores its project-scoped workbench context.

## Keep / Translate

| Codex sidebar item | agent cli equivalent | Scope |
| --- | --- | --- |
| New chat | New chat | Create an independent structured provider conversation under the active project, with its own workbench context and optional raw-terminal panes. |
| Search | Search | Global search across projects, files, commands, chats, and raw-terminal transcripts when available. |
| Projects | Projects | Persistent left rail of open/recent project folders with active/running/exited/attention badges. |
| Chat rows under projects | Project chats | Independent structured message histories and provider thread IDs, plus task-scoped editor, browser, and optional raw-terminal state. |
| Show more | Show more | Collapse old chats per project; keep the rail dense. |
| Active chat highlight | Active chat highlight | Clear selected project/chat state with visible focus and run status. |

## Drop / Rename

| Codex sidebar item | Decision |
| --- | --- |
| Plugins | Drop. No plugin marketplace or arbitrary extension host. |
| Bottom account/profile area | Drop as account UX. Replace with local app/settings/status entry if needed. |
| Generic "New chat" labels | Auto-title from the first prompt while keeping names editable. |

## Park

| Codex sidebar item | Possible future equivalent |
| --- | --- |
| Scheduled | Scheduled/background agent runs, only after chat restore and agent hooks are real. |
| Archived chat list | Chat archive and search after persistent chats ship. |

## Done Criteria

- The left rail can show multiple projects and nested chats without needing separate app windows.
- Selecting a chat restores its messages, provider thread, project, editor tabs, browser preview URL, and optional raw-terminal state.
- Running/idle/attention-needed state is visible at both project and chat rows.
- Chats are not editor tabs or aliases for terminal panes; they own structured messages and provider thread identity while carrying task-scoped workbench state.
