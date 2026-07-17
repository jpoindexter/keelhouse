import { useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath, openUrl } from "@tauri-apps/plugin-opener";
import { load } from "@tauri-apps/plugin-store";
import type { TreeApi } from "react-arborist";
import { DraftNavigationDialog } from "./DraftNavigationDialog";
import { BrowserPreviewPanel } from "./BrowserPreviewPanel";
import { AppTitlebar } from "./AppTitlebar";
import { BottomUtilityTray } from "./BottomUtilityTray";
import { bottomUtilityTrayPropsFrom } from "./bottomUtilityTrayHost";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import { WorkbenchResizers } from "./WorkbenchResizers";
import { drawerTitleFor } from "./drawerModes";
import { AppRuntimeDialogs } from "./AppRuntimeDialogs";
import { appRuntimeDialogsPropsFrom } from "./appRuntimeDialogsHost";
import { useConversationRuntime } from "./useConversationRuntime";
import { selectionToText } from "./selection";
import type { SelectionRange } from "./selection";
import { activeProjectSessionId } from "./workspaceState";
import type { OpenProject, ProjectRailStatus, ProjectSession } from "./workspaceState";
import { WorkspaceSideRail } from "./WorkspaceSideRail";
import { workspaceSideRailPropsFrom } from "./workspaceSideRailHost";
import { appRuntimeMenusFrom } from "./appRuntimeMenuHost";
import { visibleAppCommandPaletteCommands } from "./appCommandPaletteHost";
import { AgentConversationPanel } from "./AgentConversationPanel";
import { agentConversationPanelPropsFrom } from "./agentConversationPanelHost";
import { useContextMenuHost } from "./useContextMenuHost";
import { createTerminalPaneCommands, createWorktreePersistence } from "./terminalPaneCommands";
import { createTerminalSurfaceActions, terminalSurfaceDepsFromHook } from "./terminalSurfaceController";
import { createUtilityTrayControls } from "./utilityTrayControls";
import { createTerminalPaneRename } from "./terminalPaneRename";
import { WorkbenchEditorSection } from "./WorkbenchEditorSection";
import { workbenchEditorSectionPropsFrom } from "./workbenchEditorSectionHost";
import { createRenderPerfExport } from "./renderPerfExport";
import { createDevServerDetection } from "./devServerDetectionSurface";
import { createPaneTranscriptCapture } from "./paneTranscriptCapture";
import { deriveAppSurfaceLabels } from "./appSurfaceLabels";
import { AppSettingsHost } from "./appSettingsHost";
import { appSettingsHostPropsFrom } from "./appSettingsHostProps";
import { WorkbenchDockPanels } from "./WorkbenchDockPanels";
import { workbenchDockPanelsPropsFrom } from "./workbenchDockPanelsHost";
import { WorkbenchShell } from "./WorkbenchShell";
import { browserPreviewPropsFrom } from "./browserPreviewHost";
import { useComposerRuntime } from "./useComposerRuntime";
import { visibleProjectsFrom } from "./projectRailView";
import { createComposerHarnessEventLog } from "./composerHarnessEvents";
import { createTerminalResize } from "./terminalResize";
import { searchDialogPropsFrom } from "./searchCommandDialogHost";
import { transcriptsModalPropsFrom } from "./transcriptsModalHost";
import { sourceRepoStatusTitleFrom, statusBarRepoPropsFrom } from "./statusBarHost";
import { appTitlebarPropsFrom } from "./appTitlebarHost";
import { draftNavigationPropsFrom } from "./draftNavigationHost";
import {
  projectRailStatusFromConversations,
  projectSessionStatusFromConversations,
} from "./projectChatStatus";
import {
  defaultTerminalLaunchProfile,
} from "./launchProfiles";
import {
  createActiveAgentSessionHandle,
} from "./agentSessionHandle";
import type { AgentSessionHandle, AgentSessionHandleDescriptor } from "./agentSessionHandle";
import {
  setActiveKeybindingOverrides,
  shortcutKeys,
} from "./shortcuts";
import { SearchCommandDialog } from "./SearchCommandDialog";
import { useCommandPalette } from "./useCommandPalette";
import { QuickOpenDialog } from "./QuickOpenDialog";
import { useQuickOpen } from "./useQuickOpen";
import { filterWorkspaceFiles } from "./workspaceSearch";
import { useWorkspaceDomain } from "./useWorkspaceDomain";
import { activePaneDisplayLabel } from "./terminalPane";
import { useGitDiffReview } from "./useGitDiffReview";
import { useAppShellDomain } from "./useAppShellDomain";
import { useSyncRef } from "./useSyncRef";
import {
  DEFAULT_AI_CONNECTION_SETTINGS,
  connectionEnvironmentInputs,
  type AiConnectionSettings,
} from "./connectionSettings";
import { createRenderPerfState } from "./renderPerf";
import type { AgentHookStatus } from "./useAgentHookRequests";
import { useAgentHookRuntime } from "./useAgentHookRuntime";
import { useAppTerminalRuntime } from "./useAppTerminalRuntime";
import { useAppEditorSurfaceRuntime } from "./useAppEditorSurfaceRuntime";
import { appEditorMenusFrom } from "./appEditorMenuRuntime";
import { appWorkspaceProjectRuntimeFrom } from "./appWorkspaceProjectRuntime";
import { appProjectSessionRuntimeFrom } from "./appProjectSessionRuntime";
import { appComposerSurfaceRuntimeFrom } from "./appComposerSurfaceRuntime";
import { buildSettingsActions } from "./settingsActionsHost";
import { deriveActiveAgentSessionState } from "./activeAgentSessionState";
import { deriveEditorWorkspaceState } from "./editorWorkspaceState";
import { TranscriptsModal } from "./TranscriptsModal";
import { useTerminalFind } from "./useTerminalFind";
import { applyChatRunEnvelope } from "./chatConversation";
import { createChatConversationActions } from "./chatConversationActions";
import { useChatRunEvents } from "./useChatRunEvents";
import { useEditorWorkspaceRuntime } from "./useEditorWorkspaceRuntime";
import {
  resetDurableChatStore,
  saveDurableChatConversation,
} from "./chatStore";
import {
  createWorkspaceCheckpoint,
} from "./workspaceCheckpoints";
import { mergeChatDiscoveryResults, type ChatSearchViewResult } from "./chatDiscovery";
import type { FileTreeNode } from "./fileTreeTypes";
import { StatusBar } from "./StatusBar";
import type { ContextMenuItem } from "./ContextMenu";
import { ProjectCreationDialog } from "./ProjectCreationDialog";
import { projectCreationCommands } from "./projectCreationCommands";
import { WorktreeLabelDialog } from "./WorktreeLabelDialog";
import { useWorktreeLabelRequest } from "./useWorktreeLabelRequest";
import "./App.css";
import "./composerModelPicker.css";
import "./responsive-shell.css";
import "./workbenchTransitions.css";

