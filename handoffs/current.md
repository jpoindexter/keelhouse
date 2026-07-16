# Handoff: Claude Session Continuation

Date: 2026-07-16 (updated in-session)
Project: `/Users/jasonpoindexter/Documents/GitHub/apps/agent cli`
From: Claude (Fable 5 session, 16 slices)
To: Next session

## Goal

Unchanged from the Codex handoff: complete every open roadmap card in build order,
starting with `MODULARITY-300-200-50`. Strict TDD per slice, full gate before every push,
never close a card without executing its real Done criterion.

## Current State

- Branch: `main`, clean. Pushed checkpoint: `124f95d refactor: consolidate terminal surface controller`.
- All gates green at `124f95d`: build=0, module-size ratchet=0, chrome-contract=0,
  **208 test files / 660 tests**, `git diff --check`=0.
- Module baseline:

```json
{
  "app/src/App.tsx": { "lines": 2452, "longFunctions": 1, "maxFunctionLines": 2213 }
}
```

Session start was 2844 / 2558. Sixteen slices extracted (all pushed, one commit each):
terminalProcessActionsController, editorViewLifecycle, workspaceBootstrapController,
WorkspaceSideRail, appMenuAssembly, commandPaletteAssembly, settingsConnectionActionsController,
editorFileUtilityActions, projectSessionMetadataActions, editorReviewNavigation,
editorSurfaceActions (consolidation), agentHookIntegration, AgentConversationPanel,
terminalClipboardActions, useContextMenuHost (first state-owning hook),
terminalSurfaceController (consolidation of pane+process+clipboard).

## Decisions carried forward

- Source-contract tests and chrome-contract rules follow moved code to its new owner
  (contextMenuCoverage.test.ts, runCards.test.ts, scripts/check-chrome-contract.mjs all updated this way).
- Consolidation pattern established twice (editorSurfaceActions, terminalSurfaceController):
  a `create<X>SurfaceActions(state, deps)` factory in its own file with `wire*` helpers ≤50 lines,
  App makes one call and aliases the outputs.
- Gate runs MUST check exit codes explicitly (`cmd > /dev/null; echo $?`) — piping through
  `tail` once masked a chrome-contract failure (slice 6, caught and fixed).
- Known flake: `SettingsWorkspace.interaction.test.tsx` failed once under parallel load,
  passes in isolation and on rerun. Log to ERRORS.md if it recurs.

## Next exact work (MODULARITY-300-200-50)

Cheap adapter extractions are exhausted. Remaining ~2150 lines in `App()` are:
1. **Workspace-open/persistence consolidation** — `workspaceOpenTargetController` +
   `workspaceOpenLifecycleController` + `workspaceOpenActions` wirings (~700-800 region)
   into `workspaceSurfaceController.ts`, same pattern as terminalSurfaceController.
2. **Composer runtime consolidation** — `runComposerAppCommand`, `submitComposerDraft`,
   `logComposerHarnessEvent`, composer attachment actions into `composerSurfaceController.ts`.
3. **Render splits** — SettingsModal block (~90 lines) behind grouped props; overlays cluster
   (TranscriptsModal/AppRuntimeDialogs/SearchCommandDialog/QuickOpenDialog/DraftNavigationDialog/StatusBar)
   as `AppOverlays.tsx` (export the six Props types first); `<main>` docks + editor section.
4. **State-owning hooks** — continue the useContextMenuHost pattern for remaining
   useState/useEffect clusters (notices, transcripts open state, settings open state).
5. Final pass: `App()` body ≤50 lines requires everything above plus splitting the JSX
   return into <AppShell> composition.

Done criterion (unchanged): empty violations object from
`node scripts/check-module-size.mjs --print-baseline`, focused+full tests green, packaged
smoke executing chat, trays, terminal, editor, browser, menus, session restore.

## Blockers requiring Jason

- `CHROME-EYEBALL-SIGNOFF` — human sign-off, never self-approve.
- Packaged-app smoke for closing MODULARITY (real `npm run tauri dev` / packaged run).

## Remaining open cards (build order)

Unchanged list of 17 from the original handoff; MODULARITY-300-200-50 is `now`, all others
after it. Read each card's `summary`/`done`/`progress` in `roadmap.json` before implementing.
