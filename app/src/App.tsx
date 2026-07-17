import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { AppActionAuditEvent, AppActionDescriptor } from "./appActions";
import type { OpenProject, ProjectRailStatus, ProjectSession } from "./workspaceState";
import { appRuntimeMenusFrom } from "./appRuntimeMenuHost";
import { visibleAppCommandPaletteCommands } from "./appCommandPaletteHost";
import { createRenderPerfExport } from "./renderPerfExport";
import { createPaneTranscriptCapture } from "./paneTranscriptCapture";
import { deriveAppSurfaceLabels } from "./appSurfaceLabels";
import { visibleProjectsFrom } from "./projectRailView";
import {
  projectRailStatusFromConversations,
  projectSessionStatusFromConversations,
} from "./projectChatStatus";
import {
  setActiveKeybindingOverrides,
} from "./shortcuts";
import { activePaneDisplayLabel } from "./terminalPane";
import { useAgentHookRuntime } from "./useAgentHookRuntime";
import { useAppTerminalRuntime } from "./useAppTerminalRuntime";
import { useAppEditorSurfaceRuntime } from "./useAppEditorSurfaceRuntime";
import { appEditorMenusFrom } from "./appEditorMenuRuntime";
import { appComposerSurfaceRuntimeFrom } from "./appComposerSurfaceRuntime";
import { appTerminalSurfaceRuntimeFrom } from "./appTerminalSurfaceRuntime";
import { buildSettingsActions } from "./settingsActionsHost";
import { useEditorWorkspaceRuntime } from "./useEditorWorkspaceRuntime";
import { resetDurableChatStore } from "./chatStore";
import { useAppFoundationRuntime } from "./useAppFoundationRuntime";
import { useAppProjectRuntime } from "./useAppProjectRuntime";
import { AppWorkbenchView } from "./AppWorkbenchView";
import "./App.css";
import "./composerModelPicker.css";
import "./responsive-shell.css";
import "./workbenchTransitions.css";

// SPIKE-2 frontend: paint the grid snapshots from the Rust backend onto a canvas,
// and encode keydowns back into pty bytes. Ship-ugly on purpose.

