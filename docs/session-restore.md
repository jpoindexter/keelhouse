# Session Restore

`SESSION-RESTORE` brings the Keelhouse cockpit back after quit/relaunch without pretending old agent processes are still alive.

## Restored State

- Project rail: `openProjects`, `projectSessions`, and `activeSessionByProject` restore the visible project/session context.
- Editor: `sessionEditorSnapshots` restores tabs, active file, dirty buffers, and CodeMirror selection/scroll state by project-session key.
- Browser: `browserPreviewByProject` and `browserPreviewBySession` restore the preview URL.
- Panes: `paneLayoutsBySession` restores pane slots, launch profile ids, and labels. Relaunch starts fresh Codex/Gemini/Claude/Shell panes from that layout.
- Composer: `composerHarnessBySession` restores permission mode, goal, selected profile, and attachment references.

## Boundaries

Live process memory, terminal transcripts, and agent continuation are not restored by this slice. A relaunched pane is an intentional fresh process with the same profile and task label. Process reattach, transcript references, and durable agent handles belong to later lifecycle/transcript work.

## Zed Reference

Zed is the closest product reference for this behavior: restore the workspace shell, project context, dock/pane arrangement, and agent-facing surface quickly, while keeping process state explicit. Keelhouse keeps the same principle but makes the agent conversation the main surface instead of the code editor.

## Verification

Current automated coverage:

- `app/src/sessionRestore.test.ts` validates malformed persisted editor snapshots and pane layouts are normalized before startup can use them.
- `npm run build` verifies the restored schema is wired through the React/Tauri app.

Manual check for this slice:

1. Open a workspace.
2. Create at least two panes with different profiles or labels.
3. Open a file tab and move the cursor/scroll.
4. Quit and relaunch.
5. Confirm the same project/session, file tabs, browser URL, and pane layout return, with fresh running processes.

This verifies relaunch of the active session only. It does not prove independent live pane ownership across multiple same-project sessions; packaged testing on 2026-07-12 found those sessions currently reuse one project-level pane set. That gap is tracked by `SESSION-PANE-ISOLATION`.