// SPIKE-2 frontend: paint the grid snapshots from the Rust backend onto a canvas,
// and encode keydowns back into pty bytes. Ship-ugly on purpose.

type Cell = { t: string; f: [number, number, number]; b: [number, number, number]; bold: boolean };
type Snapshot = { cols: number; rows: number; cx: number; cy: number; cvis: boolean; sb: number; cells: Cell[] };
function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imeInputRef = useRef<HTMLTextAreaElement>(null);
  const terminalHostRef = useRef<HTMLDivElement>(null);
  const railBodyRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<TreeApi<FileTreeNode> | undefined>(undefined);
  const workspacePathRef = useRef<string | null>(null);
  const storeRef = useRef<Awaited<ReturnType<typeof load>> | null>(null);
  const aiConnectionSettingsRef = useRef<AiConnectionSettings>(DEFAULT_AI_CONNECTION_SETTINGS);
  const activeAgentSessionDescriptorRef = useRef<AgentSessionHandleDescriptor | null>(null);
  const fileNodeContextMenuItemsRef = useRef<(node: FileTreeNode) => ContextMenuItem[]>(() => []);
  const activeSessionLookupRef = useRef<(root: string | null) => string | null>(() => null);
  const persistPaneLayoutRef = useRef<(
    root: string, sessionId: string, panes: ManagedTerminalPane[],
  ) => void>(() => {});
  const latest = useRef<Snapshot | null>(null);
  const frame = useRef<number | null>(null);
  const metrics = useRef({ cw: 9, ch: 19 });
  const renderPerfRef = useRef(createRenderPerfState());
  const ipcSampleCounter = useRef(0);
  const selection = useRef<SelectionRange | null>(null);
  const selecting = useRef(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [projectCreationOpen, setProjectCreationOpen] = useState(false);
  const [projectSwitcherOpen, setProjectSwitcherOpen] = useState(false);
  const worktreeLabelRequest = useWorktreeLabelRequest();
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const {
    composerWorkspace, editorSession, persistence, profiles, terminal, workspaceTree,
  } = useWorkspaceDomain<Snapshot>({
    activeSessionLookupRef, persistPaneLayoutRef, storeRef, workspacePath, workspacePathRef,
  });
  const [agentHookStatus, setAgentHookStatus] = useState<AgentHookStatus | null>(null);
  const contextMenuHost = useContextMenuHost({
    buildFileNodeItems: (node) => fileNodeContextMenuItemsRef.current(node),
    onActionError: (item, error) => setLaunchError(`${item.label} failed: ${String(error)}`),
  });
  const commandPalette = useCommandPalette(() => contextMenuHost.setContextMenu(null));
  const {
    aiConnectionSettings, backgroundExits, chatSearch, chrome, commandPaletteSources,
    composerError, composerNotice, composerSending, drawerSearchQuery, focusedChatMessageId,
    gitStatusHook, keybindingOverrides, mcpOAuth, orchestrationError, orchestrationLaunching,
    openSettings, orchestrationOpen, paneTranscripts, projectEntryOpen, railHeight, setAiConnectionSettings, setBackgroundExits,
    setCommandPaletteSources, setComposerError, setComposerNotice, setComposerSending,
    setDrawerSearchQuery, setFocusedChatMessageId, setKeybindingOverrides, setOrchestrationError,
    setOrchestrationLaunching, setOrchestrationOpen, setSettingsOpen, setWorktrees,
    settingsInitialCategory, settingsOpen, settingsRuntime, shellLayout, worktrees,
  } = useAppShellDomain({
    commandPalette: { open: commandPalette.open, query: commandPalette.query },
    railBodyRef, storeRef, treeRefreshKey: workspaceTree.refreshKey, workspacePath, workspacePathRef,
  });
  const diffReviewHook = useGitDiffReview({
    gateAction: (action) => agentActivityHook.gateAppAction(action),
    getRoot: () => workspacePathRef.current ?? workspacePath,
    hasUnsaved: (path) => editorSurface.editorHasUnsavedBufferForPath(path),
    onRefreshFiles: workspaceTree.refresh,
    onStatus: (status, root) => { gitStatusHook.setStatus(status); gitStatusHook.setRoot(root); },
  });
  const editorWorkspace = deriveEditorWorkspaceState({
    diffReview: diffReviewHook.review, editorBuffers: editorSession.editorBuffersRef.current, editorError: editorSession.editorError, editorTabs: editorSession.editorTabs,
    editorText: editorSession.editorText, fileTree: workspaceTree.tree, gitStatus: gitStatusHook.status, gitStatusRoot: gitStatusHook.root, savedEditorText: editorSession.savedEditorText,
    selectedFile: editorSession.selectedFile, workspacePath,
  });
  const drawerSearchResults = useMemo(() => {
    return filterWorkspaceFiles(editorWorkspace.searchableFiles, drawerSearchQuery, drawerSearchQuery.trim() ? 80 : 40);
  }, [drawerSearchQuery, editorWorkspace.searchableFiles]);
  const chatSearchViewResults = useMemo<ChatSearchViewResult[]>(
    () => mergeChatDiscoveryResults(
      chatSearch.results,
      persistence.projectSessions,
      composerWorkspace.chatConversations,
      commandPalette.query,
      false,
    ),
    [composerWorkspace.chatConversations, chatSearch.results, commandPalette.query, persistence.projectSessions],
  );
  const quickOpen = useQuickOpen(editorWorkspace.searchableFiles, () => contextMenuHost.setContextMenu(null));
  const { activeChat, agentApprovalMode, agentActivityHook, browser } = useConversationRuntime({
    activeAgentSessionDescriptorRef, composerWorkspace, persistence, profiles,
    shellLayout, storeRef, workspacePath, workspacePathRef,
  });
  const {
    attachSelectedFileToComposer, composerAttachments, composerLocal,
    composerMentionQuery, composerMentionResults,
  } = useComposerRuntime({
    activeChat, agentActivityHook, browser, composerWorkspace, editorSession,
    logEvent: (label, detail) => logComposerHarnessEvent(label, detail),
    profiles, searchableFiles: editorWorkspace.searchableFiles,
    setError: setComposerError, setNotice: setComposerNotice, shellLayout, workspacePathRef,
  });
  const activeAgentSession = deriveActiveAgentSessionState({
    activeSessionId: activeChat.activeSessionId, activeTerminalPaneId: terminal.activePaneId, agentActivityEvents: agentActivityHook.agentActivityEvents, agentActivityFilter: agentActivityHook.agentActivityFilter,
    agentApprovalMode, terminalPanes: terminal.panes, workspacePath,
  });
  const terminalFind = useTerminalFind(activeAgentSession.activeTerminalPane != null);
  useSyncRef(activeAgentSessionDescriptorRef, activeAgentSession.activeAgentSessionDescriptor);
  const activeTerminalProfile = activeAgentSession.activeTerminalPane?.profile ?? profiles.terminalProfile;
  const composerHarnessSessionKey = (root: string, sessionId: string) => `${root}\n${sessionId}`;

  const chatConversationActions = createChatConversationActions({
    createCheckpoint: createWorkspaceCheckpoint,
    getActiveChatId: () => activeChat.activeComposerHarnessKey,
    getConversations: () => composerWorkspace.chatConversationsRef.current,
    getForkContext: () => {
      const projectPath = workspacePathRef.current;
      const sourceSessionId = activeProjectSessionId(
        persistence.activeSessionByProjectRef.current, persistence.projectSessionsRef.current, projectPath,
      );
      return {
        browserUrl: browser.urlRef.current,
        projectPath,
        sessions: projectPath ? persistence.projectSessionsRef.current[projectPath] ?? [] : [],
        sessionsByProject: persistence.projectSessionsRef.current,
        sourceSessionId,
      };
    },
    now: Date.now,
    persistBrowserUrl: browser.persistUrl,
    persistSessions: (sessions) => persistence.persistProjectSessions(sessions, persistence.activeSessionByProjectRef.current),
    refreshSearch: chatSearch.refresh,
    reportPersistenceError: (message) => {
      setLaunchError(message);
      void invoke("log_health_event", { message }).catch(() => {});
    },
    saveConversation: saveDurableChatConversation,
    setConversations: composerWorkspace.setChatConversations,
    setError: setLaunchError,
    setNotice: chrome.setActionNotice,
    switchSession: (root, sessionId) => projectSessionNavigationActions.switchSession(root, sessionId),
  });

  useChatRunEvents((envelope) => {
    chatConversationActions.updateConversation(envelope.chatId, (conversation) =>
      applyChatRunEnvelope(conversation, envelope));
  });

  const logComposerHarnessEvent = createComposerHarnessEventLog({
    getDescriptor: () => activeAgentSession.activeAgentSessionDescriptor,
    recordActivity: agentActivityHook.recordAgentActivity,
  });


  const detectLocalDevServerFromSnapshot = createDevServerDetection({
    approvalMode: (root, sessionId) =>
      composerWorkspace.composerHarnessBySessionRef.current[composerHarnessSessionKey(root, sessionId)]?.approvalMode ?? "ask",
    contextForPane: terminal.contextForPaneId,
    fallbackPanes: () => terminal.panesRef.current,
    fallbackRoot: () => workspacePathRef.current,
    fallbackSessionId: persistence.activeSessionForProject,
    getPrevious: () => browser.detectedServerRef.current,
    now: Date.now,
    recordActivity: agentActivityHook.recordAgentActivity,
    setDetectedServer: browser.setDetectedServer,
  });

  const {
    captureCurrentSessionSnapshot, projectCloseController, requestCloseProject,
    requestOpenWorkspace, workspaceOpenActions,
  } = appWorkspaceProjectRuntimeFrom({
    browser, chrome, composerLocal, composerWorkspace, connectionSettings: aiConnectionSettingsRef,
    editorSession, editorWorkspace, latest,
    openEditorFile: (file) => editorFileWorkflow.openDirect(file), persistence, profiles,
    projectEntryOpen, requestEditorNavigation: (navigation) => editorNavigation.requestNavigation(navigation),
    scheduleResize: () => setTimeout(sendTerminalResize, 0), setBackgroundExits,
    setLaunchError, setWorkspacePath, shellLayout, storeRef, terminal,
    workspacePathRef, workspaceTree,
  });

  const {
    finalizeCreatedTerminalPane, openChatSearchResult, paneActivityLog, pickWorkspace,
    projectEntryActions, projectSessionDeletionController, projectSessionMetadataActions,
    projectSessionNavigationActions,
  } = appProjectSessionRuntimeFrom({
    activeChat, agentActivityHook, agentApprovalMode, browser, captureCurrentSession: captureCurrentSessionSnapshot,
    chatSearch, chrome, composerLocal, composerWorkspace,
    createTerminalPane: (profile) => terminalSurface.createTerminalPane(profile),
    persistence, profiles, requestOpenWorkspace,
    scheduleResize: () => setTimeout(sendTerminalResize, 0), setFocusedChatMessageId,
    setLaunchError, setProjectCreationOpen, setProjectSwitcherOpen, shellLayout,
    storeRef, terminal, workspaceOpenActions, workspacePathRef,
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

  const terminalSurface = createTerminalSurfaceActions<Snapshot, SelectionRange>(terminalSurfaceDepsFromHook(terminal, {
    ...createTerminalPaneCommands({
      environmentForRoot: (root) => connectionEnvironmentInputs(aiConnectionSettingsRef.current, root),
    }),
    ...createWorktreePersistence({
      save: (next) => {
        void storeRef.current?.set("worktrees", next); void storeRef.current?.save();
      },
      setWorktrees,
    }),
    getChanging: () => profiles.changing,
    getSessionId: persistence.activeSessionForProject,
    activeAgentDescriptor: () => activeAgentSession.activeAgentSessionDescriptor,
    activeAgentHandle: () => activeAgentSessionHandle,
    activePane: () => activeAgentSession.activeTerminalPane,
    approvalMode: () => agentApprovalMode,
    copyText: writeText,
    defaultProfile: () => profiles.terminalProfileRef.current,
    finalizePane: finalizeCreatedTerminalPane,
    gateAction: async (action, handle) => (await agentActivityHook.gateAppAction(action, handle)).decision,
    getWorkspacePath: () => workspacePathRef.current,
    getWorkspacePathOrState: () => workspacePathRef.current ?? workspacePath,
    getWorktrees: () => worktrees,
    latest, now: Date.now,
    promptWorktreeLabel: worktreeLabelRequest.requestLabel,
    readClipboard: readText,
    recordActivity: agentActivityHook.recordAgentActivity,
    recordCreated: paneActivityLog.recordCreated,
    recordCreatedWorktree: paneActivityLog.recordCreatedWorktree,
    requestPaint: () => terminal.requestPaintRef.current(), savedLabel: persistence.savedPaneLabel,
    scheduleResize: () => setTimeout(sendTerminalResize, 0), selection,
    selectionText: (snap, snapSelection) => selectionToText(snap.cells, snap.cols, snapSelection),
    setChanging: profiles.setChanging,
    setComposerError, setLaunchError,
    updateProjectStatus: persistence.updateOpenProjectStatus,
    updateSessionStatus: (root, status) => persistence.updateActiveSessionStatus(root, status),
  }));

  const utilityTrayControls = createUtilityTrayControls({
    closeSettings: () => setSettingsOpen(false),
    createTerminalPane: (profile) => terminalSurface.createTerminalPane(profile),
    defaultProfile: defaultTerminalLaunchProfile,
    getRoot: () => workspacePathRef.current ?? workspacePath,
    getSessionId: persistence.activeSessionForProject,
    getSurfaceMode: () => shellLayout.agentSurfaceMode,
    getTrayMode: () => shellLayout.utilityTrayMode,
    hasTerminalPanes: (root, sessionId) => terminal.panesForSession(root, sessionId).length > 0,
    pickWorkspace: (pickOptions) => pickWorkspace(pickOptions),
    resolveProfile: profiles.resolveProfile,
    setSurfaceMode: shellLayout.setAgentSurfaceMode,
    setTrayMode: shellLayout.setUtilityTrayMode,
  });

  const activeAgentSessionHandle: AgentSessionHandle | null = activeAgentSession.activeAgentSessionDescriptor
    ? createActiveAgentSessionHandle({
        activePaneId: () => terminal.activePaneIdRef.current,
        closePane: terminalSurface.closeTerminalPane,
        descriptor: activeAgentSession.activeAgentSessionDescriptor,
        focusPane: terminalSurface.focusTerminalPane,
        recordClosed: (descriptor) => agentActivityHook.recordAgentActivity(descriptor, {
          kind: "process", label: "Closed pane", detail: descriptor.label, status: "exited",
        }),
        sendEnter: () => invoke("send_key", {
          code: "Enter", text: null, shift: false, alt: false, ctrl: false, sup: false,
        }),
        sendInterrupt: () => invoke("send_key", {
          code: "KeyC", text: null, shift: false, alt: false, ctrl: true, sup: false,
        }),
        sendText: (text) => invoke("paste", { text }),
        snapshot: (paneId) => terminal.snapshotsRef.current[paneId] ??
          (terminal.activePaneIdRef.current === paneId ? latest.current : null),
      })
    : null;

  const renameTerminalPane = createTerminalPaneRename({
    getPanes: terminal.panesForSession,
    getRoot: () => workspacePathRef.current,
    getSessionId: persistence.activeSessionForProject,
    persistLabel: persistence.persistPaneLabel,
    promptLabel: (current) => window.prompt("Pane name or task label", current),
    setSessionPanes: terminal.setSessionPanes,
  });

  const sendTerminalResize = createTerminalResize({
    getCellMetrics: () => metrics.current,
    getHostRect: () => terminalHostRef.current?.getBoundingClientRect(),
    getWindowSize: () => ({ height: window.innerHeight, width: window.innerWidth }),
    resize: (cols, rows) => invoke("resize_pty", { cols, rows }),
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
  const drawerActiveTitle = drawerTitleFor(shellLayout.sideDrawerMode);
  const sourceRepoStatusTitle = sourceRepoStatusTitleFrom(settingsRuntime.repoLocation, settingsRuntime.sourceControlStatus);
  const { settingsConnectionActions, settingsPreferenceActions, settingsScopedActions } = buildSettingsActions({
    aiConnectionSettingsRef, browser, chrome, commandPaletteSources, composerSettingsActions,
    composerWorkspace, keybindingOverrides, mcpOAuth, persistence, profiles,
    resetDurableChats: resetDurableChatStore, setActiveKeybindingOverrides, setAiConnectionSettings,
    setCommandPaletteSources, setKeybindingOverrides, storeRef, workspacePath, workspacePathRef,
  });

  return (
    <WorkbenchShell
      handlers={{
        beginSideDrawerResize: shellLayout.beginSideDrawerResize,
        hideTools: () => shellLayout.setWorkbenchLayout("hidden"),
        nudgeSideDrawerResize: shellLayout.nudgeSideDrawerResize,
        setToolTrayMode: shellLayout.setToolTrayMode,
      }}
      layout={{
        appShellStyle: shellLayout.appShellStyle, renderedWorkbenchLayout: shellLayout.renderedWorkbenchLayout, settingsOpen, sideDrawerCollapsed: shellLayout.sideDrawerCollapsed,
        surfaceMode: shellLayout.agentSurfaceMode, toolTrayMode: shellLayout.toolTrayMode, utilityTrayHeight: shellLayout.utilityTrayHeight, workbenchStyle: shellLayout.workbenchStyle,
      }}
      refs={{ workbenchRef: shellLayout.workbenchRef }}
      slots={{
        titlebar: <AppTitlebar {...appTitlebarPropsFrom({
        activeSessionTitle: surfaceLabels.activeSessionTitle,
        newTask: projectEntryActions.newTask,
        openCommandPalette: commandPalette.openDialog,
        openSettings: () => setSettingsOpen(true),
        openWorkspaceFolder: openPath,
        renderedLayout: shellLayout.renderedWorkbenchLayout,
        resetInterface: shellLayout.resetInterface,
        setLayout: shellLayout.setWorkbenchLayout,
        setToolMode: shellLayout.setToolTrayMode,
        sideDrawerCollapsed: shellLayout.sideDrawerCollapsed,
        storedLayout: shellLayout.workbenchLayout,
        surfaceLabel: surfaceLabels.primarySurfaceLabel,
        surfaceState: surfaceLabels.primarySurfaceState,
        surfaceStatusLabel: surfaceLabels.primarySurfaceStatusLabel,
        terminalOpen: shellLayout.agentSurfaceMode === "terminal",
        toggleRawTerminal: utilityTrayControls.toggleRawTerminal,
        toggleSideDrawer: () => shellLayout.setSideDrawerCollapsed((collapsed) => !collapsed),
        toolMode: shellLayout.toolTrayMode,
        workspacePath,
      })} />,
        rail: <WorkspaceSideRail {...workspaceSideRailPropsFrom({
          activeChat, backgroundExits, browser, composerSettingsActions, contextMenuHost,
          diffReviewHook, drawerActiveTitle, editorFileWorkflow, editorSession, editorWorkspace,
          gitStatusHook, openUrl, persistence, pickWorkspace, profiles, projectEntryActions, projectRailContextMenuItems,
          projectRailStatus, projectSessionContextMenuItems, projectSessionNavigationActions,
          projectEntryOpen, projectSessionStatus, projectSwitcherOpen, railBodyRef, railHeight, requestOpenWorkspace,
          setProjectSwitcherOpen, setSettingsOpen,
          shellLayout, treeRef, utilityTrayControls, visibleOpenProjects, workspaceContextMenuItems,
          workspaceFileActions, workspacePath, workspaceTree,
        })} />,
        main: <>
        <WorkbenchDockPanels {...workbenchDockPanelsPropsFrom({
          activeChat, browser, contextMenuHost, diffReviewHook, drawerSearchQuery, drawerSearchResults, editorFileWorkflow,
          editorSession, editorWorkspace, gitStatusHook, setDrawerSearchQuery, workspaceContextMenuActions,
          surfaceLabels, workspaceFileActions, workspacePath, workspaceTree,
        })} />
        <WorkbenchEditorSection {...workbenchEditorSectionPropsFrom({
          contextMenuHost, diffContextMenuItems, diffReviewHook, editorContextMenuItems,
          editorFileWorkflow, editorNavigation, editorSession, editorSurface, editorTabContextMenuItems,
          editorWorkspace, handleEditorUpdate, saveEditorFile, tabIsDirty,
        })} />

        <WorkbenchResizers
          layout={shellLayout.renderedWorkbenchLayout}
          onKeyDown={shellLayout.nudgeWorkbenchResize}
          onPointerDown={shellLayout.beginWorkbenchResize}
          sizing={shellLayout.workbenchSizing}
          trayMode={shellLayout.toolTrayMode}
        />

        <BrowserPreviewPanel {...browserPreviewPropsFrom(browser, {
          contextMenu: (event) => contextMenuHost.openContextMenu(event, appMenuAssembly.browserContextMenuItems()),
          openExternal: openUrl,
        })} />

        <AgentConversationPanel {...agentConversationPanelPropsFrom({
          activeAgentSession, activeChat, aiConnectionSettings, appMenuAssembly, chatConversationActions,
          chatRunControls, composerAttachments, composerError, composerHistoryNavigation, composerLocal,
          composerMentionQuery, composerMentionResults, composerNotice, composerSending,
          composerSettingsActions, composerSurface, contextMenuHost, editorSurface, focusedChatMessageId,
          gitStatusHook, openSettings, profiles, projectEntryActions, setComposerNotice, shellLayout, terminal, terminalSurface, worktrees, workspacePath,
        })} />
        <BottomUtilityTray {...bottomUtilityTrayPropsFrom({
          activeAgentSession, activeAgentSessionHandle, activeTerminalProfile, appMenuAssembly, canvasRef,
          contextMenuHost, defaultTerminalLaunchProfile, imeInputRef,
          paste: (text) => { invoke("paste", { text }).catch(() => {}); },
          pickWorkspace, profiles, renameTerminalPane, shellLayout, terminal, terminalContextMenuItems,
          terminalFind, terminalHostRef, terminalSurface, utilityTrayControls, workspacePath,
        })} />
        </>,
        overlays: <>

      <AppSettingsHost {...appSettingsHostPropsFrom({
        activeChat, agentHookStatus, aiConnectionSettings, chrome, commandPaletteSources,
        connectionActions: settingsConnectionActions, gitStatusHook, keybindingOverrides, mcpOAuth,
        openUrl, preferenceActions: settingsPreferenceActions, profiles,
        scopedActions: settingsScopedActions, setSettingsOpen, settingsInitialCategory, settingsOpen, settingsRuntime,
        shellLayout, surfaceLabels, utilityTrayControls, workspacePath,
      })} />
      <TranscriptsModal {...transcriptsModalPropsFrom(
        { openTranscriptId: paneTranscripts.openTranscriptId, paneTranscripts: paneTranscripts.paneTranscripts, setOpenTranscriptId: paneTranscripts.setOpenTranscriptId, setTranscriptsOpen: paneTranscripts.setTranscriptsOpen, transcriptsOpen: paneTranscripts.transcriptsOpen },
        { projectId: workspacePath, projectSessionId: activeChat.activeSessionId },
      )} />
      <ProjectCreationDialog
        open={projectCreationOpen}
        onClose={() => setProjectCreationOpen(false)}
        onCreateProject={projectCreationCommands.create}
        onInitializeGit={projectCreationCommands.initializeGit}
        onOpenProject={projectSessionNavigationActions.createSession}
        onPickParent={async () => {
          const parent = await open({ directory: true });
          return typeof parent === "string" ? parent : null;
        }}
      />
      <WorktreeLabelDialog {...worktreeLabelRequest.dialog} />
      <AppRuntimeDialogs {...appRuntimeDialogsPropsFrom({
        activeChat, chrome, composerSurface, composerWorkspace, launchError, orchestrationError,
        orchestrationLaunching, orchestrationOpen, persistence, pickWorkspace, profiles,
        setOrchestrationError, setOrchestrationOpen, workspacePath,
      })} />
      {contextMenuHost.element}
      {commandPalette.open ? (
        <SearchCommandDialog {...searchDialogPropsFrom(commandPalette, {
          commands: visiblePaletteCommands,
          error: chatSearch.error,
          loading: chatSearch.loading,
          shortcut: shortcutKeys("chrome.command-palette"),
        })} />
      ) : null}
      <QuickOpenDialog
        controller={quickOpen}
        shortcut={shortcutKeys("workspace.quick-open")}
        workspacePath={workspacePath}
        onOpenFile={(file) => void editorFileWorkflow.requestOpen(file, { focusEditor: true })}
      />
      {(() => {
        const draftProps = draftNavigationPropsFrom({
          cancel: editorNavigation.cancelNavigation,
          discard: editorNavigation.discardAndContinue,
          error: editorNavigation.draftDialogError,
          hasPendingNavigation: Boolean(editorNavigation.pendingNavigation),
          save: editorNavigation.saveAndContinue,
          saving: editorSession.editorSaving,
          selectedFile: editorSession.selectedFile,
        });
        return draftProps ? <DraftNavigationDialog {...draftProps} /> : null;
      })()}
      <StatusBar
        workspaceName={surfaceLabels.activeWorkspaceName}
        primarySurfaceState={surfaceLabels.primarySurfaceState}
        primarySurfaceLabel={surfaceLabels.primarySurfaceLabel}
        primarySurfaceStatusLabel={surfaceLabels.primarySurfaceStatusLabel}
        {...statusBarRepoPropsFrom(settingsRuntime.repoLocation, openUrl)}
        repoTitle={sourceRepoStatusTitle}
        surfaceMode={shellLayout.agentSurfaceMode}
        utilityLabel={surfaceLabels.utilityTrayStatusLabel}
      />
        </>,
      }}
    />
  );
}

export default App;