type Cell = { t: string; f: [number, number, number]; b: [number, number, number]; bold: boolean };
type Snapshot = { cols: number; rows: number; cx: number; cy: number; cvis: boolean; sb: number; cells: Cell[] };
function App() {
  const foundation = useAppFoundationRuntime<Snapshot>({
    gateAction: (action: AppActionDescriptor): Promise<AppActionAuditEvent> =>
      agentActivityHook.gateAppAction(action),
    hasUnsaved: (path) => editorSurface.editorHasUnsavedBufferForPath(path),
    logComposerEvent: (label, detail) => logComposerHarnessEvent(label, detail),
  });
  const {
    agentHookStatus, aiConnectionSettingsRef, canvasRef,
    fileNodeContextMenuItemsRef, frame, imeInputRef, ipcSampleCounter, latest, launchError, metrics,
    projectCreationOpen, projectSwitcherOpen, railBodyRef, renderPerfRef,
    selection, selecting, setAgentHookStatus, setLaunchError, setProjectCreationOpen, setProjectSwitcherOpen,
    storeRef, terminalHostRef, treeRef, workspacePath, workspacePathRef,
    worktreeLabelRequest,
  } = foundation.root;
  const {
    composerWorkspace, editorSession, persistence, profiles, terminal, workspaceTree,
  } = foundation.workspace;
  const { contextMenuHost, commandPalette } = foundation;
  const {
    aiConnectionSettings, backgroundExits, chatSearch, chrome, commandPaletteSources,
    composerError, composerNotice, composerSending, drawerSearchQuery, focusedChatMessageId,
    gitStatusHook, keybindingOverrides, mcpOAuth, orchestrationError, orchestrationLaunching,
    openSettings, orchestrationOpen, paneTranscripts, projectEntryOpen, railHeight, setAiConnectionSettings, setBackgroundExits,
    setCommandPaletteSources, setComposerError, setComposerNotice, setComposerSending,
    setDrawerSearchQuery, setKeybindingOverrides, setOrchestrationError,
    setOrchestrationLaunching, setOrchestrationOpen, setSettingsOpen, setWorktrees,
    settingsInitialCategory, settingsOpen, settingsRuntime, shellLayout, worktrees,
  } = foundation.shell;
  const { diffReviewHook, editorWorkspace } = foundation;
  const { chatSearchViewResults, drawerSearchResults, quickOpen } = foundation.search;
  const { activeChat, agentApprovalMode, agentActivityHook, browser } = foundation.conversation;
  const {
    attachSelectedFileToComposer, composerAttachments, composerLocal,
    composerMentionQuery, composerMentionResults,
  } = foundation.composer;
  const { activeAgentSession, activeTerminalProfile, terminalFind } = foundation;
  const {
    chatConversationActions, chatIdForSession: composerHarnessSessionKey,
    detectLocalDevServerFromSnapshot, finalizeCreatedTerminalPane, logComposerHarnessEvent,
    openChatSearchResult, paneActivityLog, pickWorkspace, projectCloseController,
    projectEntryActions, projectSessionDeletionController, projectSessionMetadataActions,
    projectSessionNavigationActions, requestCloseProject, requestOpenWorkspace, workspaceOpenActions,
  } = useAppProjectRuntime({
    createTerminalPane: (profile) => terminalSurface.createTerminalPane(profile), foundation,
    openEditorFile: (file) => editorFileWorkflow.openDirect(file),
    requestEditorNavigation: (navigation) => editorNavigation.requestNavigation(navigation),
    scheduleResize: () => setTimeout(sendTerminalResize, 0),
    switchSession: (root, sessionId) => projectSessionNavigationActions.switchSession(root, sessionId),
  });

  const {
    chatRunControls, composerHistoryNavigation, composerSettingsActions, composerSurface,
  } = appComposerSurfaceRuntimeFrom({
    activeChat, agentActivityHook, chatConversationActions,
    chatIdForSession: composerHarnessSessionKey, composerLocal, composerSending, composerWorkspace,
    editorSession, getActiveHandle: () => activeAgentSessionHandle,
    getEditorSurface: () => editorSurface, getSaveEditorFile: () => saveEditorFile,
    getTerminalLabel: () => activeTerminalPaneLabel, getTerminalSurface: () => terminalSurface,
    logComposerHarnessEvent, persistence, pickWorkspace, profiles,
    projectSessionMetadata: projectSessionMetadataActions, settingsRef: aiConnectionSettingsRef,
    setActionNotice: chrome.setActionNotice, setComposerError, setComposerNotice, setComposerSending,
    setOrchestrationError, setOrchestrationLaunching, setOrchestrationOpen, workspacePathRef,
  });

  const {
    activeAgentSessionHandle, renameTerminalPane, sendTerminalResize,
    terminalSurface, utilityTrayControls,
  } = appTerminalSurfaceRuntimeFrom({
    activeAgentSession, agentActivityHook, agentApprovalMode,
    connectionSettings: aiConnectionSettingsRef, finalizeCreatedTerminalPane, latest, metrics,
    paneActivityLog, persistence, pickWorkspace, profiles,
    requestWorktreeLabel: worktreeLabelRequest.requestLabel, selection,
    setComposerError, setLaunchError, setSettingsOpen, setWorktrees, shellLayout,
    storeRef, terminal, terminalHostRef, worktrees, workspacePath, workspacePathRef,
  });

  const projectRailStatus = (project: OpenProject): ProjectRailStatus =>
    projectRailStatusFromConversations(composerWorkspace.chatConversations, project.path);

  const projectSessionsFor = (projectPath: string) => persistence.projectSessions[projectPath] ?? [];

  const projectSessionStatus = (projectPath: string, session: ProjectSession): ProjectRailStatus =>
    projectSessionStatusFromConversations(composerWorkspace.chatConversations, projectPath, session.id);

  const visibleOpenProjects = visibleProjectsFrom(persistence.openProjects, workspacePath, terminal.activeProjectStatus);

  const editorRuntime = useAppEditorSurfaceRuntime({
    activeAgentSession, agentActivityHook, chrome, diffReview: diffReviewHook,
    editorSession, editorWorkspace, gitStatus: gitStatusHook, persistence,
    projectClose: projectCloseController, shellLayout, workspaceOpen: workspaceOpenActions,
    workspacePath, workspacePathRef, workspaceTree,
  });
  const {
    editorFileWorkflow, editorNavigation, editorSurface, handleEditorUpdate,
    saveEditorFile, tabIsDirty, workspaceFileActions,
  } = editorRuntime;

  const {
    diffContextMenuItems, editorContextMenuItems, editorTabContextMenuItems,
    projectRailContextMenuItems, projectSessionContextMenuItems,
    workspaceContextMenuActions, workspaceContextMenuItems,
  } = appEditorMenusFrom({
    activeChat, agentActivityHook, chrome, composerHarnessSessionKey, composerSurface,
    composerWorkspace, deleteSession: projectSessionDeletionController.deleteProjectSession,
    diffReview: diffReviewHook, editor: editorRuntime, editorSession, editorWorkspace,
    fileNodeItemsRef: fileNodeContextMenuItemsRef, gitStatus: gitStatusHook, persistence,
    projectEntry: projectEntryActions, projectSessionMetadata: projectSessionMetadataActions,
    projectSessions: projectSessionNavigationActions,
    requestCloseProject, setError: setLaunchError, workspacePath, workspacePathRef, workspaceTree,
  });

  const saveActivePaneTranscript = createPaneTranscriptCapture({
    getActivePane: () => activeAgentSession.activeTerminalPane,
    getPanes: () => terminal.panes,
    getRoot: () => workspacePathRef.current,
    getSessionId: () => activeChat.activeSessionId,
    getSnapshot: (paneId) => terminal.snapshotsRef.current[paneId],
    now: Date.now,
    persist: paneTranscripts.persistPaneTranscript,
  });

  const exportRenderPerfSnapshot = createRenderPerfExport({
    createFile: (root, parent, name) => invoke("create_workspace_file", { root, parent, name }),
    getPaneCount: (root) => terminal.panesForSession(root).length,
    getPerfState: () => renderPerfRef.current,
    getRoot: () => workspacePathRef.current,
    now: () => new Date().toISOString(),
    setError: setLaunchError,
    writeFile: (root, path, content, expectedModifiedMs) =>
      invoke("write_text_file", { root, path, content, expectedModifiedMs }),
  });

  const { appMenuAssembly, terminalContextMenuItems } = appRuntimeMenusFrom({
    activeAgentSession, activeAgentSessionHandle, activeChat, attachSelectedFileToComposer,
    browser, chatRunControls, chrome, composerAttachments, composerLocal, composerSending,
    composerSurface, contextMenuHost, editorSession, editorSurface, profiles, renameTerminalPane,
    saveActivePaneTranscript, setOrchestrationError, setOrchestrationOpen, shellLayout, terminal,
    terminalSurface, workspacePath, worktrees,
  });

  const visiblePaletteCommands = visibleAppCommandPaletteCommands({
    activeAgentSession, activeAgentSessionHandle, activeChat, attachSelectedFileToComposer,
    browser, chatSearchViewResults,
    closeSelectedEditorTab: () => { if (editorSession.selectedFile) void editorNavigation.closeTab(editorSession.selectedFile); },
    commandPalette, commandPaletteSources, composerAttachments, composerSurface,
    editorFileWorkflow, editorSession, editorSurface, editorWorkspace, exportRenderPerfSnapshot,
    openChatSearchResult, paneTranscripts, persistence, profiles, projectEntryActions,
    projectSessionNavigationActions, quickOpen, saveEditorFile, setOrchestrationError,
    setOrchestrationOpen, setSettingsOpen, shellLayout, terminal, terminalFind, terminalSurface,
    visibleOpenProjects, workspacePath, worktrees,
  });
  useAgentHookRuntime({
    activeChat, agentActivityHook, editorFileWorkflow, editorSession, persistence,
    setStatus: setAgentHookStatus, terminal, terminalSurface, workspacePath, workspacePathRef,
  });

  useEditorWorkspaceRuntime({
    editorFileWorkflow, editorSession, editorWorkspace, persistence, treeRef,
    workspacePath, workspacePathRef, workspaceTree,
  });

  useAppTerminalRuntime({
    approvalMode: agentApprovalMode, browser, commandPalette,
    detectLocalServer: detectLocalDevServerFromSnapshot, pickWorkspace, projectEntryActions,
    quickOpen, recordActivity: agentActivityHook.recordAgentActivity,
    sendResize: sendTerminalResize, setAgentActivity: agentActivityHook.setAgentActivityEvents,
    setError: setLaunchError, setSettingsOpen,
    shell: {
      chrome, mcpOAuth, paneTranscripts, setAiConnectionSettings, setBackgroundExits,
      setCommandPaletteSources, setKeybindingOverrides, setWorktrees,
    },
    workspace: { composerWorkspace, editorSession, persistence, profiles, terminal },
    workspaceOpenActions, workspacePathRef,
    refs: {
      aiConnectionSettings: aiConnectionSettingsRef, canvas: canvasRef, frame, imeInput: imeInputRef,
      ipcSampleCounter, latest, metrics, renderPerf: renderPerfRef, selection, selecting,
      store: storeRef, terminalHost: terminalHostRef,
    },
  });

  const activeTerminalPaneLabel = activePaneDisplayLabel(terminal.panes, activeAgentSession.activeTerminalPane);
  const surfaceLabels = deriveAppSurfaceLabels({
    activeRunId: activeChat.activeChatConversation.activeRunId,
    activeSessionId: activeChat.activeSessionId,
    sessions: projectSessionsFor(workspacePath ?? ""),
    trayMode: shellLayout.utilityTrayMode,
    workspacePath,
  });
  const { settingsConnectionActions, settingsPreferenceActions, settingsScopedActions } = buildSettingsActions({
    aiConnectionSettingsRef, browser, chrome, commandPaletteSources, composerSettingsActions,
    composerWorkspace, keybindingOverrides, mcpOAuth, persistence, profiles,
    resetDurableChats: resetDurableChatStore, setActiveKeybindingOverrides, setAiConnectionSettings,
    setCommandPaletteSources, setKeybindingOverrides, storeRef, workspacePath, workspacePathRef,
  });

  return <AppWorkbenchView {...{
    activeAgentSession, activeAgentSessionHandle, activeChat, activeTerminalProfile,
    agentHookStatus, aiConnectionSettings, appMenuAssembly, backgroundExits, browser,
    chatConversationActions, chatRunControls, chatSearch, chrome, commandPalette,
    commandPaletteSources, composerAttachments, composerError, composerHistoryNavigation,
    composerLocal, composerMentionQuery, composerMentionResults, composerNotice, composerSending,
    composerSettingsActions, composerSurface, composerWorkspace,
    connectionActions: settingsConnectionActions,
    contextMenuElement: contextMenuHost.element, contextMenuHost, diffContextMenuItems,
    diffReviewHook, drawerSearchQuery, drawerSearchResults, editorContextMenuItems,
    editorFileWorkflow, editorNavigation, editorSession, editorSurface, editorTabContextMenuItems,
    editorWorkspace, focusedChatMessageId, gitStatusHook, handleEditorUpdate, imeInputRef,
    keybindingOverrides, launchError, mcpOAuth, openSettings, openUrl, orchestrationError,
    orchestrationLaunching, orchestrationOpen, paneTranscripts, persistence, pickWorkspace,
    preferenceActions: settingsPreferenceActions, profiles, projectCreationOpen,
    projectEntryActions, projectEntryOpen, projectRailContextMenuItems, projectRailStatus,
    projectSessionContextMenuItems, projectSessionNavigationActions, projectSessionStatus,
    projectSwitcherOpen, quickOpen, railBodyRef, railHeight, renameTerminalPane,
    requestOpenWorkspace, saveEditorFile, scopedActions: settingsScopedActions,
    setComposerNotice, setDrawerSearchQuery, setOrchestrationError, setOrchestrationOpen,
    setProjectCreationOpen, setProjectSwitcherOpen, setSettingsOpen, settingsInitialCategory,
    settingsOpen, settingsRuntime, shellLayout, surfaceLabels, tabIsDirty, terminal,
    terminalContextMenuItems, terminalFind, terminalHostRef, terminalSurface, treeRef,
    utilityTrayControls, visibleOpenProjects, visiblePaletteCommands,
    workspaceContextMenuActions, workspaceContextMenuItems, workspaceFileActions,
    workspacePath, workspaceTree, worktreeLabelDialog: worktreeLabelRequest.dialog, worktrees,
    canvasRef,
  }} />;
}

export default App;
