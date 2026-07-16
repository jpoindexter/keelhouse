import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { confirm as confirmDialog, open } from "@tauri-apps/plugin-dialog";
import { openPath, openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { load } from "@tauri-apps/plugin-store";
import { EditorView, type ViewUpdate } from "@codemirror/view";
import { openSearchPanel } from "@codemirror/search";
import type { TreeApi } from "react-arborist";
import { DraftNavigationDialog } from "./DraftNavigationDialog";
import { BrowserPreviewPanel } from "./BrowserPreviewPanel";
import { AppTitlebar } from "./AppTitlebar";
import { BottomUtilityTray } from "./BottomUtilityTray";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import { WorkbenchResizers } from "./WorkbenchResizers";
import { DRAWER_MODES, drawerTitleFor } from "./drawerModes";
import { AppRuntimeDialogs } from "./AppRuntimeDialogs";
import { DEFAULT_BROWSER_PREVIEW_URL } from "./browserPreview";
import { useBrowserPreviewController } from "./useBrowserPreviewController";
import { useFilesRailHeight } from "./useFilesRailHeight";
import { useComposerLocalState } from "./useComposerLocalState";
import { createComposerSettingsActions } from "./composerSettingsActions";
import { useComposerAttachments } from "./useComposerAttachments";
import { useEditorNavigationLifecycle } from "./useEditorNavigationLifecycle";
import { useTerminalPaneController } from "./useTerminalPaneController";
import { useEditorSessionController } from "./useEditorSessionController";
import { useWorkspacePersistenceController } from "./useWorkspacePersistenceController";
import { selectionToText } from "./selection";
import type { SelectionRange } from "./selection";
import { activeProjectSessionId } from "./workspaceState";
import type { OpenProject, ProjectRailStatus, ProjectSession } from "./workspaceState";
import {
  findFileTreeNode,
  reconcileActiveFileNode,
} from "./editorState";
import {
  bootstrapRefsFromHooks, bootstrapSettersFromHooks, createWorkspaceBootstrapController,
} from "./workspaceBootstrapController";
import { WorkspaceSideRail } from "./WorkspaceSideRail";
import { createAppMenuAssembly } from "./appMenuAssembly";
import {
  assembleCommandPaletteCommands,
  visibleCommandPaletteCommands,
} from "./commandPaletteAssembly";
import { createSettingsConnectionActionsController } from "./settingsConnectionActionsController";
import { createProjectSessionMetadataActions } from "./projectSessionMetadataActions";
import { createEditorSurfaceActions } from "./editorSurfaceActions";
import type { GitStatusFile } from "./fileGitStatus";
import { buildAgentHookSnapshot, hookReportToActivity } from "./agentHookIntegration";
import { AgentConversationPanel } from "./AgentConversationPanel";
import { useContextMenuHost } from "./useContextMenuHost";
import { createTerminalPaneCommands, createWorktreePersistence } from "./terminalPaneCommands";
import { createTerminalSurfaceActions, terminalSurfaceDepsFromHook } from "./terminalSurfaceController";
import {
  workspaceOpenRecordsFromHooks, createWorkspaceOpenSurface, workspaceOpenTargetFromHook } from "./workspaceOpenSurface";
import { createChatRunControls } from "./chatRunControls";
import { createComposerSurface } from "./composerSurfaceController";
import { createComposerHistoryNavigation } from "./composerHistoryNavigation";
import { createUtilityTrayControls } from "./utilityTrayControls";
import { createTerminalPaneRename } from "./terminalPaneRename";
import { wireEditorFileWorkflow } from "./editorFileWorkflowSurface";
import { wireWorkspaceFileActions } from "./workspaceFileActionsSurface";
import { wireSessionCheckpointActions } from "./sessionCheckpointSurface";
import { deriveProjectSessionMenuState } from "./projectSessionMenuSurface";
import { WorkbenchEditorSection } from "./WorkbenchEditorSection";
import { createRenderPerfExport } from "./renderPerfExport";
import { createDevServerDetection } from "./devServerDetectionSurface";
import { createPaneTranscriptCapture } from "./paneTranscriptCapture";
import { deriveOrchestrationDialogState, orchestrationDialogPropsFrom } from "./orchestrationDialogState";
import { settingsAgentProfileOptions } from "./settingsModalData";
import { deriveAppSurfaceLabels } from "./appSurfaceLabels";
import { AppSettingsHost } from "./appSettingsHost";
import { WorkbenchDockPanels } from "./WorkbenchDockPanels";
import { WorkbenchShell } from "./WorkbenchShell";
import { browserPreviewPropsFrom, browserToolsDrawerPropsFrom } from "./browserPreviewHost";
import { quickSettingsDrawerPropsFrom } from "./quickSettingsHost";
import { composerMentionQuery as composerMentionQueryFrom } from "./agentComposer";
import { toggleExpandedProject, visibleProjectsFrom } from "./projectRailView";
import { fileTreeNodeFromPath, pathBasename } from "./fileTreeTypes";
import { createTerminalPaneFinalize } from "./terminalPaneFinalize";
import { createChatSearchNavigation } from "./chatSearchNavigation";
import { createSessionSnapshotCapture, createSessionSnapshotRestore } from "./sessionSnapshotCapture";
import { createComposerHarnessEventLog } from "./composerHarnessEvents";
import { createWorkspacePicker } from "./workspacePicker";
import { createPaneActivityLog } from "./paneActivityLog";
import { createTerminalResize } from "./terminalResize";
import { searchDialogPropsFrom } from "./searchCommandDialogHost";
import { transcriptsModalPropsFrom } from "./transcriptsModalHost";
import { sourceRepoStatusTitleFrom, statusBarRepoPropsFrom } from "./statusBarHost";
import { appTitlebarPropsFrom } from "./appTitlebarHost";
import { appNoticesPropsFrom } from "./appNoticesHost";
import { draftNavigationPropsFrom } from "./draftNavigationHost";
import {
  projectRailStatusFromConversations,
  projectSessionStatusFromConversations,
} from "./projectChatStatus";
import {
  LAUNCH_PROFILES,
  defaultTerminalLaunchProfile,
} from "./launchProfiles";
import type { LaunchProfile } from "./launchProfiles";
import { useLaunchProfileController } from "./useLaunchProfileController";
import { resolveScopedSetting } from "./scopedSettings";
import {
  createActiveAgentSessionHandle,
} from "./agentSessionHandle";
import type { AgentApprovalMode, AgentSessionHandle, AgentSessionHandleDescriptor } from "./agentSessionHandle";
import {
  setActiveKeybindingOverrides,
  shortcutKeys,
  type KeybindingOverrides,
} from "./shortcuts";
import { SearchCommandDialog } from "./SearchCommandDialog";
import { useCommandPalette } from "./useCommandPalette";
import { QuickOpenDialog } from "./QuickOpenDialog";
import { useQuickOpen } from "./useQuickOpen";
import {
  DEFAULT_COMMAND_PALETTE_SOURCES,
} from "./commandPaletteSources";
import { filterWorkspaceFiles } from "./workspaceSearch";
import { useAgentActivityController } from "./useAgentActivityController";
import { useComposerWorkspaceState } from "./useComposerWorkspaceState";
import { usePaneTranscriptController } from "./usePaneTranscriptController";
import { activePaneDisplayLabel } from "./terminalPane";
import { useGitStatus } from "./useGitStatus";
import { useGitDiffReview } from "./useGitDiffReview";
import { useShellLayout, type SideDrawerMode } from "./useShellLayout";
import { useAppChromeState } from "./useAppChromeState";
import { useSettingsRuntimeStatus } from "./useSettingsRuntimeStatus";
import { useSyncRef } from "./useSyncRef";
import { loadWorkspaceBootstrap } from "./workspaceBootstrap";
import { terminalSnapshotText } from "./terminalTranscript";
import { crashRecoveryMessage, deriveCrashRecovery } from "./crashRecovery";
import {
  worktreeForPaneId,
  type WorktreeRecord,
} from "./worktrees";
import {
  DEFAULT_AI_CONNECTION_SETTINGS,
  connectionEnvironmentInputs,
  type AiConnectionSettings,
  type ConnectionTargetStatus,
  type McpOAuthStart,
  type McpOAuthStatus,
} from "./connectionSettings";
import { useMcpOAuthStatus } from "./useMcpOAuthStatus";
import { createRenderPerfState, recordIpcPayloadBytes } from "./renderPerf";
import { useTerminalCanvasRuntime } from "./useTerminalCanvasRuntime";
import { useNativeAppEvents } from "./useNativeAppEvents";
import { useAgentHookRequests, type AgentHookStatus } from "./useAgentHookRequests";
import { buildTerminalContextMenuItems } from "./terminalContextMenu";
import { buildProjectSessionContextMenuItems } from "./projectSessionContextMenu";
import {
  buildFileNodeContextMenuItems,
  buildGitFileContextMenuItems,
  buildProjectRailContextMenuItems,
  buildWorkspaceContextMenuItems,
} from "./workspaceContextMenus";
import {
  buildDiffContextMenuItems,
  buildEditorContextMenuItems,
  buildEditorTabContextMenuItems,
} from "./editorContextMenus";
import {
  clearBackgroundExitsForProject,
  notifyBackgroundExit,
  type BackgroundExit,
} from "./backgroundExits";
import { requestPermission } from "@tauri-apps/plugin-notification";
import { createSettingsPreferenceActions } from "./settingsPreferenceActions";
import { createSettingsScopedActions } from "./settingsScopedActions";
import { deriveActiveChatState } from "./activeChatState";
import { deriveActiveAgentSessionState } from "./activeAgentSessionState";
import { deriveEditorWorkspaceState } from "./editorWorkspaceState";
import { TranscriptsModal } from "./TranscriptsModal";
import { useTerminalFind } from "./useTerminalFind";
import {
  applyChatRunEnvelope,
  chatProviderLabel,
} from "./chatConversation";
import type { ChatProvider } from "./chatConversation";
import { createChatConversationActions } from "./chatConversationActions";
import { useChatRunEvents } from "./useChatRunEvents";
import { useWorkspaceTreeWatcher } from "./useWorkspaceTreeWatcher";
import { useWorkspaceTree } from "./useWorkspaceTree";
import {
  deleteDurableChatConversation,
  deleteDurableProjectChats,
  resetDurableChatStore,
  saveDurableChatConversation,
} from "./chatStore";
import { useChatSearch } from "./useChatSearch";
import {
  createWorkspaceCheckpoint,
} from "./workspaceCheckpoints";
import { mergeChatDiscoveryResults, type ChatSearchViewResult } from "./chatDiscovery";
import type { FileTreeNode } from "./fileTreeTypes";
import { StatusBar } from "./StatusBar";
import type { ContextMenuItem } from "./ContextMenu";
import { composerReasoningLabel } from "./ComposerReasoningPicker";
import { createProjectCloseController, projectCloseFromHook } from "./projectCloseController";
import { createProjectSessionNavigationActions } from "./projectSessionNavigationActions";
import { createProjectSessionDeletionController, projectSessionDeletionFromHook } from "./projectSessionDeletionController";
import {
  createTerminalRuntimeEventHandlers,
  terminalRuntimeFromHook,
  type TerminalGridPayload,
  type TerminalPaneExitPayload,
} from "./terminalRuntimeEventHandlers";
import "./App.css";
import "./composerModelPicker.css";
import "./responsive-shell.css";
import "./workbenchTransitions.css";

// SPIKE-2 frontend: paint the grid snapshots from the Rust backend onto a canvas,
// and encode keydowns back into pty bytes. Ship-ugly on purpose.

type Cell = { t: string; f: [number, number, number]; b: [number, number, number]; bold: boolean };
type Snapshot = { cols: number; rows: number; cx: number; cy: number; cvis: boolean; sb: number; cells: Cell[] };
type SaveEditorFileOptions = { force?: boolean };
const formatBytes = (bytes: number | null) => {
  if (bytes == null) return "--";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

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
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const composerWorkspace = useComposerWorkspaceState({
    getRoot: () => workspacePathRef.current,
    getSessionId: (root) => activeProjectSessionId(
      activeSessionByProjectRef.current, projectSessionsRef.current, root,
    ),
    saveStore: async () => { await storeRef.current?.save(); },
    setStoreValue: async (key, value) => { await storeRef.current?.set(key, value); },
  });
  const {
    chatConversations, chatConversationsRef, clearScopedSetting,
    composerHarnessBySession, composerHarnessBySessionRef, persistComposerHarnessRecords,
    scopedSettings, scopedSettingsRef, setChatConversations,
    setScopedSettings, updateScopedSetting,
  } = composerWorkspace;
  const editorSession = useEditorSessionController();
  const {
    activeFilesByWorkspaceRef, captureCurrentEditorBuffer, captureCurrentEditorViewState,
    captureSessionSnapshot: captureEditorSessionSnapshot,
    closeActiveEditorTabRef, editorBuffersRef, editorBytes, editorCursor, editorError,
    editorLoading, editorRecoveryError, editorSaving,
    editorTabs, editorText, editorViewStatesRef, fileOpError,
    openEditorSearchRef, resetEditor, restoredActiveFileWorkspaceRef,
    restoreSessionSnapshot: restoreEditorSessionSnapshot, saveEditorFileRef,
    savedEditorText, selectedFile, selectedFileRef,
    sessionEditorSnapshotsRef, setEditorBufferRevision,
    setEditorTabs, setEditorText, setFileOpError,
    setSelectedFile,
  } = editorSession;
  const terminal = useTerminalPaneController<Snapshot>({
    activeSessionForProject: (root) => activeSessionLookupRef.current(root),
    activeWorkspace: workspacePathRef,
    persistPaneLayout: (root, sessionId, panes) => {
      persistPaneLayoutRef.current(root, sessionId, panes);
    },
  });
  const {
    activePaneId: activeTerminalPaneId,
    activePaneIdRef: activeTerminalPaneIdRef, activeProjectStatus, activeSessionStatus, contextForPaneId: paneContextForPaneId,
    paneLabelsRef: paneLabelsBySessionRef,
    paneLayoutsRef: paneLayoutsBySessionRef,
    panes: terminalPanes, panesForSession: terminalPanesForSession,
    panesRef: terminalPanesRef, projectStatusForRoot,
    requestPaintRef: requestTerminalPaintRef, setFocusedPane: setFocusedTerminalPane,
    setManagedPanes: setManagedTerminalPanes, setPaneLabels: setPaneLabelsBySession,
    setSessionPanes: setSessionTerminalPanes,
    snapshotsRef: terminalSnapshotsRef, statusForPanes: terminalPaneProjectStatus,
  } = terminal;
  const {
    error: fileTreeError, loading: fileTreeLoading, refresh: refreshFileTree,
    refreshKey: treeRefreshNonce, setError: setFileTreeError, setTree: setFileTree,
    tree: fileTree, truncated: fileTreeTruncated,
  } = useWorkspaceTree({
    onClearWorkspace: () => resetEditor(),
    onRootResolved: (root) => { workspacePathRef.current = root; },
    workspacePath,
  });
  const persistence = useWorkspacePersistenceController({
    activeFiles: activeFilesByWorkspaceRef,
    getPanes: (root, sessionId) => terminalPanesForSession(root, sessionId),
    paneLabels: paneLabelsBySessionRef,
    paneLayouts: paneLayoutsBySessionRef,
    sessionSnapshots: sessionEditorSnapshotsRef,
    setPaneLabels: setPaneLabelsBySession,
    store: storeRef,
  });
  const {
    activeSessionByProject, activeSessionByProjectRef, activeSessionForProject,
    clearActiveFile: clearPersistedActiveFile, expandedSessionProjects, openProjects,
    openProjectsRef, persistActiveFile, persistOpenProjects,
    persistPaneLabel, persistPaneLayout: persistPaneLayoutForSession,
    persistProjectSessions, persistSessionSnapshots: persistSessionEditorSnapshots,
    projectSessions, projectSessionsRef, removeSessionRestore: removePersistedSessionRestore,
    savedPaneLabel: savedPaneLabelForSlot, sessionKey: sessionSnapshotKey,
    setExpandedSessionProjects, setShowArchivedSessions,
    showArchivedSessions, updateActiveSessionStatus, updateOpenProjectStatus,
    updateSessionStatus,
  } = persistence;
  activeSessionLookupRef.current = activeSessionForProject;
  persistPaneLayoutRef.current = persistPaneLayoutForSession;
  const [agentHookStatus, setAgentHookStatus] = useState<AgentHookStatus | null>(null);
  const profiles = useLaunchProfileController({
    getCurrentRoot: () => workspacePathRef.current,
    getCurrentSessionId: () => activeSessionForProject(workspacePathRef.current),
    randomId: () => crypto.randomUUID(),
    saveStore: async () => { await storeRef.current?.save(); },
    scopedSettings: scopedSettingsRef,
    setScopedSettings,
    setStoreValue: async (key, value) => { await storeRef.current?.set(key, value); },
  });
  const contextMenuHost = useContextMenuHost({
    buildFileNodeItems: (node) => fileNodeContextMenuItemsRef.current(node),
    onActionError: (item, error) => setLaunchError(`${item.label} failed: ${String(error)}`),
  });
  const commandPalette = useCommandPalette(() => contextMenuHost.setContextMenu(null));
  const [commandPaletteSources, setCommandPaletteSources] = useState({ ...DEFAULT_COMMAND_PALETTE_SOURCES });
  const [orchestrationOpen, setOrchestrationOpen] = useState(false);
  const [orchestrationLaunching, setOrchestrationLaunching] = useState(false);
  const [orchestrationError, setOrchestrationError] = useState<string | null>(null);
  const [composerNotice, setComposerNotice] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const chrome = useAppChromeState();
  const {
    actionNotice, appTheme, crashNotice, notificationsEnabled, notificationsEnabledRef,
    setActionNotice, setAppTheme, setCrashNotice, setNotificationsEnabled,
  } = chrome;
  const {
    agentConnectionsRefreshing, agentConnectionsStatus, refreshAgentConnections,
    repoLocation, sourceControlStatus,
  } = useSettingsRuntimeStatus(settingsOpen, workspacePath);
  const [aiConnectionSettings, setAiConnectionSettings] = useState<AiConnectionSettings>(DEFAULT_AI_CONNECTION_SETTINGS);
  const {
    deleteSecret: deleteConnectionSecret, refreshSecretPresence: refreshConnectionSecretPresence,
    saveSecret: saveConnectionSecret, secretPresence: connectionSecretPresence,
    setSecretPresence: setConnectionSecretPresence,
    setStatuses: setMcpOAuthStatuses, statuses: mcpOAuthStatuses,
  } = useMcpOAuthStatus();
  const [worktrees, setWorktrees] = useState<WorktreeRecord[]>([]);
  const [backgroundExits, setBackgroundExits] = useState<BackgroundExit[]>([]);
  const {
    openTranscriptId, paneTranscripts, persistPaneTranscript, setOpenTranscriptId,
    setPaneTranscripts, setTranscriptsOpen, transcriptsOpen,
  } = usePaneTranscriptController({
    saveStore: () => { void storeRef.current?.save(); },
    setStoreValue: (key, value) => { void storeRef.current?.set(key, value); },
  });
  const [keybindingOverrides, setKeybindingOverrides] = useState<KeybindingOverrides>({});
  const [composerSending, setComposerSending] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const {
    agentSurfaceMode,
    appShellStyle,
    beginSideDrawerResize,
    beginUtilityTrayResize,
    beginWorkbenchResize,
    nudgeSideDrawerResize,
    nudgeWorkbenchResize,
    resetInterface,
    renderedWorkbenchLayout,
    setSideDrawerCollapsed,
    setAgentSurfaceMode,
    setSideDrawerMode,
    setToolTrayMode,
    setUtilityTrayMode,
    setWorkbenchLayout,
    sideDrawerMode,
    sideDrawerCollapsed,
    toolTrayMode,
    utilityTrayHeight,
    utilityTrayMode,
    workbenchLayout,
    workbenchRef,
    workbenchSizing,
    workbenchStyle,
  } = useShellLayout(() => setSettingsOpen(false));
  const railHeight = useFilesRailHeight(sideDrawerMode === "files", railBodyRef);
  const [drawerSearchQuery, setDrawerSearchQuery] = useState("");
  const {
    error: chatSearchError, loading: chatSearchLoading, refresh: refreshChatSearch,
    results: chatSearchResults, setError: setChatSearchError,
  } = useChatSearch({ open: commandPalette.open, query: commandPalette.query });
  const [focusedChatMessageId, setFocusedChatMessageId] = useState<string | null>(null);
  const {
    error: gitStatusError, loading: gitStatusLoading, refresh: refreshGitStatus,
    root: gitStatusRoot, setRoot: setGitStatusRoot, setStatus: setGitStatus, status: gitStatus,
  } = useGitStatus({
    active: sideDrawerMode === "files" || sideDrawerMode === "git", refreshKey: treeRefreshNonce,
    resolveRoot: () => workspacePathRef.current ?? workspacePath, workspacePath,
  });
  const {
    close: closeDiffReview, copy: copyShownDiff, error: diffReviewError,
    loading: diffReviewLoading, open: openGitDiff, review: diffReview,
    runFileAction: runGitFileAction,
  } = useGitDiffReview({
    gateAction: (action) => gateAppAction(action),
    getRoot: () => workspacePathRef.current ?? workspacePath,
    hasUnsaved: (path) => editorSurface.editorHasUnsavedBufferForPath(path),
    onRefreshFiles: refreshFileTree,
    onStatus: (status, root) => { setGitStatus(status); setGitStatusRoot(root); },
  });
  const {
    activeFileMissing, diffBreadcrumbs, dirtyTabPathSet, dirtyTabPaths,
    editorBreadcrumbs, editorDirty, editorLanguage, editorSaveConflict,
    diffReviewCanDiscard, diffReviewCanOpenFile, diffReviewCanStage, diffReviewCanUnstage,
    searchableFiles, visibleFileTree,
  } = deriveEditorWorkspaceState({
    diffReview, editorBuffers: editorBuffersRef.current, editorError, editorTabs,
    editorText, fileTree, gitStatus, gitStatusRoot, savedEditorText,
    selectedFile, workspacePath,
  });
  const drawerSearchResults = useMemo(() => {
    return filterWorkspaceFiles(searchableFiles, drawerSearchQuery, drawerSearchQuery.trim() ? 80 : 40);
  }, [drawerSearchQuery, searchableFiles]);
  const chatSearchViewResults = useMemo<ChatSearchViewResult[]>(
    () => mergeChatDiscoveryResults(
      chatSearchResults,
      projectSessions,
      chatConversations,
      commandPalette.query,
      false,
    ),
    [chatConversations, chatSearchResults, commandPalette.query, projectSessions],
  );
  const quickOpen = useQuickOpen(searchableFiles, () => contextMenuHost.setContextMenu(null));
  const {
    activeAgentProfileSetting, activeApprovalSetting, activeBrowserSetting,
    activeChatConversation, activeComposerHarness, activeComposerHarnessKey,
    activeComposerProvider, activeComposerProviderLabel, activeSessionId,
  } = deriveActiveChatState({
    activeSessionByProject, chatConversations, composerHarnessBySession,
    launchProfileId: profiles.launchProfile.id, projectSessions,
    resolveLaunchProfile: profiles.resolveProfile,
    scopedSettings, workspacePath,
  });
  const agentApprovalMode: AgentApprovalMode = activeComposerHarness.approvalMode;
  const {
    activeChatActivityHandle, agentActivityEvents,
    agentActivityFilter, gateAppAction, recordAgentActivity, setAgentActivityEvents,
  } = useAgentActivityController({
    activeAgentDescriptor: activeAgentSessionDescriptorRef,
    activeProviderId: activeComposerProvider,
    activeProviderLabel: activeComposerProviderLabel,
    approvalMode: agentApprovalMode,
    confirmAction: (_action, message) => confirmDialog(message),
    getChatApprovalMode: (root, sessionId) =>
      composerHarnessBySessionRef.current[`${root}\n${sessionId}`]?.approvalMode ?? "ask",
    getRoot: () => workspacePathRef.current,
    getSessionId: (root) => activeProjectSessionId(
      activeSessionByProjectRef.current, projectSessionsRef.current, root,
    ),
    persistEvents: (events) => {
      void storeRef.current?.set("agentActivityEvents", events);
      void storeRef.current?.save();
    },
  });
  const browser = useBrowserPreviewController({
    activeRoot: workspacePath,
    activeSessionId,
    ensureVisible: () => {
      if (workbenchLayout === "hidden") setWorkbenchLayout("right");
      if (toolTrayMode === "editor") setToolTrayMode("browser");
    },
    gateAction: async (action) => (await gateAppAction(action)).decision,
    getCurrentRoot: () => workspacePathRef.current,
    getCurrentSessionId: () => activeProjectSessionId(
      activeSessionByProjectRef.current, projectSessionsRef.current, workspacePathRef.current,
    ),
    saveStore: async () => { await storeRef.current?.save(); },
    scopedSettings: scopedSettingsRef,
    setScopedSettings,
    setStoreValue: async (key, value) => { await storeRef.current?.set(key, value); },
  });
  const {
    draft: composerDraft, flush: flushActiveComposerLocalState,
    history: composerHistory, historyIndex: composerHistoryIndex,
    setHistoryIndex: setComposerHistoryIndex, setLocalState: setComposerLocalState,
    updateHarness: updateActiveComposerHarness,
  } = useComposerLocalState({
    activeHarness: activeComposerHarness, activeKey: activeComposerHarnessKey,
    getDefaultProfileId: () => profiles.launchProfileRef.current.id,
    getRecords: () => composerHarnessBySessionRef.current,
    persistRecords: (records) => persistComposerHarnessRecords(records),
  });
  const {
    attachLocalFiles: attachLocalFileToComposer,
    attachPreview: attachPreviewToComposer,
    attachWorkspaceFile: attachWorkspaceFileToComposer,
    pasteImage: pasteComposerImage,
    removeAttachment: removeComposerAttachmentById,
    reviewContext: reviewComposerContext,
  } = useComposerAttachments({
    active: agentSurfaceMode === "chat",
    activeHarness: activeComposerHarness,
    activeKey: activeComposerHarnessKey,
    draft: composerDraft,
    gateAction: (action) => gateAppAction(action),
    getBrowserUrl: () => browser.urlRef.current,
    getRoot: () => workspacePathRef.current,
    logEvent: (label, detail) => logComposerHarnessEvent(label, detail),
    setError: setComposerError,
    setNotice: setComposerNotice,
    updateHarness: updateActiveComposerHarness,
  });
  const attachSelectedFileToComposer = async () => attachWorkspaceFileToComposer(selectedFile);
  const composerMentionQuery = composerMentionQueryFrom(composerDraft);
  const composerMentionResults = useMemo(
    () => composerMentionQuery == null ? [] : filterWorkspaceFiles(searchableFiles, composerMentionQuery, 8),
    [composerMentionQuery, searchableFiles],
  );
  const {
    activeAgentSessionDescriptor, activeTerminalPane,
    selectedAgentActivityLog,
  } = deriveActiveAgentSessionState({
    activeSessionId, activeTerminalPaneId, agentActivityEvents, agentActivityFilter,
    agentApprovalMode, terminalPanes, workspacePath,
  });
  const terminalFind = useTerminalFind(activeTerminalPane != null);
  useSyncRef(activeAgentSessionDescriptorRef, activeAgentSessionDescriptor);
  const activeTerminalProfile = activeTerminalPane?.profile ?? profiles.terminalProfile;


  useEffect(() => {
    if (!selectedFile) return;
    treeRef.current?.scrollTo(selectedFile.id, "smart");
  }, [selectedFile, visibleFileTree]);

  useEffect(() => {
    if (!selectedFile || fileTree.length === 0) return;
    const syncedFile = reconcileActiveFileNode(fileTree, selectedFile);
    if (syncedFile !== selectedFile) setSelectedFile(syncedFile);
  }, [fileTree, selectedFile]);

  const composerHarnessSessionKey = (root: string, sessionId: string) => `${root}\n${sessionId}`;

  const chatConversationActions = createChatConversationActions({
    createCheckpoint: createWorkspaceCheckpoint,
    getActiveChatId: () => activeComposerHarnessKey,
    getConversations: () => chatConversationsRef.current,
    getForkContext: () => {
      const projectPath = workspacePathRef.current;
      const sourceSessionId = activeProjectSessionId(
        activeSessionByProjectRef.current, projectSessionsRef.current, projectPath,
      );
      return {
        browserUrl: browser.urlRef.current,
        projectPath,
        sessions: projectPath ? projectSessionsRef.current[projectPath] ?? [] : [],
        sessionsByProject: projectSessionsRef.current,
        sourceSessionId,
      };
    },
    now: Date.now,
    persistBrowserUrl: browser.persistUrl,
    persistSessions: (sessions) => persistProjectSessions(sessions, activeSessionByProjectRef.current),
    refreshSearch: refreshChatSearch,
    reportPersistenceError: (message) => {
      setLaunchError(message);
      void invoke("log_health_event", { message }).catch(() => {});
    },
    saveConversation: saveDurableChatConversation,
    setConversations: setChatConversations,
    setError: setLaunchError,
    setNotice: setActionNotice,
    switchSession: (root, sessionId) => projectSessionNavigationActions.switchSession(root, sessionId),
  });

  useChatRunEvents((envelope) => {
    chatConversationActions.updateConversation(envelope.chatId, (conversation) =>
      applyChatRunEnvelope(conversation, envelope));
  });

  const logComposerHarnessEvent = createComposerHarnessEventLog({
    getDescriptor: () => activeAgentSessionDescriptor,
    recordActivity: recordAgentActivity,
  });


  const detectLocalDevServerFromSnapshot = createDevServerDetection({
    approvalMode: (root, sessionId) =>
      composerHarnessBySessionRef.current[composerHarnessSessionKey(root, sessionId)]?.approvalMode ?? "ask",
    contextForPane: paneContextForPaneId,
    fallbackPanes: () => terminalPanesRef.current,
    fallbackRoot: () => workspacePathRef.current,
    fallbackSessionId: activeSessionForProject,
    getPrevious: () => browser.detectedServerRef.current,
    now: Date.now,
    recordActivity: recordAgentActivity,
    setDetectedServer: browser.setDetectedServer,
  });

  const captureCurrentSessionSnapshot = createSessionSnapshotCapture({
    capture: captureEditorSessionSnapshot,
    getRoot: () => workspacePathRef.current,
    makeKey: sessionSnapshotKey,
    persistPaneLayout: persistPaneLayoutForSession,
    persistSnapshots: persistSessionEditorSnapshots,
    resolveSessionId: (root) =>
      activeProjectSessionId(activeSessionByProjectRef.current, projectSessionsRef.current, root),
  });

  const restoreSessionEditorSnapshot = createSessionSnapshotRestore({
    makeKey: sessionSnapshotKey,
    openFile: (...args: Parameters<typeof openEditorFileDirect>) => openEditorFileDirect(...args),
    restore: restoreEditorSessionSnapshot,
  });

  const workspaceOpenActions = createWorkspaceOpenSurface({
    actions: {
      captureCurrentSession: captureCurrentSessionSnapshot,
      clearBackgroundExits: (path) => {
        setBackgroundExits((exits) => clearBackgroundExitsForProject(exits, path));
      },
      dirtyTabPaths, editorDirty, editorTabs,
      flushComposer: flushActiveComposerLocalState,
      getDefaultProfile: () => profiles.launchProfileRef.current,
      getPreviousActivePaneId: () => activeTerminalPaneIdRef.current,
      getPreviousPanes: () => terminalPanesRef.current,
      getPreviousRoot: () => workspacePathRef.current,
      getSelectedFilePath: () => selectedFileRef.current?.path ?? null,
      getStore: () => storeRef.current,
      openEditorFile: (file) => openEditorFileDirect(file),
      setFocusedPane: setFocusedTerminalPane,
    },
    connectionSettings: aiConnectionSettingsRef,
    lifecycle: {
      clearCurrentWorkspace: (path) => {
        if (workspacePathRef.current !== path) return;
        setManagedTerminalPanes([]); setFocusedTerminalPane(null); setWorkspacePath(null);
        setFileTree([]); resetEditor();
      },
      deleteProjectChats: deleteDurableProjectChats,
      now: Date.now, persistPaneLayout: persistPaneLayoutForSession,
      projectStatus: projectStatusForRoot,
      records: workspaceOpenRecordsFromHooks({
        browser, composer: composerWorkspace, editorSession, persistence, terminal,
      }),
      restoreBrowser: browser.restoreScopedUrl, restoreEditor: restoreSessionEditorSnapshot,
      sessionStatus: terminalPaneProjectStatus, setFocusedPane: setFocusedTerminalPane,
      setLaunchError, setManagedPanes: setManagedTerminalPanes,
    },
    target: workspaceOpenTargetFromHook(terminal, {
      activeSessions: activeSessionByProjectRef,
      getSurfaceMode: () => agentSurfaceMode, latest, now: Date.now,
      resetEditor,
      resolveProfile: profiles.resolveProfile,
      restoredActiveFileWorkspace: restoredActiveFileWorkspaceRef,
      savedLabelForSlot: savedPaneLabelForSlot,
      scheduleResize: () => setTimeout(sendTerminalResize, 0), sessions: projectSessionsRef,
      setLaunchError,
      setWorkspacePath, workspacePath: workspacePathRef,
    }),
  });

  const requestOpenWorkspace = (path: string) => workspaceOpenActions.requestOpenWorkspace(
    path, () => requestPendingNavigation({ kind: "workspace", path }),
  );

  const projectCloseController = createProjectCloseController(projectCloseFromHook(terminal, {
    clearActiveWorkspace: () => {
      setWorkspacePath(null); setManagedTerminalPanes([]); setFocusedTerminalPane(null);
      latest.current = null; setFileTree([]); resetEditor();
    },
    closePane: (paneId) => invoke("close_pane", { paneId }),
    confirmClose: (message) => confirmDialog(message), conversations: chatConversationsRef,
    deleteStoredFolder: async () => { await storeRef.current?.delete("folder"); },
    dirtyTabCount: dirtyTabPaths.length,
    hasSelectedFile: () => selectedFileRef.current != null,
    openProjects: openProjectsRef, openWorkspace: workspaceOpenActions.openWorkspaceDirect,
    persistOpenProjects,
    saveStore: async () => { await storeRef.current?.save(); },
    setActionNotice, setLaunchError,
    stopChatRun: (runId) => invoke("stop_chat_run", { runId }),
    stopWorkspaceWatcher: () => invoke("stop_workspace_watcher"),
    workspacePath: workspacePathRef,
  }));
  const requestCloseProject = (project: OpenProject) => projectCloseController.requestCloseProject(
    project, () => requestPendingNavigation({ kind: "close-project", projectPath: project.path }),
  );

  const projectSessionNavigationActions = createProjectSessionNavigationActions({
    captureCurrentSession: captureCurrentSessionSnapshot,
    defaultBrowserUrl: DEFAULT_BROWSER_PREVIEW_URL,
    flushComposer: flushActiveComposerLocalState,
    getPreviousStatus: activeSessionStatus,
    getState: () => ({
      activeSessions: activeSessionByProjectRef.current,
      browserUrl: browser.urlRef.current,
      browserUrlsByProject: browser.projectRecordsRef.current,
      currentRoot: workspacePathRef.current,
      sessions: projectSessionsRef.current,
    }),
    getTargetStatus: (projectPath, sessionId) =>
      terminalPaneProjectStatus(terminalPanesForSession(projectPath, sessionId)),
    now: Date.now,
    openProject: async (projectPath, sameProject) => {
      if (sameProject) {
        await workspaceOpenActions.openWorkspaceDirect(
          projectPath, profiles.launchProfileRef.current, { captureCurrentSession: false },
        );
      } else {
        await requestOpenWorkspace(projectPath);
      }
    },
    persistBrowserUrl: browser.persistUrl,
    persistSessions: persistProjectSessions,
    promptTitle: (title) => window.prompt("Chat name", title),
    setFocusedMessage: setFocusedChatMessageId,
  });

  const openChatSearchResult = createChatSearchNavigation({
    focusMessage: setFocusedChatMessageId,
    getSessions: () => projectSessionsRef.current,
    setError: setChatSearchError,
    showArchived: () => setShowArchivedSessions(true),
    showProjectsDrawer: () => setSideDrawerMode("projects"),
    switchSession: projectSessionNavigationActions.switchSession,
  });


  const projectSessionDeletionController = createProjectSessionDeletionController(projectSessionDeletionFromHook(terminal, {
    activeSessionId,
    activeSessions: activeSessionByProjectRef, browserSessions: browser.sessionRecordsRef,
    closePane: (paneId) => invoke("close_pane", { paneId }),
    composerHarness: composerHarnessBySessionRef, confirmDelete: confirmDialog,
    conversations: chatConversationsRef, deleteHistory: deleteDurableChatConversation,
    persistBrowserSessions: async (records) => {
      await storeRef.current?.set("browserPreviewBySession", records);
    },
    persistComposerHarness: persistComposerHarnessRecords, persistSessions: persistProjectSessions,
    removePersistedRestore: removePersistedSessionRestore,
    reopenActiveWorkspace: (projectPath) => workspaceOpenActions.openWorkspaceDirect(
      projectPath, profiles.launchProfileRef.current, { captureCurrentSession: false },
    ),
    sessions: projectSessionsRef, setBrowserSessions: browser.setSessionRecords,
    setConversations: setChatConversations, setError: setLaunchError,
    workspacePath: workspacePathRef,
  }));

  const paneActivityLog = createPaneActivityLog({
    approvalMode: () => agentApprovalMode,
    recordActivity: recordAgentActivity,
  });

  const finalizeCreatedTerminalPane = createTerminalPaneFinalize({
    getProjectStatus: projectStatusForRoot,
    persistProfile: async (profile) => {
      await storeRef.current?.set("terminalLaunchProfile", profile);
      await storeRef.current?.save();
    },
    scheduleResize: () => setTimeout(sendTerminalResize, 0),
    setError: setLaunchError,
    setTerminalProfile: profiles.setTerminalProfile,
    statusForPanes: terminalPaneProjectStatus,
    updateProjectStatus: updateOpenProjectStatus,
    updateSessionStatus: updateActiveSessionStatus,
  });

  const pickWorkspace = createWorkspacePicker({
    createTerminalPane: (profile) => terminalSurface.createTerminalPane(profile),
    defaultProfile: defaultTerminalLaunchProfile,
    openDirectoryDialog: () => open({ directory: true }),
    requestOpenWorkspace: (path) => requestOpenWorkspace(path),
  });

  const composerSurface = createComposerSurface({
    chatIdForSession: composerHarnessSessionKey,
    clearTerminal: () => terminalSurface.clearActiveTerminal(),
    gateAction: (action) => gateAppAction(action, activeAgentSessionHandle),
    getActiveConversation: () => activeChatConversation,
    getActiveProvider: () => activeComposerProvider,
    getActiveSessionId: () => activeSessionId,
    getActiveSessions: () => activeSessionByProjectRef.current,
    getChatId: () => activeComposerHarnessKey,
    getComposerDraft: () => composerDraft,
    getComposerHistory: () => composerHistory,
    getComposerSending: () => composerSending,
    getConversations: () => chatConversationsRef.current,
    getHarness: () => activeComposerHarness,
    getHarnessRecords: () => composerHarnessBySessionRef.current,
    getSelectedFilePath: () => selectedFile?.path ?? null,
    getSessions: () => projectSessionsRef.current,
    getSettings: () => aiConnectionSettingsRef.current,
    getTerminalLabel: () => activeTerminalPaneLabel,
    getWorkspacePath: () => workspacePathRef.current,
    now: Date.now,
    openSearch: () => editorSurface.openEditorSearch(),
    orchestrationGateAction: (action) => gateAppAction(action),
    persistHarnessRecords: (records) => persistComposerHarnessRecords(records),
    persistSessions: (sessions, activeSessions) => persistProjectSessions(sessions, activeSessions),
    pickWorkspace: () => pickWorkspace(),
    recordActivity: (event) => recordAgentActivity(activeAgentSessionHandle, event),
    removeWorktree: (input) => invoke("remove_project_worktree", input),
    replaceConversations: setChatConversations,
    resolveProfileLabel: (id) => profiles.resolveProfile(id).label,
    saveFile: () => saveEditorFile(),
    setActionNotice,
    setComposerError,
    setComposerHistoryIndex,
    setComposerLocalState,
    setComposerNotice,
    setComposerSending,
    setOrchestrationError,
    setOrchestrationLaunching,
    setOrchestrationOpen,
    stopRun: (runId) => invoke("stop_chat_run", { runId }),
    updateConversation: chatConversationActions.updateConversation,
    updateHarness: (update) => updateActiveComposerHarness(update),
    updateSessionMetadata: (projectPath, sessionId, orchestration) =>
      projectSessionMetadataActions.updateSessionMetadata(projectPath, sessionId, { orchestration }),
  });

  const chatRunControls = createChatRunControls({
    getActiveRunId: () => activeChatConversation.activeRunId,
    respondApproval: ({ decision, requestId, runId }) =>
      invoke("respond_chat_approval", { runId, requestId, decision }),
    setError: setComposerError,
    stopRun: (runId) => invoke("stop_chat_run", { runId }),
  });

  const composerHistoryNavigation = createComposerHistoryNavigation({
    getChatId: () => activeComposerHarnessKey,
    getHistory: () => composerHistory,
    getHistoryIndex: () => composerHistoryIndex,
    setHistoryIndex: setComposerHistoryIndex,
    setLocalState: setComposerLocalState,
  });



  const composerSettingsActions = createComposerSettingsActions({
    getRuntimeState: () => ({
      activeRunId: activeChatConversation.activeRunId,
      chatId: activeComposerHarnessKey,
      provider: activeComposerProvider,
    }),
    labelProvider: chatProviderLabel,
    labelReasoning: composerReasoningLabel,
    logEvent: logComposerHarnessEvent,
    now: Date.now,
    updateConversation: chatConversationActions.updateConversation,
    updateHarness: updateActiveComposerHarness,
    updateScopedSetting: (key, value) => key === "approvalMode"
      ? updateScopedSetting("chat", "approvalMode", value as AgentApprovalMode)
      : updateScopedSetting("chat", "agentProfileId", value as ChatProvider),
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
    getSessionId: activeSessionForProject,
    activeAgentDescriptor: () => activeAgentSessionDescriptor,
    activeAgentHandle: () => activeAgentSessionHandle,
    activePane: () => activeTerminalPane,
    approvalMode: () => agentApprovalMode,
    copyText: writeText,
    defaultProfile: () => profiles.terminalProfileRef.current,
    finalizePane: finalizeCreatedTerminalPane,
    gateAction: async (action, handle) => (await gateAppAction(action, handle)).decision,
    getWorkspacePath: () => workspacePathRef.current,
    getWorkspacePathOrState: () => workspacePathRef.current ?? workspacePath,
    getWorktrees: () => worktrees,
    latest, now: Date.now,
    promptWorktreeLabel: () => window.prompt("Worktree label (used for the branch name)"),
    readClipboard: readText,
    recordActivity: recordAgentActivity,
    recordCreated: paneActivityLog.recordCreated,
    recordCreatedWorktree: paneActivityLog.recordCreatedWorktree,
    requestPaint: () => requestTerminalPaintRef.current(), savedLabel: savedPaneLabelForSlot,
    scheduleResize: () => setTimeout(sendTerminalResize, 0), selection,
    selectionText: (snap, snapSelection) => selectionToText(snap.cells, snap.cols, snapSelection),
    setChanging: profiles.setChanging,
    setComposerError, setLaunchError,
    updateProjectStatus: updateOpenProjectStatus,
    updateSessionStatus: (root, status) => updateActiveSessionStatus(root, status),
  }));

  const utilityTrayControls = createUtilityTrayControls({
    closeSettings: () => setSettingsOpen(false),
    createTerminalPane: (profile) => terminalSurface.createTerminalPane(profile),
    defaultProfile: defaultTerminalLaunchProfile,
    getRoot: () => workspacePathRef.current ?? workspacePath,
    getSessionId: activeSessionForProject,
    getSurfaceMode: () => agentSurfaceMode,
    getTrayMode: () => utilityTrayMode,
    hasTerminalPanes: (root, sessionId) => terminalPanesForSession(root, sessionId).length > 0,
    pickWorkspace: (pickOptions) => pickWorkspace(pickOptions),
    resolveProfile: profiles.resolveProfile,
    setSurfaceMode: setAgentSurfaceMode,
    setTrayMode: setUtilityTrayMode,
  });

  const activeAgentSessionHandle: AgentSessionHandle | null = activeAgentSessionDescriptor
    ? createActiveAgentSessionHandle({
        activePaneId: () => activeTerminalPaneIdRef.current,
        closePane: terminalSurface.closeTerminalPane,
        descriptor: activeAgentSessionDescriptor,
        focusPane: terminalSurface.focusTerminalPane,
        recordClosed: (descriptor) => recordAgentActivity(descriptor, {
          kind: "process", label: "Closed pane", detail: descriptor.label, status: "exited",
        }),
        sendEnter: () => invoke("send_key", {
          code: "Enter", text: null, shift: false, alt: false, ctrl: false, sup: false,
        }),
        sendInterrupt: () => invoke("send_key", {
          code: "KeyC", text: null, shift: false, alt: false, ctrl: true, sup: false,
        }),
        sendText: (text) => invoke("paste", { text }),
        snapshot: (paneId) => terminalSnapshotsRef.current[paneId] ??
          (activeTerminalPaneIdRef.current === paneId ? latest.current : null),
      })
    : null;

  const renameTerminalPane = createTerminalPaneRename({
    getPanes: terminalPanesForSession,
    getRoot: () => workspacePathRef.current,
    getSessionId: activeSessionForProject,
    persistLabel: persistPaneLabel,
    promptLabel: (current) => window.prompt("Pane name or task label", current),
    setSessionPanes: setSessionTerminalPanes,
  });

  const sendTerminalResize = createTerminalResize({
    getCellMetrics: () => metrics.current,
    getHostRect: () => terminalHostRef.current?.getBoundingClientRect(),
    getWindowSize: () => ({ height: window.innerHeight, width: window.innerWidth }),
    resize: (cols, rows) => invoke("resize_pty", { cols, rows }),
  });

  const projectRailStatus = (project: OpenProject): ProjectRailStatus =>
    projectRailStatusFromConversations(chatConversations, project.path);

  const projectSessionsFor = (projectPath: string) => projectSessions[projectPath] ?? [];

  const projectSessionStatus = (projectPath: string, session: ProjectSession): ProjectRailStatus =>
    projectSessionStatusFromConversations(chatConversations, projectPath, session.id);

  const visibleOpenProjects = visibleProjectsFrom(openProjects, workspacePath, activeProjectStatus);

  const {
    openDirect: openEditorFileDirect,
    requestOpen: requestOpenEditorFile,
    save: saveEditorFileWithForce,
  } = wireEditorFileWorkflow(editorSession, {
    closeDiffReview: () => closeDiffReview(),
    gateAction: (action) => gateAppAction(action),
    getDirty: () => editorDirty,
    getRoot: () => workspacePathRef.current ?? workspacePath,
    persistActiveFile,
    recordEdit: (file) => recordAgentActivity(activeAgentSessionDescriptor, {
      kind: "file", label: "Edited a file", detail: file.name, status: "complete",
    }),
  });
  const saveEditorFile = (options: SaveEditorFileOptions = {}) => saveEditorFileWithForce(options.force ?? false);

  const editorSurface = createEditorSurfaceActions<
    FileTreeNode, EditorView, GitStatusFile, ReturnType<typeof EditorView.scrollIntoView>
  >(
    editorSession,
    {
      copyText: writeText,
      getDiffReviewPath: () => diffReview?.absolutePath ?? null,
      getGitFiles: () => gitStatus?.files ?? [],
      getRoot: () => workspacePathRef.current,
      makeFileNode: (path) => fileTreeNodeFromPath(path, "file"),
      notify: setActionNotice,
      openExternal: openPath,
      openFileDirect: (file, fileOptions) => openEditorFileDirect(file, fileOptions),
      openGitDiff: async (file) => Boolean(await openGitDiff(file)),
      openSearchPanel,
      requestOpenFile: async (file, fileOptions) => Boolean(await requestOpenEditorFile(file, fileOptions)),
      revealEditorTools: () => {
        if (workbenchLayout === "hidden") setWorkbenchLayout("right");
        setToolTrayMode("editor");
      },
      revealInDir: revealItemInDir,
      saveFile: (saveOptions) => saveEditorFile(saveOptions),
      schedule: (callback, delayMs) => { window.setTimeout(callback, delayMs); },
      scheduleFrame: (callback) => requestAnimationFrame(callback),
      scrollEffect: (position) => EditorView.scrollIntoView(position, { y: "center" }),
    },
  );
  const handleEditorUpdate = (update: ViewUpdate) => editorSurface.handleEditorUpdate(update);

  const {
    createFile: createFileInRail,
    createFolder: createFolderInRail,
    delete: deleteRailNode,
    duplicate: duplicateRailNode,
    rename: renameRailNode,
    reveal: revealRailNode,
  } = wireWorkspaceFileActions(editorSession, {
    clearPersistedActiveFile,
    getDirty: () => editorDirty,
    getPersistRoot: () => workspacePathRef.current,
    getRoot: () => workspacePathRef.current ?? workspacePath,
    getSelectedFile: () => selectedFile,
    openFileDirect: (file, fileOptions) => openEditorFileDirect(file, fileOptions),
    refresh: refreshFileTree,
    requestOpenFile: (file, fileOptions) => requestOpenEditorFile(file, fileOptions),
    setError: setFileOpError,
  });



  const workspaceContextMenuActions = {
    closeProject: requestCloseProject,
    copyPath: editorSurface.copyPath,
    deleteNode: deleteRailNode,
    duplicateNode: duplicateRailNode,
    newFile: createFileInRail,
    newFolder: createFolderInRail,
    openDiff: openGitDiff,
    openWorkspace: pickWorkspace,
    renameNode: renameRailNode,
    revealNode: revealRailNode,
    revealPath: revealItemInDir,
    runGitAction: runGitFileAction,
    shortcut: shortcutKeys,
    switchProject: (project: OpenProject) => requestOpenWorkspace(project.path),
  };
  const fileNodeContextMenuItems = (node: FileTreeNode) =>
    buildFileNodeContextMenuItems(node, workspaceContextMenuActions);
  fileNodeContextMenuItemsRef.current = fileNodeContextMenuItems;

  const workspaceContextMenuItems = () =>
    buildWorkspaceContextMenuItems(workspacePath, workspaceContextMenuActions);
  const projectRailContextMenuItems = (project: OpenProject) =>
    buildProjectRailContextMenuItems(project, workspacePath, workspaceContextMenuActions);

  const projectSessionMetadataActions = createProjectSessionMetadataActions({
    getActiveSessions: () => activeSessionByProjectRef.current,
    getSessions: () => projectSessionsRef.current,
    notify: setActionNotice,
    now: Date.now,
    persist: persistProjectSessions,
  });

  const {
    capture: captureSessionCheckpoint,
    restore: restoreSessionCheckpoint,
  } = wireSessionCheckpointActions(editorSession, {
    gateAction: (action) => gateAppAction(action),
    getDirtyTabPaths: () => dirtyTabPaths,
    getWorkspacePath: () => workspacePathRef.current,
    onMetadata: projectSessionMetadataActions.updateSessionMetadata,
    openFileDirect: (file) => openEditorFileDirect(file),
    refreshFiles: refreshFileTree,
    refreshGit: () => refreshGitStatus(),
    setError: setLaunchError,
    setNotice: setActionNotice,
  });

  const projectSessionContextMenuItems = (projectPath: string, session: ProjectSession): ContextMenuItem[] => {
    return buildProjectSessionContextMenuItems({
      ...deriveProjectSessionMenuState({
        activeSessionId,
        chatIdForSession: composerHarnessSessionKey,
        conversations: chatConversationsRef.current,
        projectPath,
        session,
        sessions: projectSessionsRef.current[projectPath] ?? [],
        workspacePath,
      }),
      session,
      actions: {
        archive: () => projectSessionMetadataActions.archiveSession(projectPath, session, !session.archived),
        captureCheckpoint: () => captureSessionCheckpoint(projectPath, session),
        copyName: async () => { await writeText(session.title); setActionNotice("Copied chat name"); },
        delete: () => projectSessionDeletionController.deleteProjectSession(projectPath, session),
        pin: () => projectSessionMetadataActions.pinSession(projectPath, session, !session.pinnedAt),
        removeChildWorktree: () => composerSurface.removeChildWorktree(projectPath, session),
        rename: () => projectSessionNavigationActions.renameSession(projectPath, session),
        restoreCheckpoint: () => session.checkpointId ? restoreSessionCheckpoint(projectPath, session, session.checkpointId) : undefined,
        restoreRecoveryCheckpoint: () => session.recoveryCheckpointId ? restoreSessionCheckpoint(projectPath, session, session.recoveryCheckpointId) : undefined,
        returnChildResult: () => composerSurface.returnChildResult(projectPath, session),
        stopChildRun: () => composerSurface.stopChildChatRun(projectPath, session),
        switchChat: () => projectSessionNavigationActions.switchSession(projectPath, session.id),
      },
    });
  };

  const editorContextMenuActions = {
    closeDiff: closeDiffReview,
    closeTab: (tab: FileTreeNode) => closeEditorTab(tab),
    copyDiff: copyShownDiff,
    copyPath: editorSurface.copyPath,
    find: editorSurface.openEditorSearch,
    openDiffFile: editorSurface.openDiffFile,
    openExternal: editorSurface.openExternally,
    openTab: (tab: FileTreeNode) => requestOpenEditorFile(tab, { focusEditor: true }),
    revealNode: revealRailNode,
    revealSelected: editorSurface.reveal,
    runGitAction: runGitFileAction,
    save: saveEditorFile,
    shortcut: shortcutKeys,
  };
  const editorTabContextMenuItems = (tab: FileTreeNode) =>
    buildEditorTabContextMenuItems(tab, editorContextMenuActions);
  const editorContextMenuItems = () => buildEditorContextMenuItems({
    editorDirty, editorLoading, editorSaving, selectedFile,
  }, editorContextMenuActions);
  const diffContextMenuItems = () => buildDiffContextMenuItems({
    canDiscard: diffReviewCanDiscard, canOpenFile: diffReviewCanOpenFile,
    canStage: diffReviewCanStage, canUnstage: diffReviewCanUnstage,
    loading: diffReviewLoading, review: diffReview,
  }, editorContextMenuActions);

  const saveActivePaneTranscript = createPaneTranscriptCapture({
    getActivePane: () => activeTerminalPane,
    getPanes: () => terminalPanes,
    getRoot: () => workspacePathRef.current,
    getSessionId: () => activeSessionId,
    getSnapshot: (paneId) => terminalSnapshotsRef.current[paneId],
    now: Date.now,
    persist: persistPaneTranscript,
  });

  const exportRenderPerfSnapshot = createRenderPerfExport({
    createFile: (root, parent, name) => invoke("create_workspace_file", { root, parent, name }),
    getPaneCount: (root) => terminalPanesForSession(root).length,
    getPerfState: () => renderPerfRef.current,
    getRoot: () => workspacePathRef.current,
    now: () => new Date().toISOString(),
    setError: setLaunchError,
    writeFile: (root, path, content, expectedModifiedMs) =>
      invoke("write_text_file", { root, path, content, expectedModifiedMs }),
  });

  const terminalContextMenuItems = (): ContextMenuItem[] => buildTerminalContextMenuItems({
    activePaneState: activeTerminalPane?.state ?? null,
    hasActiveHandle: Boolean(activeAgentSessionHandle),
    hasActivePane: Boolean(activeTerminalPane),
    hasSelection: Boolean(terminalSurface.terminalSelectedText()),
    hasWorkspace: Boolean(workspacePath),
    hasWorktreeForActivePane: Boolean(activeTerminalPane && worktreeForPaneId(worktrees, String(activeTerminalPane.id))),
    launchProfileChanging: profiles.changing,
    launchProfileLabel: profiles.terminalProfile.label,
    shortcuts: {
      clear: shortcutKeys("terminal.clear"),
      copy: shortcutKeys("terminal.copy-selection"),
      paste: shortcutKeys("terminal.paste"),
    },
    actions: {
      clear: () => terminalSurface.clearActiveTerminal(),
      closePane: () => activeAgentSessionHandle?.close(),
      copySelection: async () => { await terminalSurface.copyTerminalSelection(); setActionNotice("Copied terminal selection"); },
      copyTail: async () => { await terminalSurface.copyActivePaneTail(); setActionNotice("Copied last 20 lines"); },
      copyWorkingDirectory: () => workspacePath ? editorSurface.copyPath(workspacePath) : undefined,
      createPane: () => terminalSurface.createTerminalPane(profiles.terminalProfile),
      createWorktreePane: () => terminalSurface.createWorktreePane(profiles.terminalProfile),
      interrupt: () => terminalSurface.interruptActivePane(),
      killPane: () => activeTerminalPane ? terminalSurface.terminateTerminalPane(activeTerminalPane) : undefined,
      paste: () => terminalSurface.pasteIntoTerminal(),
      removeWorktree: () => activeTerminalPane ? terminalSurface.closeWorktreePane(activeTerminalPane.id) : undefined,
      renamePane: () => activeTerminalPane ? renameTerminalPane(activeTerminalPane) : undefined,
      restartPane: () => activeTerminalPane ? terminalSurface.restartTerminalPane(activeTerminalPane) : undefined,
      saveTranscript: saveActivePaneTranscript,
    },
  });

  const appMenuAssembly = createAppMenuAssembly({
    activityLog: () => selectedAgentActivityLog,
    browser: {
      back: () => browser.goHistory(-1), canGoBack: browser.canGoBack,
      canGoForward: browser.canGoForward, forward: () => browser.goHistory(1),
      openExternal: () => openUrl(browser.url), reload: browser.reload, url: browser.url,
    },
    composer: {
      activeRun: Boolean(activeChatConversation.activeRunId),
      attachCurrent: () => attachSelectedFileToComposer(),
      attachLocal: () => attachLocalFileToComposer(),
      attachPreview: () => attachPreviewToComposer(),
      canAttachCurrent: Boolean(selectedFile),
      canRunParallel: Boolean(workspacePath && activeSessionId && !activeChatConversation.activeRunId),
      clearDraft: () => setComposerLocalState(activeComposerHarnessKey, "", composerHistory),
      copyWorkspace: () => workspacePath ? editorSurface.copyPath(workspacePath) : undefined,
      draft: composerDraft, hasWorkspace: Boolean(workspacePath),
      parallel: () => { setOrchestrationError(null); setOrchestrationOpen(true); },
      send: () => composerSurface.submitComposerDraft(), sending: composerSending,
      shortcut: shortcutKeys("composer.send"), stop: () => chatRunControls.stopActiveChatRun(),
    },
    copyText: writeText,
    notify: setActionNotice,
    pane: {
      activePaneId: activeTerminalPaneId, changing: profiles.changing,
      close: (pane) => terminalSurface.closeTerminalPane(pane.id),
      copyCwd: (pane) => editorSurface.copyPath(pane.cwd),
      focus: (pane) => terminalSurface.focusTerminalPane(pane.id),
      hasWorktree: (pane) => Boolean(worktreeForPaneId(worktrees, String(pane.id))),
      kill: (pane) => terminalSurface.terminateTerminalPane(pane),
      removeWorktree: (pane) => terminalSurface.closeWorktreePane(pane.id),
      rename: (pane) => renameTerminalPane(pane),
      restart: (pane) => terminalSurface.restartTerminalPane(pane),
    },
    setContextMenu: contextMenuHost.setContextMenu,
    tray: {
      activeMode: utilityTrayMode, activePaneState: activeTerminalPane?.state ?? null,
      activeSurface: agentSurfaceMode === "terminal",
      closePane: () => activeTerminalPane ? terminalSurface.closeTerminalPane(activeTerminalPane.id) : undefined,
      createShell: () => terminalSurface.createTerminalPane(defaultTerminalLaunchProfile()),
      hasActivePane: Boolean(activeTerminalPane), hasWorkspace: Boolean(workspacePath),
      hide: () => setAgentSurfaceMode("chat"),
      killPane: () => activeTerminalPane ? terminalSurface.terminateTerminalPane(activeTerminalPane) : undefined,
      launchProfileChanging: profiles.changing,
      restartPane: () => activeTerminalPane ? terminalSurface.restartTerminalPane(activeTerminalPane) : undefined,
      show: (nextMode) => { setUtilityTrayMode(nextMode); setAgentSurfaceMode("terminal"); },
    },
  });

  const activeTerminalPaneLabelForCommands = activePaneDisplayLabel(terminalPanes, activeTerminalPane);
  const commandPaletteNavigation = {
    drawerModes: DRAWER_MODES,
    editorTabs,
    files: searchableFiles,
    onFocusWorktree: (paneId: number) => {
      setAgentSurfaceMode("terminal");
      void terminalSurface.focusTerminalPane(paneId);
    },
    onLayoutChange: setWorkbenchLayout,
    onOpenFile: (file: FileTreeNode) => void requestOpenEditorFile(file, { focusEditor: true }),
    onShowDrawer: (mode: SideDrawerMode) => {
      setSideDrawerCollapsed(false);
      setSideDrawerMode(mode);
    },
    onTrayModeChange: setToolTrayMode,
    terminalPanes,
    workbenchLayout,
    workspacePath,
    worktrees,
  };
  const commandPaletteTerminal = {
    activePane: activeTerminalPane,
    activePaneLabel: activeTerminalPaneLabelForCommands,
    canClose: Boolean(activeAgentSessionHandle),
    launchProfileChanging: profiles.changing,
    onClear: () => void terminalSurface.clearActiveTerminal(),
    onClose: () => { if (activeAgentSessionHandle) void activeAgentSessionHandle.close(); },
    onCreatePane: (profile: LaunchProfile) => void terminalSurface.createTerminalPane(profile),
    onCreateWorktreePane: (profile: LaunchProfile) => void terminalSurface.createWorktreePane(profile),
    onFind: () => terminalFind.setOpen(true),
    onKill: (pane: ManagedTerminalPane) => void terminalSurface.terminateTerminalPane(pane),
    onRemoveWorktree: (paneId: number) => void terminalSurface.closeWorktreePane(paneId),
    onRestart: (pane: ManagedTerminalPane) => void terminalSurface.restartTerminalPane(pane),
    shortcut: shortcutKeys,
    terminalProfile: profiles.terminalProfile,
    workspacePath,
    worktrees,
  };
  const commandPaletteWorkbench = {
    activeComposerHarnessKey,
    browserUrl: browser.url,
    detectedBrowserUrl: browser.activeDetectedServer?.url ?? null,
    editorDirty,
    editorLoading,
    editorSaving,
    onAttachCurrentFile: () => void attachSelectedFileToComposer(),
    onAttachPreview: () => void attachPreviewToComposer(),
    onCloseEditorTab: () => { if (selectedFile) void closeEditorTab(selectedFile); },
    onExportPerformance: () => void exportRenderPerfSnapshot(),
    onFindEditor: editorSurface.openEditorSearch,
    onOpenDetectedBrowser: () => void browser.openDetectedServer(),
    onOpenSettings: () => setSettingsOpen(true),
    onOpenTranscripts: () => setTranscriptsOpen(true),
    onOpenWorkspace: () => void pickWorkspace(),
    onQuickOpen: quickOpen.openDialog,
    onReloadBrowser: browser.reload,
    onResetLayout: resetInterface,
    onSaveEditor: () => void saveEditorFile(),
    selectedFile,
    shortcut: shortcutKeys,
    workspacePath,
  };
  const commandPaletteChats = {
    activeRun: Boolean(activeChatConversation.activeRunId),
    activeSessionId,
    onOpenSearchResult: (result: ChatSearchViewResult) => void openChatSearchResult(result),
    onOpenSession: (projectPath: string, sessionId: string) => void projectSessionNavigationActions.switchSession(projectPath, sessionId),
    onParallel: () => {
      setOrchestrationError(null);
      setOrchestrationOpen(true);
    },
    openProjects: visibleOpenProjects,
    projectSessions,
    searchResults: chatSearchViewResults,
    workspacePath,
  };
  const visiblePaletteCommands = visibleCommandPaletteCommands(
    assembleCommandPaletteCommands({
      chats: commandPaletteChats,
      navigation: commandPaletteNavigation,
      runAppCommand: composerSurface.runComposerAppCommand,
      terminal: commandPaletteTerminal,
      workbench: commandPaletteWorkbench,
    }),
    commandPalette.query,
    commandPaletteSources,
  );
  const tabIsDirty = (path: string) => dirtyTabPathSet.has(path);
  const {
    cancelNavigation: cancelPendingNavigation,
    closeActiveTab: closeActiveEditorTab,
    closeTab: closeEditorTab,
    discardAndContinue: discardDraftAndContinue,
    draftDialogError,
    pendingNavigation,
    requestNavigation: requestPendingNavigation,
    saveAndContinue: saveDraftAndContinue,
  } = useEditorNavigationLifecycle({
    activeFile: selectedFile,
    captureEditor: () => { captureCurrentEditorViewState(); captureCurrentEditorBuffer(); },
    closeProject: async (projectPath) => { await projectCloseController.closeProjectDirect(projectPath); },
    confirmClose: (message) => confirmDialog(message),
    editorTabs,
    isDirty: tabIsDirty,
    onActivateTab: async (tab) => {
      selectedFileRef.current = null;
      setSelectedFile(null);
      await openEditorFileDirect(tab, { focusEditor: true });
    },
    onRemoveTab: (path) => {
      delete editorBuffersRef.current[path];
      delete editorViewStatesRef.current[path];
      setEditorBufferRevision((value) => value + 1);
    },
    onResetAfterClose: () => {
      if (workspacePathRef.current) void clearPersistedActiveFile(workspacePathRef.current);
      resetEditor();
    },
    openFile: async (file, options) => { await openEditorFileDirect(file, options); },
    openWorkspace: async (path) => { await workspaceOpenActions.openWorkspaceDirect(path); },
    saveEditorFile: () => saveEditorFile(),
    setEditorTabs,
  });

  saveEditorFileRef.current = saveEditorFile;
  openEditorSearchRef.current = editorSurface.openEditorSearch;
  closeActiveEditorTabRef.current = closeActiveEditorTab;

  useEffect(() => {
    void invoke("update_agent_hook_snapshot", {
      snapshot: buildAgentHookSnapshot({
        activeChatId: activeSessionId,
        activeProjectPath: workspacePath,
        editorTabs,
        openProjects,
        panes: terminalPanes,
        selectedFilePath: selectedFile?.path ?? null,
      }),
    }).catch(() => {});
  }, [activeSessionId, editorTabs, openProjects, selectedFile?.path, terminalPanes, workspacePath]);

  useAgentHookRequests({
    setStatus: setAgentHookStatus,
    isPaneOpen: (paneId) => terminalPanesRef.current.some((pane) => pane.id === paneId),
    focusPane: (paneId) => terminalSurface.focusTerminalPane(paneId, "agent"),
    getWorkspacePath: () => workspacePathRef.current,
    openFile: (root, path) => requestOpenEditorFile(
      fileTreeNodeFromPath(`${root}/${path}`, "file"),
      { focusEditor: true },
      "agent",
    ),
    createShell: () => terminalSurface.createTerminalPane(defaultTerminalLaunchProfile(), "agent"),
    recordReport: (report) => recordAgentActivity(activeChatActivityHandle(), hookReportToActivity(report)),
  });

  useSyncRef(workspacePathRef, workspacePath);

  useEffect(() => {
    if (!workspacePath || fileTreeLoading || fileTreeError || fileTree.length === 0 || selectedFile) return;
    if (restoredActiveFileWorkspaceRef.current === workspacePath) return;
    restoredActiveFileWorkspaceRef.current = workspacePath;
    const savedActiveFile = activeFilesByWorkspaceRef.current[workspacePath];
    if (!savedActiveFile) return;
    const node = findFileTreeNode(fileTree, savedActiveFile);
    if (node?.kind === "file") {
      void openEditorFileDirect(node);
      return;
    }
    void clearPersistedActiveFile(workspacePath);
  }, [fileTree, fileTreeError, fileTreeLoading, selectedFile, workspacePath]);


  useWorkspaceTreeWatcher({
    getActiveRoot: () => workspacePathRef.current,
    onChange: refreshFileTree,
    onError: (error) => setFileTreeError(`Live file watcher unavailable: ${error}`),
    workspacePath,
  });

  // Reopen the last folder on startup, otherwise ask for a workspace.
  const workspaceBootstrapController = createWorkspaceBootstrapController({
    hydrateProfiles: profiles.hydrate,
    loadBootstrap: loadWorkspaceBootstrap,
    openWorkspace: (folder, profile) => workspaceOpenActions.openWorkspaceDirect(folder, profile),
    pickWorkspace,
    refreshSecretPresence: (settings) => { void refreshConnectionSecretPresence(settings); },
    refs: bootstrapRefsFromHooks({
      browser, composer: composerWorkspace, editorSession, persistence,
      settingsRef: aiConnectionSettingsRef, storeRef, terminal,
    }),
    sendResize: sendTerminalResize,
    setters: bootstrapSettersFromHooks({
      browser,
      chrome,
      composer: composerWorkspace,
      persistence,
      rest: {
        setAgentActivity: setAgentActivityEvents,
        setAiConnectionSettings,
        setCommandPaletteSources,
        setKeybindingOverrides,
        setKeybindings: setActiveKeybindingOverrides,
        setPaneLabels: setPaneLabelsBySession,
        setPaneTranscripts,
        setWorktrees,
      },
    }),
  });

  useTerminalCanvasRuntime({
    canvasRef,
    imeInputRef,
    terminalHostRef,
    activePaneIdRef: activeTerminalPaneIdRef,
    latest,
    frame,
    metrics,
    selection,
    selecting,
    requestPaintRef: requestTerminalPaintRef,
    renderPerfRef,
    onCommandPalette: commandPalette.openDialog,
    onQuickOpen: quickOpen.openDialog,
    onSettings: () => setSettingsOpen(true),
    onResize: sendTerminalResize,
    onReady: async () => {
      const staleLock = await invoke<boolean>("begin_session").catch(() => false);
      await workspaceBootstrapController.initWorkspace();
      setCrashNotice(crashRecoveryMessage(deriveCrashRecovery(staleLock, openProjectsRef.current.length)));
      window.addEventListener("beforeunload", () => { void invoke("end_session_clean").catch(() => {}); });
    },
  });

  const terminalRuntimeEventHandlers = createTerminalRuntimeEventHandlers(terminalRuntimeFromHook(terminal, {
    activeSessionForProject,
    approvalMode: agentApprovalMode,
    detectLocalServer: detectLocalDevServerFromSnapshot,
    ipcSampleCounter, latest, notificationsEnabled: notificationsEnabledRef,
    notifyBackgroundExit, now: Date.now, persistTranscript: persistPaneTranscript,
    recordActivity: recordAgentActivity,
    recordIpcPayload: recordIpcPayloadBytes, renderPerf: renderPerfRef,
    requestPaint: () => requestTerminalPaintRef.current(), setBackgroundExits,
    setError: setLaunchError, snapshotText: terminalSnapshotText,
    updateProjectStatus: updateOpenProjectStatus,
    updateSessionStatus, workspacePath: workspacePathRef,
  }));

  useNativeAppEvents<TerminalGridPayload<Snapshot>, TerminalPaneExitPayload>({
    onGrid: terminalRuntimeEventHandlers.handleGridPayload,
    onOpenFolder: () => { void pickWorkspace(); },
    onSaveFile: () => { void saveEditorFileRef.current(); },
    onFindInFile: () => openEditorSearchRef.current(),
    onCloseEditorTab: () => { void closeActiveEditorTabRef.current(); },
    onPaneExit: terminalRuntimeEventHandlers.handlePaneExit,
  });

  const activeTerminalPaneLabel = activePaneDisplayLabel(terminalPanes, activeTerminalPane);
  const {
    activeSessionTitle, activeWorkspaceName, primarySurfaceLabel,
    primarySurfaceState, primarySurfaceStatusLabel, utilityTrayStatusLabel,
  } = deriveAppSurfaceLabels({
    activeRunId: activeChatConversation.activeRunId,
    activeSessionId,
    sessions: projectSessionsFor(workspacePath ?? ""),
    trayMode: utilityTrayMode,
    workspacePath,
  });
  const drawerActiveTitle = drawerTitleFor(sideDrawerMode);
  const sourceRepoStatusTitle = sourceRepoStatusTitleFrom(repoLocation, sourceControlStatus);
  const settingsPreferenceActions = createSettingsPreferenceActions({
    commandPaletteSources,
    keybindingOverrides,
    requestNotificationPermission: requestPermission,
    saveSetting: (key, value) => {
      void storeRef.current?.set(key, value);
      void storeRef.current?.save();
    },
    setCommandPaletteSources,
    setKeybindingOverrides: (next) => { setActiveKeybindingOverrides(next); setKeybindingOverrides(next); },
    setNotificationsEnabled,
    setTheme: setAppTheme,
  });
  const settingsScopedActions = createSettingsScopedActions({
    clearScopedSetting,
    readEffectiveBrowserUrl: () => resolveScopedSetting(
      scopedSettingsRef.current, "browserUrl", workspacePathRef.current,
      activeSessionForProject(workspacePathRef.current),
    ).value,
    resolveLaunchProfile: profiles.resolveProfile,
    restoreBrowserPreview: () => browser.restoreScopedUrl(
      workspacePathRef.current, activeSessionForProject(workspacePathRef.current),
    ),
    setBrowserLocation: browser.setLocation,
    setComposerApprovalMode: composerSettingsActions.setApprovalMode,
    switchLaunchProfile: profiles.switchLaunchProfile,
    updateScopedSetting,
  });

  const settingsConnectionActions = createSettingsConnectionActionsController({
    applySettings: (next) => {
      aiConnectionSettingsRef.current = next;
      setAiConnectionSettings(next);
    },
    persistSettings: async (next) => {
      await storeRef.current?.set("aiConnectionSettings", next);
      await storeRef.current?.save();
    },
    clearSecretPresence: (keys) => setConnectionSecretPresence((current) => ({
      ...current, ...Object.fromEntries(keys.map((key) => [key, false])),
    })),
    clearStore: async () => {
      const store = storeRef.current;
      if (store) { await store.clear(); await store.save(); }
    },
    confirmReset: (message) => confirmDialog(message),
    deleteSecret: (key) => invoke("delete_connection_secret", { key }),
    disconnectOAuth: (input) => invoke<McpOAuthStatus>("disconnect_mcp_oauth", input),
    getSettings: () => aiConnectionSettingsRef.current,
    getWorkspacePath: () => workspacePath,
    probe: (input) => invoke<ConnectionTargetStatus>("probe_mcp_server", input),
    recordOAuthStatus: (id, status) => setMcpOAuthStatuses((current) => ({ ...current, [id]: status })),
    reload: () => window.location.reload(),
    resetDurableChats: resetDurableChatStore,
    resetNativeState: () => invoke("reset_local_state"),
    startOAuth: (input) => invoke<McpOAuthStart>("begin_mcp_oauth", input),
  });

  return (
    <WorkbenchShell
      handlers={{
        beginSideDrawerResize,
        hideTools: () => setWorkbenchLayout("hidden"),
        nudgeSideDrawerResize,
        setToolTrayMode,
      }}
      layout={{
        appShellStyle, renderedWorkbenchLayout, settingsOpen, sideDrawerCollapsed,
        surfaceMode: agentSurfaceMode, toolTrayMode, utilityTrayHeight, workbenchStyle,
      }}
      refs={{ workbenchRef }}
      slots={{
        titlebar: <AppTitlebar {...appTitlebarPropsFrom({
        activeSessionTitle,
        createSession: projectSessionNavigationActions.createSession,
        openCommandPalette: commandPalette.openDialog,
        openSettings: () => setSettingsOpen(true),
        openWorkspaceFolder: openPath,
        renderedLayout: renderedWorkbenchLayout,
        resetInterface,
        setLayout: setWorkbenchLayout,
        setToolMode: setToolTrayMode,
        sideDrawerCollapsed,
        storedLayout: workbenchLayout,
        surfaceLabel: primarySurfaceLabel,
        surfaceState: primarySurfaceState,
        surfaceStatusLabel: primarySurfaceStatusLabel,
        terminalOpen: agentSurfaceMode === "terminal",
        toggleRawTerminal: utilityTrayControls.toggleRawTerminal,
        toggleSideDrawer: () => setSideDrawerCollapsed((collapsed) => !collapsed),
        toolMode: toolTrayMode,
        workspacePath,
      })} />,
        rail: <WorkspaceSideRail
        activeTitle={drawerActiveTitle}
        collapsed={sideDrawerCollapsed}
        mode={sideDrawerMode}
        onOpenSettings={() => setSettingsOpen(true)}
        onSelectMode={setSideDrawerMode}
        projects={{
          activeProjectPath: workspacePath, activeSessionId, backgroundExits,
          expandedProjects: expandedSessionProjects, projects: visibleOpenProjects,
          sessionsByProject: projectSessions, showArchived: showArchivedSessions,
          projectStatus: projectRailStatus, sessionStatus: projectSessionStatus,
          onProjectContextMenu: (event, project) => contextMenuHost.openContextMenu(event, projectRailContextMenuItems(project)),
          onSelectProject: (path) => void requestOpenWorkspace(path),
          onSelectSession: (path, sessionId) => void projectSessionNavigationActions.switchSession(path, sessionId),
          onSessionContextMenu: (event, path, session) => contextMenuHost.openContextMenu(event, projectSessionContextMenuItems(path, session)),
          onToggleArchived: () => setShowArchivedSessions((show) => !show),
          onToggleExpanded: (path) => setExpandedSessionProjects((expanded) => toggleExpandedProject(expanded, path)),
        }}
        git={{
          error: gitStatusError, hasWorkspace: Boolean(workspacePath), loading: gitStatusLoading,
          status: gitStatus,
          onOpenDiff: (file) => void openGitDiff(file), onRefresh: () => void refreshGitStatus(),
        }}
        browser={browserToolsDrawerPropsFrom(browser, {
          openExternal: openUrl,
          show: () => setWorkbenchLayout(workbenchLayout === "hidden" ? "right" : workbenchLayout),
        })}
        settings={quickSettingsDrawerPropsFrom({
          composer: {
            approvalMode: activeComposerHarness.approvalMode,
            canSetApproval: Boolean(activeComposerHarnessKey),
          },
          handlers: {
            approvalChange: composerSettingsActions.setApprovalMode,
            layoutChange: setWorkbenchLayout,
            openFolder: () => pickWorkspace(),
            refreshFiles: refreshFileTree,
            setSurfaceMode: setAgentSurfaceMode,
            toggleRawTerminal: utilityTrayControls.toggleRawTerminal,
            toolModeChange: setToolTrayMode,
          },
          layout: {
            surfaceMode: agentSurfaceMode, toolMode: toolTrayMode,
            workbenchLayout: renderedWorkbenchLayout,
          },
          profiles,
          workspacePath,
        })}
        files={{
          fileOpError, fileTree, fileTreeError, fileTreeLoading, fileTreeTruncated,
          railBodyRef, railHeight, selectedFileId: selectedFile?.id, treeRef, visibleFileTree,
          workspaceName: workspacePath ? pathBasename(workspacePath) : null, workspacePath,
          onCreateFile: () => void createFileInRail(), onCreateFolder: () => void createFolderInRail(),
          onOpenFile: (file) => void requestOpenEditorFile(file, { focusEditor: true }),
          onOpenFolder: () => void pickWorkspace(),
          onWorkspaceContextMenu: (event) => contextMenuHost.openContextMenu(event, workspaceContextMenuItems()),
        }}
      />,
        main: <>
        <WorkbenchDockPanels
          files={{
            error: fileTreeError, loading: fileTreeLoading, query: drawerSearchQuery,
            results: drawerSearchResults, searchable: searchableFiles,
            selectedFilePath: selectedFile?.path ?? null,
          }}
          git={{ error: gitStatusError, loading: gitStatusLoading, status: gitStatus }}
          handlers={{
            createFile: () => void createFileInRail(),
            createFolder: () => void createFolderInRail(),
            gitFileContextMenu: (event, file) => contextMenuHost.openContextMenu(
              event, buildGitFileContextMenuItems(file, workspaceContextMenuActions),
            ),
            openDiff: (gitFile) => void openGitDiff(gitFile),
            openFile: (treeFile) => void requestOpenEditorFile(treeFile, { focusEditor: true }),
            refreshFiles: refreshFileTree,
            refreshGit: () => void refreshGitStatus(),
            setQuery: setDrawerSearchQuery,
          }}
          workspacePath={workspacePath}
        />
        <WorkbenchEditorSection
          activeFileMissing={activeFileMissing}
          code={{
            conflict: editorSaveConflict, error: editorError, loading: editorLoading,
            recoveryError: editorRecoveryError, saving: editorSaving, text: editorText,
          }}
          cursor={editorCursor}
          diff={{
            breadcrumbs: diffBreadcrumbs, canDiscard: diffReviewCanDiscard,
            canOpenFile: diffReviewCanOpenFile, canStage: diffReviewCanStage,
            canUnstage: diffReviewCanUnstage, error: diffReviewError,
            loading: diffReviewLoading, review: diffReview,
          }}
          editorBreadcrumbs={editorBreadcrumbs}
          editorBytesLabel={formatBytes(editorBytes)}
          editorDirty={editorDirty}
          editorLanguage={editorLanguage}
          editorLoading={editorLoading}
          editorSaving={editorSaving}
          handlers={{
            closeActiveTab: () => void closeActiveEditorTab(),
            closeDiff: closeDiffReview,
            closeTab: (tab) => void closeEditorTab(tab),
            copyDiff: () => void copyShownDiff(),
            find: editorSurface.openEditorSearch,
            onChange: setEditorText,
            onCreateEditor: editorSurface.restoreEditorView,
            onUpdate: handleEditorUpdate,
            openContextMenu: (kind, event) => contextMenuHost.openContextMenu(
              event, kind === "diff" ? diffContextMenuItems() : editorContextMenuItems(),
            ),
            openDiff: (line = null) => void editorSurface.openDiffFile(line),
            openExternally: () => void editorSurface.openExternally(),
            overwrite: () => void editorSurface.overwrite(),
            reload: () => void editorSurface.reloadFromDisk(),
            runDiffAction: (action) => { if (diffReview) void runGitFileAction(action, diffReview.file); },
            save: () => void saveEditorFile(),
            selectTab: (tab) => void requestOpenEditorFile(tab, { focusEditor: true }),
            tabContextMenu: (event, tab) => contextMenuHost.openContextMenu(event, editorTabContextMenuItems(tab)),
          }}
          selectedFile={selectedFile}
          tabIsDirty={tabIsDirty}
          tabs={editorTabs}
        />

        <WorkbenchResizers
          layout={renderedWorkbenchLayout}
          onKeyDown={nudgeWorkbenchResize}
          onPointerDown={beginWorkbenchResize}
          sizing={workbenchSizing}
          trayMode={toolTrayMode}
        />

        <BrowserPreviewPanel {...browserPreviewPropsFrom(browser, {
          contextMenu: (event) => contextMenuHost.openContextMenu(event, appMenuAssembly.browserContextMenuItems()),
          openExternal: openUrl,
        })} />

        <AgentConversationPanel
          surfaceMode={agentSurfaceMode}
          chat={{
            conversation: activeChatConversation,
            events: selectedAgentActivityLog,
            hidden: false,
            onSuggestion: (draft) => setComposerLocalState(activeComposerHarnessKey, draft, composerHistory),
            onRetry: (prompt) => void composerSurface.submitComposerDraft(prompt),
            onApprovalDecision: (message, decision) => void chatRunControls.resolveChatApproval(message, decision),
            onToggleBookmark: chatConversationActions.toggleBookmark,
            onForkMessage: (message) => void chatConversationActions.forkFromMessage(message),
            onReviewFile: (path) => void editorSurface.reviewRunCardFile(path),
            focusMessageId: focusedChatMessageId,
          }}
          composer={{
            activeRun: Boolean(activeChatConversation.activeRunId),
            approvalMode: activeComposerHarness.approvalMode,
            attachments: activeComposerHarness.attachments,
            configuredModels: aiConnectionSettings.providerModels,
            draft: composerDraft, error: composerError, goal: activeComposerHarness.goal,
            hasHarness: Boolean(activeComposerHarnessKey),
            hasHistory: composerHistory.length > 0,
            historyCursorActive: composerHistoryIndex != null,
            mentionResults: composerMentionQuery != null ? composerMentionResults : [],
            model: activeComposerHarness.model, notice: composerNotice,
            provider: activeComposerProvider,
            reasoningEffort: activeComposerHarness.reasoningEffort, sending: composerSending,
            onApprovalChange: (mode) => void composerSettingsActions.setApprovalMode(mode),
            onAttachMention: (file) => {
              setComposerLocalState(activeComposerHarnessKey, composerDraft.replace(/@[^\s@]*$/, ""), composerHistory);
              void attachWorkspaceFileToComposer(file);
            },
            onClearGoal: () => void composerSettingsActions.setGoal(""),
            onContextMenu: (event) => contextMenuHost.openContextMenu(event, appMenuAssembly.composerContextMenuItems()),
            onDismissNotice: () => setComposerNotice(null),
            onDraftChange: (draft) => {
              setComposerLocalState(activeComposerHarnessKey, draft, composerHistory);
              setComposerHistoryIndex(null);
            },
            onGoalChange: (goal) => void composerSettingsActions.setGoal(goal),
            onGoalCommit: () => void composerSettingsActions.setGoal(activeComposerHarness.goal, { log: true }),
            onManageModels: () => setSettingsOpen(true),
            onNextHistory: composerHistoryNavigation.showNext,
            onOpenAddMenu: appMenuAssembly.openComposerAddMenu,
            onPasteImage: () => void pasteComposerImage(),
            onPreviousHistory: composerHistoryNavigation.showPrevious,
            onReasoningChange: composerSettingsActions.setReasoningEffort,
            onRemoveAttachment: (attachment) => void removeComposerAttachmentById(attachment),
            onReviewContext: () => void reviewComposerContext(),
            onRuntimeChange: composerSettingsActions.setRuntime,
            onStop: () => void chatRunControls.stopActiveChatRun(),
            onSubmit: () => void composerSurface.submitComposerDraft(),
          }}
        />
        <BottomUtilityTray
          activePane={activeTerminalPane} activePaneId={activeTerminalPaneId}
          activeProfileLabel={activeTerminalProfile.label} canClose={Boolean(activeAgentSessionHandle)}
          canvasRef={canvasRef} events={selectedAgentActivityLog} find={terminalFind}
          hasWorkspace={Boolean(workspacePath)} imeInputRef={imeInputRef}
          launchProfile={profiles.terminalProfile} launchProfileChanging={profiles.changing}
          launchProfiles={profiles.allProfiles}
          mode={utilityTrayMode} open={agentSurfaceMode === "terminal"} panes={terminalPanes}
          terminalHostRef={terminalHostRef}
          onClose={() => { if (activeAgentSessionHandle) void activeAgentSessionHandle.close(); }}
          onCreate={(profile) => void terminalSurface.createTerminalPane(profile)} onFocus={(paneId) => void terminalSurface.focusTerminalPane(paneId)}
          onKill={() => { if (activeTerminalPane) void terminalSurface.terminateTerminalPane(activeTerminalPane); }}
          onOpenFolder={() => void pickWorkspace({ openTerminal: true })}
          onOpenTab={(mode) => void utilityTrayControls.openUtilityTray(mode)}
          onPaneContextMenu={(event, pane) => contextMenuHost.openContextMenu(event, appMenuAssembly.terminalPaneContextMenuItems(pane))}
          onPaste={(text) => { invoke("paste", { text }).catch(() => {}); }}
          onProfileChange={(profileId) => {
            void profiles.switchTerminalProfile(profiles.resolveProfile(profileId));
          }}
          onRename={(pane) => void renameTerminalPane(pane)}
          onResizeStart={(event) => { setAgentSurfaceMode("terminal"); beginUtilityTrayResize(event); }}
          onRestart={() => { if (activeTerminalPane) void terminalSurface.restartTerminalPane(activeTerminalPane); }}
          onStartShell={() => void terminalSurface.createTerminalPane(defaultTerminalLaunchProfile())}
          onTabContextMenu={(event, mode) => contextMenuHost.openContextMenu(event, appMenuAssembly.utilityTrayTabContextMenuItems(mode))}
          onTerminalContextMenu={(event) => contextMenuHost.openContextMenu(event, terminalContextMenuItems())}
          onToggleVisibility={utilityTrayControls.toggleUtilityTrayVisibility}
        />
        </>,
        overlays: <>

      <AppSettingsHost
        open={settingsOpen}
        connectionActions={settingsConnectionActions}
        preferenceActions={settingsPreferenceActions}
        profilesController={profiles}
        scopedActions={settingsScopedActions}
        handlers={{
          close: () => setSettingsOpen(false),
          deleteConnectionSecret,
          openAgentConnection: utilityTrayControls.openAgentConnection,
          openSourceControlLink: (url) => openUrl(url).catch(() => {}),
          refreshAgentConnections,
          resetLayout: resetInterface,
          saveConnectionSecret,
          saveConnectionSettings: settingsConnectionActions.saveSettings,
          setLayout: setWorkbenchLayout,
          setTrayMode: setToolTrayMode,
        }}
        modal={{
          agentConnectionsRefreshing, agentConnectionsStatus, agentHookStatus,
          aiConnectionSettings,
          approvalSetting: activeApprovalSetting,
          browserSetting: activeBrowserSetting,
          commandPaletteSources, connectionSecretPresence,
          customTerminalProfiles: profiles.customProfiles,
          gitBranch: gitStatus?.branch ?? null,
          gitChangeCount: gitStatus ? gitStatus.files.length : null,
          keybindingOverrides,
          layout: renderedWorkbenchLayout,
          mcpOAuthStatuses, notificationsEnabled,
          profileSetting: activeAgentProfileSetting,
          profiles: settingsAgentProfileOptions(LAUNCH_PROFILES),
          repoLocation,
          sessionTitle: activeSessionTitle,
          sourceControlStatus,
          theme: appTheme,
          trayMode: toolTrayMode,
          workspaceName: activeWorkspaceName,
          workspacePath: workspacePath ?? "",
        }}
      />
      <TranscriptsModal {...transcriptsModalPropsFrom(
        { openTranscriptId, paneTranscripts, setOpenTranscriptId, setTranscriptsOpen, transcriptsOpen },
        { projectId: workspacePath, projectSessionId: activeSessionId },
      )} />
      <AppRuntimeDialogs
        notices={appNoticesPropsFrom({
          chrome: { actionNotice, crashNotice, setActionNotice, setCrashNotice },
          launchError,
          openFolder: () => pickWorkspace(),
          profiles: {
            changing: profiles.changing,
            launchProfile: profiles.launchProfile,
            profilesList: LAUNCH_PROFILES,
            switchLaunchProfile: profiles.switchLaunchProfile,
          },
        })}
        orchestration={orchestrationDialogPropsFrom({
          activeProvider: activeComposerProvider,
          approvalMode: activeComposerHarness.approvalMode,
          conversationProvider: activeChatConversation.provider,
          derived: deriveOrchestrationDialogState({
            activeSessionId, conversations: chatConversations,
            sessions: projectSessions, workspacePath,
          }),
          error: orchestrationError,
          launch: composerSurface.launchOrchestration,
          launching: orchestrationLaunching,
          open: orchestrationOpen,
          setError: setOrchestrationError,
          setOpen: setOrchestrationOpen,
          workspacePath,
        })}
      />
      {contextMenuHost.element}
      {commandPalette.open ? (
        <SearchCommandDialog {...searchDialogPropsFrom(commandPalette, {
          commands: visiblePaletteCommands,
          error: chatSearchError,
          loading: chatSearchLoading,
          shortcut: shortcutKeys("chrome.command-palette"),
        })} />
      ) : null}
      <QuickOpenDialog
        controller={quickOpen}
        shortcut={shortcutKeys("workspace.quick-open")}
        workspacePath={workspacePath}
        onOpenFile={(file) => void requestOpenEditorFile(file, { focusEditor: true })}
      />
      {(() => {
        const draftProps = draftNavigationPropsFrom({
          cancel: cancelPendingNavigation,
          discard: discardDraftAndContinue,
          error: draftDialogError,
          hasPendingNavigation: Boolean(pendingNavigation),
          save: saveDraftAndContinue,
          saving: editorSaving,
          selectedFile,
        });
        return draftProps ? <DraftNavigationDialog {...draftProps} /> : null;
      })()}
      <StatusBar
        workspaceName={activeWorkspaceName}
        primarySurfaceState={primarySurfaceState}
        primarySurfaceLabel={primarySurfaceLabel}
        primarySurfaceStatusLabel={primarySurfaceStatusLabel}
        {...statusBarRepoPropsFrom(repoLocation, openUrl)}
        repoTitle={sourceRepoStatusTitle}
        surfaceMode={agentSurfaceMode}
        utilityLabel={utilityTrayStatusLabel}
      />
        </>,
      }}
    />
  );
}

export default App;
