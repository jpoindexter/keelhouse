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
import { createWorkspaceBootstrapController } from "./workspaceBootstrapController";
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
import { createTerminalSurfaceActions } from "./terminalSurfaceController";
import { createWorkspaceOpenSurface } from "./workspaceOpenSurface";
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
import { deriveOrchestrationDialogState } from "./orchestrationDialogState";
import { settingsAgentProfileOptions } from "./settingsModalData";
import { deriveAppSurfaceLabels } from "./appSurfaceLabels";
import { AppSettingsHost } from "./appSettingsHost";
import { WorkbenchDockPanels } from "./WorkbenchDockPanels";
import { canUseShellProfile, findShellProfile } from "./shellProfileNotice";
import { WorkbenchShell } from "./WorkbenchShell";
import { browserPreviewPropsFrom, browserToolsDrawerPropsFrom } from "./browserPreviewHost";
import { quickSettingsDrawerPropsFrom } from "./quickSettingsHost";
import { composerMentionQuery as composerMentionQueryFrom } from "./agentComposer";
import { toggleExpandedProject, visibleProjectsFrom } from "./projectRailView";
import { fileTreeNodeFromPath, pathBasename } from "./fileTreeTypes";
import { createTerminalPaneFinalize } from "./terminalPaneFinalize";
import { createChatSearchNavigation } from "./chatSearchNavigation";
import { createSessionSnapshotCapture } from "./sessionSnapshotCapture";
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
  addWorktree,
  removeWorktreeByPaneId,
  worktreeForPaneId,
  type WorktreeRecord,
} from "./worktrees";
import { formatCliToolStatus, type SourceControlStatus } from "./sourceControl";
import {
  DEFAULT_AI_CONNECTION_SETTINGS,
  connectionEnvironmentInputs,
  type AiConnectionSettings,
  type ConnectionTargetStatus,
  type McpOAuthStart,
  type McpOAuthStatus,
} from "./connectionSettings";
import { useMcpOAuthStatus } from "./useMcpOAuthStatus";
import { buildRepoUrl, sourceRepoStatusLabel, type RepoLocation } from "./sourceControlLinks";
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
import { createProjectCloseController } from "./projectCloseController";
import { createProjectSessionNavigationActions } from "./projectSessionNavigationActions";
import { createProjectSessionDeletionController } from "./projectSessionDeletionController";
import {
  createTerminalRuntimeEventHandlers,
  type TerminalGridPayload,
  type TerminalPaneExitPayload,
} from "./terminalRuntimeEventHandlers";
import {
  buildCreatedPaneActivity,
  buildCreatedWorktreePaneActivity,
} from "./paneActivityRecords";
import "./App.css";
import "./composerModelPicker.css";
import "./responsive-shell.css";
import "./workbenchTransitions.css";

// SPIKE-2 frontend: paint the grid snapshots from the Rust backend onto a canvas,
// and encode keydowns back into pty bytes. Ship-ugly on purpose.

type Cell = { t: string; f: [number, number, number]; b: [number, number, number]; bold: boolean };
type Snapshot = { cols: number; rows: number; cx: number; cy: number; cvis: boolean; sb: number; cells: Cell[] };
type OpenPaneResponse = { paneId: number };
type SaveEditorFileOptions = { force?: boolean };
const formatBytes = (bytes: number | null) => {
  if (bytes == null) return "--";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
const sourceRepoStatusTitleFor = (repoLocation: RepoLocation | null, toolStatus: SourceControlStatus["gh"] | undefined) =>
  repoLocation ? `${sourceRepoStatusLabel(repoLocation)} · ${toolStatus ? formatCliToolStatus(toolStatus) : "Checking authentication"}` : "";

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
  const {
    chatConversations, chatConversationsRef, clearScopedSetting,
    composerHarnessBySession, composerHarnessBySessionRef, persistComposerHarnessRecords,
    scopedSettings, scopedSettingsRef, setChatConversations,
    setComposerHarnessBySession, setScopedSettings, updateScopedSetting,
  } = useComposerWorkspaceState({
    getRoot: () => workspacePathRef.current,
    getSessionId: (root) => activeProjectSessionId(
      activeSessionByProjectRef.current, projectSessionsRef.current, root,
    ),
    saveStore: async () => { await storeRef.current?.save(); },
    setStoreValue: async (key, value) => { await storeRef.current?.set(key, value); },
  });
  const editorSession = useEditorSessionController();
  const {
    activeFilesByWorkspaceRef, captureCurrentEditorBuffer, captureCurrentEditorViewState,
    captureSessionSnapshot: captureEditorSessionSnapshot,
    closeActiveEditorTabRef, editorBuffersRef, editorBytes, editorCursor, editorError,
    editorLoading, editorRecoveryError, editorSaving,
    editorTabs, editorText, editorViewRef, editorViewStatesRef, fileOpError,
    openEditorSearchRef, pendingEditorFocusRef, resetEditor, restoredActiveFileWorkspaceRef,
    restoreSessionSnapshot: restoreEditorSessionSnapshot, saveEditorFileRef,
    savedEditorText, selectedFile, selectedFileRef,
    sessionEditorSnapshotsRef, setEditorBufferRevision, setEditorCursor,
    setEditorRecoveryError,
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
    activePaneForSession, activePaneId: activeTerminalPaneId,
    activePaneIdRef: activeTerminalPaneIdRef, activePaneIdsRef: activeTerminalPaneByContextRef,
    activeProjectStatus, activeSessionStatus, contextForPaneId: paneContextForPaneId,
    intentionallyTerminatedPaneIdsRef, paneLabelsRef: paneLabelsBySessionRef,
    paneLayoutsRef: paneLayoutsBySessionRef,
    panes: terminalPanes, panesByContextRef: terminalPanesByContextRef,
    panesForProject: terminalPanesForProject, panesForSession: terminalPanesForSession,
    panesRef: terminalPanesRef, projectStatusForRoot,
    requestPaintRef: requestTerminalPaintRef, setFocusedPane: setFocusedTerminalPane,
    setManagedPanes: setManagedTerminalPanes, setPaneLabels: setPaneLabelsBySession,
    setPaneState, setSessionPanes: setSessionTerminalPanes,
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
  const {
    activeSessionByProject, activeSessionByProjectRef, activeSessionForProject,
    clearActiveFile: clearPersistedActiveFile, expandedSessionProjects, openProjects,
    openProjectsRef, persistActiveFile, persistOpenProjects,
    persistPaneLabel, persistPaneLayout: persistPaneLayoutForSession,
    persistProjectSessions, persistSessionSnapshots: persistSessionEditorSnapshots,
    projectSessions, projectSessionsRef, recentProjectsRef,
    removeSessionRestore: removePersistedSessionRestore,
    savedPaneLabel: savedPaneLabelForSlot, sessionKey: sessionSnapshotKey,
    setActiveSessionByProjectState, setExpandedSessionProjects, setOpenProjects,
    setProjectSessions, setRecentProjects, setShowArchivedSessions,
    showArchivedSessions, updateActiveSessionStatus, updateOpenProjectStatus,
    updateSessionStatus,
  } = useWorkspacePersistenceController({
    activeFiles: activeFilesByWorkspaceRef,
    getPanes: (root, sessionId) => terminalPanesForSession(root, sessionId),
    paneLabels: paneLabelsBySessionRef,
    paneLayouts: paneLayoutsBySessionRef,
    sessionSnapshots: sessionEditorSnapshotsRef,
    setPaneLabels: setPaneLabelsBySession,
    store: storeRef,
  });
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
  const setContextMenu = contextMenuHost.setContextMenu;
  const openContextMenu = contextMenuHost.openContextMenu;
  const commandPalette = useCommandPalette(() => setContextMenu(null));
  const [commandPaletteSources, setCommandPaletteSources] = useState({ ...DEFAULT_COMMAND_PALETTE_SOURCES });
  const [orchestrationOpen, setOrchestrationOpen] = useState(false);
  const [orchestrationLaunching, setOrchestrationLaunching] = useState(false);
  const [orchestrationError, setOrchestrationError] = useState<string | null>(null);
  const [composerNotice, setComposerNotice] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const {
    actionNotice, appTheme, crashNotice, notificationsEnabled, notificationsEnabledRef,
    setActionNotice, setAppTheme, setCrashNotice, setNotificationsEnabled,
  } = useAppChromeState();
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
    hasUnsaved: (path) => editorHasUnsavedBufferForPath(path),
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
  const quickOpen = useQuickOpen(searchableFiles, () => setContextMenu(null));
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
    switchSession: (root, sessionId) => switchProjectSession(root, sessionId),
  });
  const updateChatConversation = chatConversationActions.updateConversation;
  const toggleChatMessageBookmark = chatConversationActions.toggleBookmark;
  const forkChatFromMessage = chatConversationActions.forkFromMessage;

  useChatRunEvents((envelope) => {
    updateChatConversation(envelope.chatId, (conversation) =>
      applyChatRunEnvelope(conversation, envelope));
  });

  const logComposerHarnessEvent = (
    label: string,
    detail: string,
    status: Parameters<typeof recordAgentActivity>[1]["status"] = "complete",
  ) => {
    recordAgentActivity(activeAgentSessionDescriptor, {
      kind: "app",
      label,
      detail,
      status,
    });
  };


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

  const restoreSessionEditorSnapshot = (root: string, sessionId: string | null) => {
    restoreEditorSessionSnapshot({
      key: sessionId ? sessionSnapshotKey(root, sessionId) : null,
      openFile: openEditorFileDirect,
    });
  };

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
      records: {
        activePanes: { ref: activeTerminalPaneByContextRef },
        activeSessions: { ref: activeSessionByProjectRef, set: setActiveSessionByProjectState },
        browserProjects: { ref: browser.projectRecordsRef, set: browser.setProjectRecords },
        browserSessions: { ref: browser.sessionRecordsRef, set: browser.setSessionRecords },
        conversations: { ref: chatConversationsRef, set: setChatConversations },
        editorSnapshots: { ref: sessionEditorSnapshotsRef },
        harnessRecords: { ref: composerHarnessBySessionRef, set: setComposerHarnessBySession },
        openProjects: { ref: openProjectsRef, set: setOpenProjects },
        paneLayouts: { ref: paneLayoutsBySessionRef },
        projectPanes: { ref: terminalPanesByContextRef },
        recentProjects: { ref: recentProjectsRef, set: setRecentProjects },
        sessions: { ref: projectSessionsRef, set: setProjectSessions },
      },
      restoreBrowser: browser.restoreScopedUrl, restoreEditor: restoreSessionEditorSnapshot,
      sessionStatus: terminalPaneProjectStatus, setFocusedPane: setFocusedTerminalPane,
      setLaunchError, setManagedPanes: setManagedTerminalPanes,
    },
    target: {
      activePaneForSession, activePaneIds: activeTerminalPaneByContextRef,
      activeSessions: activeSessionByProjectRef,
      getSurfaceMode: () => agentSurfaceMode, latest, now: Date.now,
      paneLayouts: paneLayoutsBySessionRef, panesByContext: terminalPanesByContextRef,
      panesForSession: terminalPanesForSession,
      requestPaint: () => requestTerminalPaintRef.current(), resetEditor,
      resolveProfile: profiles.resolveProfile,
      restoredActiveFileWorkspace: restoredActiveFileWorkspaceRef,
      savedLabelForSlot: savedPaneLabelForSlot,
      scheduleResize: () => setTimeout(sendTerminalResize, 0), sessions: projectSessionsRef,
      setFocusedPane: setFocusedTerminalPane, setLaunchError, setManagedPanes: setManagedTerminalPanes,
      setWorkspacePath, snapshots: terminalSnapshotsRef, workspacePath: workspacePathRef,
    },
  });
  const openWorkspaceDirect = workspaceOpenActions.openWorkspaceDirect;

  const requestOpenWorkspace = (path: string) => workspaceOpenActions.requestOpenWorkspace(
    path, () => requestPendingNavigation({ kind: "workspace", path }),
  );

  const projectCloseController = createProjectCloseController({
    activePanes: activeTerminalPaneByContextRef,
    clearActiveWorkspace: () => {
      setWorkspacePath(null); setManagedTerminalPanes([]); setFocusedTerminalPane(null);
      latest.current = null; setFileTree([]); resetEditor();
    },
    closePane: (paneId) => invoke("close_pane", { paneId }),
    confirmClose: (message) => confirmDialog(message), conversations: chatConversationsRef,
    deleteStoredFolder: async () => { await storeRef.current?.delete("folder"); },
    dirtyTabCount: dirtyTabPaths.length, getPanes: terminalPanesForProject,
    hasSelectedFile: () => selectedFileRef.current != null,
    intentionallyTerminatedPaneIds: intentionallyTerminatedPaneIdsRef.current,
    openProjects: openProjectsRef, openWorkspace: openWorkspaceDirect,
    persistOpenProjects, projectPanes: terminalPanesByContextRef,
    saveStore: async () => { await storeRef.current?.save(); },
    setActionNotice, setLaunchError, snapshots: terminalSnapshotsRef,
    stopChatRun: (runId) => invoke("stop_chat_run", { runId }),
    stopWorkspaceWatcher: () => invoke("stop_workspace_watcher"),
    workspacePath: workspacePathRef,
  });
  const closeProjectDirect = projectCloseController.closeProjectDirect;
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
        await openWorkspaceDirect(
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
  const switchProjectSession = projectSessionNavigationActions.switchSession;

  const openChatSearchResult = createChatSearchNavigation({
    focusMessage: setFocusedChatMessageId,
    getSessions: () => projectSessionsRef.current,
    setError: setChatSearchError,
    showArchived: () => setShowArchivedSessions(true),
    showProjectsDrawer: () => setSideDrawerMode("projects"),
    switchSession: switchProjectSession,
  });

  const createProjectSession = projectSessionNavigationActions.createSession;
  const renameProjectSession = projectSessionNavigationActions.renameSession;

  const projectSessionDeletionController = createProjectSessionDeletionController({
    activePanes: activeTerminalPaneByContextRef, activeSessionId,
    activeSessions: activeSessionByProjectRef, browserSessions: browser.sessionRecordsRef,
    closePane: (paneId) => invoke("close_pane", { paneId }),
    composerHarness: composerHarnessBySessionRef, confirmDelete: confirmDialog,
    conversations: chatConversationsRef, deleteHistory: deleteDurableChatConversation,
    getPanes: terminalPanesForSession,
    intentionallyTerminatedPaneIds: intentionallyTerminatedPaneIdsRef.current,
    persistBrowserSessions: async (records) => {
      await storeRef.current?.set("browserPreviewBySession", records);
    },
    persistComposerHarness: persistComposerHarnessRecords, persistSessions: persistProjectSessions,
    projectPanes: terminalPanesByContextRef, removePersistedRestore: removePersistedSessionRestore,
    reopenActiveWorkspace: (projectPath) => openWorkspaceDirect(
      projectPath, profiles.launchProfileRef.current, { captureCurrentSession: false },
    ),
    sessions: projectSessionsRef, setBrowserSessions: browser.setSessionRecords,
    setConversations: setChatConversations, setError: setLaunchError,
    snapshots: terminalSnapshotsRef, workspacePath: workspacePathRef,
  });
  const deleteProjectSession = projectSessionDeletionController.deleteProjectSession;

  const recordCreatedPaneActivity = (pane: ManagedTerminalPane, projectId: string, projectSessionId: string) => {
    const record = buildCreatedPaneActivity({ approvalMode: agentApprovalMode, pane, projectId, projectSessionId });
    recordAgentActivity(record.handle, record.event);
  };

  const recordCreatedWorktreePaneActivity = (
    pane: ManagedTerminalPane,
    projectId: string,
    projectSessionId: string,
    branch: string,
  ) => {
    const record = buildCreatedWorktreePaneActivity({ approvalMode: agentApprovalMode, branch, pane, projectId, projectSessionId });
    recordAgentActivity(record.handle, record.event);
  };

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

  const pickWorkspace = async (options: { openTerminal?: boolean } = {}) => {
    const dir = await open({ directory: true });
    if (typeof dir !== "string") return false;
    const opened = await requestOpenWorkspace(dir);
    if (!opened) return false;
    if (options.openTerminal) return createTerminalPane(defaultTerminalLaunchProfile());
    return true;
  };

  const composerSurface = createComposerSurface({
    chatIdForSession: composerHarnessSessionKey,
    clearTerminal: () => clearActiveTerminal(),
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
    openSearch: () => openEditorSearch(),
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
    updateConversation: updateChatConversation,
    updateHarness: (update) => updateActiveComposerHarness(update),
    updateSessionMetadata: (projectPath, sessionId, orchestration) =>
      updateProjectSessionMetadata(projectPath, sessionId, { orchestration }),
  });
  const runComposerAppCommand = composerSurface.runComposerAppCommand;
  const submitComposerDraft = composerSurface.submitComposerDraft;
  const launchOrchestration = composerSurface.launchOrchestration;
  const removeChildWorktree = composerSurface.removeChildWorktree;
  const returnChildResult = composerSurface.returnChildResult;
  const stopChildChatRun = composerSurface.stopChildChatRun;

  const chatRunControls = createChatRunControls({
    getActiveRunId: () => activeChatConversation.activeRunId,
    respondApproval: ({ decision, requestId, runId }) =>
      invoke("respond_chat_approval", { runId, requestId, decision }),
    setError: setComposerError,
    stopRun: (runId) => invoke("stop_chat_run", { runId }),
  });
  const stopActiveChatRun = chatRunControls.stopActiveChatRun;
  const resolveChatApproval = chatRunControls.resolveChatApproval;

  const composerHistoryNavigation = createComposerHistoryNavigation({
    getChatId: () => activeComposerHarnessKey,
    getHistory: () => composerHistory,
    getHistoryIndex: () => composerHistoryIndex,
    setHistoryIndex: setComposerHistoryIndex,
    setLocalState: setComposerLocalState,
  });
  const showPreviousComposerHistory = composerHistoryNavigation.showPrevious;
  const showNextComposerHistory = composerHistoryNavigation.showNext;

  const saveAiConnectionSettings = async (next: AiConnectionSettings) => {
    aiConnectionSettingsRef.current = next;
    setAiConnectionSettings(next);
    await storeRef.current?.set("aiConnectionSettings", next);
    await storeRef.current?.save();
  };

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
    updateConversation: updateChatConversation,
    updateHarness: updateActiveComposerHarness,
    updateScopedSetting: (key, value) => key === "approvalMode"
      ? updateScopedSetting("chat", "approvalMode", value as AgentApprovalMode)
      : updateScopedSetting("chat", "agentProfileId", value as ChatProvider),
  });
  const setComposerApprovalMode = composerSettingsActions.setApprovalMode;
  const setComposerGoal = composerSettingsActions.setGoal;
  const setComposerRuntime = composerSettingsActions.setRuntime;
  const setComposerReasoningEffort = composerSettingsActions.setReasoningEffort;

  const terminalSurface = createTerminalSurfaceActions<Snapshot, SelectionRange>({
    activeAgentDescriptor: () => activeAgentSessionDescriptor,
    activeAgentHandle: () => activeAgentSessionHandle,
    activePane: () => activeTerminalPane,
    activePaneId: activeTerminalPaneIdRef,
    activePaneIds: activeTerminalPaneByContextRef,
    approvalMode: () => agentApprovalMode,
    closePane: async (paneId) =>
      (await invoke<{ activePaneId: number | null }>("close_pane", { paneId })).activePaneId,
    copyText: writeText,
    createPane: async (root, profile) => (await invoke<OpenPaneResponse>("create_pane", {
      path: root, profile, environment: connectionEnvironmentInputs(aiConnectionSettingsRef.current, root),
    })).paneId,
    createWorktree: (root, label) => invoke("create_project_worktree", { root, label }),
    createWorktreePane: async (path, profile, projectRoot) =>
      (await invoke<OpenPaneResponse>("create_pane", {
        path, profile, environment: connectionEnvironmentInputs(aiConnectionSettingsRef.current, projectRoot),
      })).paneId,
    defaultProfile: () => profiles.terminalProfileRef.current,
    finalizePane: finalizeCreatedTerminalPane,
    focusPane: (paneId) => invoke("focus_pane", { paneId }),
    gateAction: async (action, handle) => (await gateAppAction(action, handle)).decision,
    getChanging: () => profiles.changing, getPanes: terminalPanesForSession,
    getProjectStatus: projectStatusForRoot, getSessionId: activeSessionForProject,
    getWorkspacePath: () => workspacePathRef.current,
    getWorkspacePathOrState: () => workspacePathRef.current ?? workspacePath,
    getWorktrees: () => worktrees,
    intentionallyTerminatedPaneIds: intentionallyTerminatedPaneIdsRef.current,
    latest, now: Date.now,
    paste: (text) => invoke("paste", { text }),
    persistWorktreeRecord: (record) => setWorktrees((current) => {
      const next = addWorktree(current, record);
      void storeRef.current?.set("worktrees", next); void storeRef.current?.save();
      return next;
    }),
    persistWorktreeRemoval: (paneId) => setWorktrees((current) => {
      const next = removeWorktreeByPaneId(current, paneId);
      void storeRef.current?.set("worktrees", next); void storeRef.current?.save();
      return next;
    }),
    promptWorktreeLabel: () => window.prompt("Worktree label (used for the branch name)"),
    readClipboard: readText,
    recordActivity: recordAgentActivity,
    recordCreated: recordCreatedPaneActivity,
    recordCreatedWorktree: recordCreatedWorktreePaneActivity,
    removeWorktree: (root, worktree) => invoke("remove_project_worktree", {
      root, worktreePath: worktree.path, branch: worktree.branch,
    }),
    requestPaint: () => requestTerminalPaintRef.current(), savedLabel: savedPaneLabelForSlot,
    restartPane: async (root, pane) => (await invoke<OpenPaneResponse>("restart_pane", {
      path: root, paneId: pane.id, profile: pane.profile,
      environment: connectionEnvironmentInputs(aiConnectionSettingsRef.current, root),
    })).paneId,
    scheduleResize: () => setTimeout(sendTerminalResize, 0), selection,
    selectionText: (snap, snapSelection) => selectionToText(snap.cells, snap.cols, snapSelection),
    sendClearKey: () => invoke("send_key", {
      code: "KeyL", text: null, shift: false, alt: false, ctrl: true, sup: false,
    }),
    setChanging: profiles.setChanging,
    setComposerError, setLaunchError,
    setFocusedPane: setFocusedTerminalPane,
    setPaneExited: (paneId) => setPaneState(paneId, "exited", null),
    setSessionPanes: setSessionTerminalPanes,
    snapshots: terminalSnapshotsRef, statusForPanes: terminalPaneProjectStatus,
    terminatePane: (paneId) => invoke("terminate_pane", { paneId }),
    updateProjectStatus: updateOpenProjectStatus,
    updateSessionStatus: (root, status) => updateActiveSessionStatus(root, status),
  });
  const closeTerminalPane = terminalSurface.closeTerminalPane;
  const closeWorktreePane = terminalSurface.closeWorktreePane;
  const createTerminalPane = terminalSurface.createTerminalPane;
  const createWorktreePane = terminalSurface.createWorktreePane;
  const focusTerminalPane = terminalSurface.focusTerminalPane;
  const interruptActivePane = terminalSurface.interruptActivePane;
  const terminateTerminalPane = terminalSurface.terminateTerminalPane;
  const restartTerminalPane = terminalSurface.restartTerminalPane;
  const terminalSelectedText = terminalSurface.terminalSelectedText;
  const copyTerminalSelection = terminalSurface.copyTerminalSelection;
  const copyActivePaneTail = terminalSurface.copyActivePaneTail;
  const pasteIntoTerminal = terminalSurface.pasteIntoTerminal;
  const clearActiveTerminal = terminalSurface.clearActiveTerminal;

  const utilityTrayControls = createUtilityTrayControls({
    closeSettings: () => setSettingsOpen(false),
    createTerminalPane: (profile) => createTerminalPane(profile),
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
  const toggleRawTerminal = utilityTrayControls.toggleRawTerminal;
  const openUtilityTray = utilityTrayControls.openUtilityTray;
  const toggleUtilityTrayVisibility = utilityTrayControls.toggleUtilityTrayVisibility;
  const openAgentConnection = utilityTrayControls.openAgentConnection;

  const activeAgentSessionHandle: AgentSessionHandle | null = activeAgentSessionDescriptor
    ? createActiveAgentSessionHandle({
        activePaneId: () => activeTerminalPaneIdRef.current,
        closePane: closeTerminalPane,
        descriptor: activeAgentSessionDescriptor,
        focusPane: focusTerminalPane,
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

  const terminalSize = () => {
    const rect = terminalHostRef.current?.getBoundingClientRect();
    if (rect && rect.width > 0 && rect.height > 0) {
      return { width: rect.width, height: rect.height };
    }
    return { width: window.innerWidth, height: window.innerHeight };
  };

  const sendTerminalResize = () => {
    const { cw, ch } = metrics.current;
    const { width, height } = terminalSize();
    const cols = Math.max(2, Math.floor(width / cw));
    const rows = Math.max(2, Math.floor(height / ch));
    invoke("resize_pty", { cols, rows }).catch(() => {});
  };

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
    {
      editorBuffersRef, editorText, editorViewRef, editorViewStatesRef,
      pendingEditorFocusRef, savedEditorText, selectedFileRef,
      setEditorCursor, setEditorRecoveryError,
    },
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
  const reviewRunCardFile = editorSurface.reviewRunCardFile;
  const editorHasUnsavedBufferForPath = editorSurface.editorHasUnsavedBufferForPath;
  const openDiffFile = editorSurface.openDiffFile;
  const reloadSelectedFileFromDisk = editorSurface.reloadFromDisk;
  const overwriteSelectedFile = editorSurface.overwrite;
  const openSelectedFileExternally = editorSurface.openExternally;
  const revealSelectedFile = editorSurface.reveal;
  const copyPathToClipboard = editorSurface.copyPath;
  const openEditorSearch = editorSurface.openEditorSearch;
  const handleEditorUpdate = (update: ViewUpdate) => editorSurface.handleEditorUpdate(update);
  const restoreEditorView = editorSurface.restoreEditorView;

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
    copyPath: copyPathToClipboard,
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
  const updateProjectSessionMetadata = projectSessionMetadataActions.updateSessionMetadata;
  const archiveProjectSession = projectSessionMetadataActions.archiveSession;
  const pinProjectSession = projectSessionMetadataActions.pinSession;

  const {
    capture: captureSessionCheckpoint,
    restore: restoreSessionCheckpoint,
  } = wireSessionCheckpointActions(editorSession, {
    gateAction: (action) => gateAppAction(action),
    getDirtyTabPaths: () => dirtyTabPaths,
    getWorkspacePath: () => workspacePathRef.current,
    onMetadata: updateProjectSessionMetadata,
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
        archive: () => archiveProjectSession(projectPath, session, !session.archived),
        captureCheckpoint: () => captureSessionCheckpoint(projectPath, session),
        copyName: async () => { await writeText(session.title); setActionNotice("Copied chat name"); },
        delete: () => deleteProjectSession(projectPath, session),
        pin: () => pinProjectSession(projectPath, session, !session.pinnedAt),
        removeChildWorktree: () => removeChildWorktree(projectPath, session),
        rename: () => renameProjectSession(projectPath, session),
        restoreCheckpoint: () => session.checkpointId ? restoreSessionCheckpoint(projectPath, session, session.checkpointId) : undefined,
        restoreRecoveryCheckpoint: () => session.recoveryCheckpointId ? restoreSessionCheckpoint(projectPath, session, session.recoveryCheckpointId) : undefined,
        returnChildResult: () => returnChildResult(projectPath, session),
        stopChildRun: () => stopChildChatRun(projectPath, session),
        switchChat: () => switchProjectSession(projectPath, session.id),
      },
    });
  };

  const editorContextMenuActions = {
    closeDiff: closeDiffReview,
    closeTab: (tab: FileTreeNode) => closeEditorTab(tab),
    copyDiff: copyShownDiff,
    copyPath: copyPathToClipboard,
    find: openEditorSearch,
    openDiffFile,
    openExternal: openSelectedFileExternally,
    openTab: (tab: FileTreeNode) => requestOpenEditorFile(tab, { focusEditor: true }),
    revealNode: revealRailNode,
    revealSelected: revealSelectedFile,
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
    hasSelection: Boolean(terminalSelectedText()),
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
      clear: () => clearActiveTerminal(),
      closePane: () => activeAgentSessionHandle?.close(),
      copySelection: async () => { await copyTerminalSelection(); setActionNotice("Copied terminal selection"); },
      copyTail: async () => { await copyActivePaneTail(); setActionNotice("Copied last 20 lines"); },
      copyWorkingDirectory: () => workspacePath ? copyPathToClipboard(workspacePath) : undefined,
      createPane: () => createTerminalPane(profiles.terminalProfile),
      createWorktreePane: () => createWorktreePane(profiles.terminalProfile),
      interrupt: () => interruptActivePane(),
      killPane: () => activeTerminalPane ? terminateTerminalPane(activeTerminalPane) : undefined,
      paste: () => pasteIntoTerminal(),
      removeWorktree: () => activeTerminalPane ? closeWorktreePane(activeTerminalPane.id) : undefined,
      renamePane: () => activeTerminalPane ? renameTerminalPane(activeTerminalPane) : undefined,
      restartPane: () => activeTerminalPane ? restartTerminalPane(activeTerminalPane) : undefined,
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
      copyWorkspace: () => workspacePath ? copyPathToClipboard(workspacePath) : undefined,
      draft: composerDraft, hasWorkspace: Boolean(workspacePath),
      parallel: () => { setOrchestrationError(null); setOrchestrationOpen(true); },
      send: () => submitComposerDraft(), sending: composerSending,
      shortcut: shortcutKeys("composer.send"), stop: () => stopActiveChatRun(),
    },
    copyText: writeText,
    notify: setActionNotice,
    pane: {
      activePaneId: activeTerminalPaneId, changing: profiles.changing,
      close: (pane) => closeTerminalPane(pane.id),
      copyCwd: (pane) => copyPathToClipboard(pane.cwd),
      focus: (pane) => focusTerminalPane(pane.id),
      hasWorktree: (pane) => Boolean(worktreeForPaneId(worktrees, String(pane.id))),
      kill: (pane) => terminateTerminalPane(pane),
      removeWorktree: (pane) => closeWorktreePane(pane.id),
      rename: (pane) => renameTerminalPane(pane),
      restart: (pane) => restartTerminalPane(pane),
    },
    setContextMenu,
    tray: {
      activeMode: utilityTrayMode, activePaneState: activeTerminalPane?.state ?? null,
      activeSurface: agentSurfaceMode === "terminal",
      closePane: () => activeTerminalPane ? closeTerminalPane(activeTerminalPane.id) : undefined,
      createShell: () => createTerminalPane(defaultTerminalLaunchProfile()),
      hasActivePane: Boolean(activeTerminalPane), hasWorkspace: Boolean(workspacePath),
      hide: () => setAgentSurfaceMode("chat"),
      killPane: () => activeTerminalPane ? terminateTerminalPane(activeTerminalPane) : undefined,
      launchProfileChanging: profiles.changing,
      restartPane: () => activeTerminalPane ? restartTerminalPane(activeTerminalPane) : undefined,
      show: (nextMode) => { setUtilityTrayMode(nextMode); setAgentSurfaceMode("terminal"); },
    },
  });
  const terminalPaneContextMenuItems = appMenuAssembly.terminalPaneContextMenuItems;
  const utilityTrayTabContextMenuItems = appMenuAssembly.utilityTrayTabContextMenuItems;
  const browserContextMenuItems = appMenuAssembly.browserContextMenuItems;
  const composerContextMenuItems = appMenuAssembly.composerContextMenuItems;
  const openComposerAddMenu = appMenuAssembly.openComposerAddMenu;

  const activeTerminalPaneLabelForCommands = activePaneDisplayLabel(terminalPanes, activeTerminalPane);
  const commandPaletteNavigation = {
    drawerModes: DRAWER_MODES,
    editorTabs,
    files: searchableFiles,
    onFocusWorktree: (paneId: number) => {
      setAgentSurfaceMode("terminal");
      void focusTerminalPane(paneId);
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
    onClear: () => void clearActiveTerminal(),
    onClose: () => { if (activeAgentSessionHandle) void activeAgentSessionHandle.close(); },
    onCreatePane: (profile: LaunchProfile) => void createTerminalPane(profile),
    onCreateWorktreePane: (profile: LaunchProfile) => void createWorktreePane(profile),
    onFind: () => terminalFind.setOpen(true),
    onKill: (pane: ManagedTerminalPane) => void terminateTerminalPane(pane),
    onRemoveWorktree: (paneId: number) => void closeWorktreePane(paneId),
    onRestart: (pane: ManagedTerminalPane) => void restartTerminalPane(pane),
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
    onFindEditor: openEditorSearch,
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
    onOpenSession: (projectPath: string, sessionId: string) => void switchProjectSession(projectPath, sessionId),
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
      runAppCommand: runComposerAppCommand,
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
    closeProject: async (projectPath) => { await closeProjectDirect(projectPath); },
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
    openWorkspace: async (path) => { await openWorkspaceDirect(path); },
    saveEditorFile: () => saveEditorFile(),
    setEditorTabs,
  });

  saveEditorFileRef.current = saveEditorFile;
  openEditorSearchRef.current = openEditorSearch;
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
    focusPane: (paneId) => focusTerminalPane(paneId, "agent"),
    getWorkspacePath: () => workspacePathRef.current,
    openFile: (root, path) => requestOpenEditorFile(
      fileTreeNodeFromPath(`${root}/${path}`, "file"),
      { focusEditor: true },
      "agent",
    ),
    createShell: () => createTerminalPane(defaultTerminalLaunchProfile(), "agent"),
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
    openWorkspace: (folder, profile) => openWorkspaceDirect(folder, profile),
    pickWorkspace,
    refreshSecretPresence: (settings) => { void refreshConnectionSecretPresence(settings); },
    refs: {
      activeFiles: activeFilesByWorkspaceRef,
      activeSessions: activeSessionByProjectRef,
      aiConnectionSettings: aiConnectionSettingsRef,
      browserProjects: browser.projectRecordsRef,
      browserSessions: browser.sessionRecordsRef,
      chatConversations: chatConversationsRef,
      composerHarness: composerHarnessBySessionRef,
      openProjects: openProjectsRef,
      paneLayouts: paneLayoutsBySessionRef,
      projectSessions: projectSessionsRef,
      recentProjects: recentProjectsRef,
      scopedSettings: scopedSettingsRef,
      sessionSnapshots: sessionEditorSnapshotsRef,
      store: storeRef,
    },
    sendResize: sendTerminalResize,
    setters: {
      setActiveSessions: setActiveSessionByProjectState,
      setAgentActivity: setAgentActivityEvents,
      setAiConnectionSettings,
      setBrowserProjects: browser.setProjectRecords,
      setBrowserSessions: browser.setSessionRecords,
      setChatConversations,
      setCommandPaletteSources,
      setComposerHarness: setComposerHarnessBySession,
      setKeybindingOverrides,
      setKeybindings: setActiveKeybindingOverrides,
      setNotificationsEnabled,
      setOpenProjects,
      setPaneLabels: setPaneLabelsBySession,
      setPaneTranscripts,
      setProjectSessions,
      setRecentProjects,
      setScopedSettings,
      setTheme: setAppTheme,
      setWorktrees,
    },
  });
  const initWorkspace = workspaceBootstrapController.initWorkspace;

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
      await initWorkspace();
      setCrashNotice(crashRecoveryMessage(deriveCrashRecovery(staleLock, openProjectsRef.current.length)));
      window.addEventListener("beforeunload", () => { void invoke("end_session_clean").catch(() => {}); });
    },
  });

  const terminalRuntimeEventHandlers = createTerminalRuntimeEventHandlers({
    activePaneId: activeTerminalPaneIdRef, activeSessionForProject,
    approvalMode: agentApprovalMode, contextForPaneId: paneContextForPaneId,
    detectLocalServer: detectLocalDevServerFromSnapshot,
    intentionallyTerminatedPaneIds: intentionallyTerminatedPaneIdsRef.current,
    ipcSampleCounter, latest, notificationsEnabled: notificationsEnabledRef,
    notifyBackgroundExit, now: Date.now, persistTranscript: persistPaneTranscript,
    projectStatus: projectStatusForRoot, recordActivity: recordAgentActivity,
    recordIpcPayload: recordIpcPayloadBytes, renderPerf: renderPerfRef,
    requestPaint: () => requestTerminalPaintRef.current(), setBackgroundExits,
    setError: setLaunchError, setPaneState, snapshotText: terminalSnapshotText,
    snapshots: terminalSnapshotsRef, updateProjectStatus: updateOpenProjectStatus,
    updateSessionStatus, workspacePath: workspacePathRef,
  });

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
  const sourceHostToolStatus = repoLocation?.kind === "github" ? sourceControlStatus?.gh : sourceControlStatus?.glab;
  const sourceRepoStatusTitle = sourceRepoStatusTitleFor(repoLocation, sourceHostToolStatus);
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
    setComposerApprovalMode,
    switchLaunchProfile: profiles.switchLaunchProfile,
    updateScopedSetting,
  });

  const settingsConnectionActions = createSettingsConnectionActionsController({
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
        titlebar: <AppTitlebar
        activeSessionTitle={activeSessionTitle}
        hasWorkspace={Boolean(workspacePath)}
        layout={renderedWorkbenchLayout}
        primarySurfaceLabel={primarySurfaceLabel}
        primarySurfaceState={primarySurfaceState}
        primarySurfaceStatusLabel={primarySurfaceStatusLabel}
        sideDrawerOpen={!sideDrawerCollapsed}
        terminalOpen={agentSurfaceMode === "terminal"}
        toolMode={toolTrayMode}
        toolsOpen={renderedWorkbenchLayout !== "hidden"}
        onCreateChat={() => { if (workspacePath) void createProjectSession(workspacePath); }}
        onLayoutChange={setWorkbenchLayout}
        onOpenCommandPalette={commandPalette.openDialog}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenWorkspace={() => { if (workspacePath) void openPath(workspacePath); }}
        onResetInterface={resetInterface}
        onToggleSideDrawer={() => setSideDrawerCollapsed((collapsed) => !collapsed)}
        onToggleTerminal={() => void toggleRawTerminal()}
        onToggleTools={() => setWorkbenchLayout(renderedWorkbenchLayout === "hidden" ? workbenchLayout === "hidden" ? "right" : workbenchLayout : "hidden")}
        onToolModeChange={setToolTrayMode}
      />,
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
          onProjectContextMenu: (event, project) => openContextMenu(event, projectRailContextMenuItems(project)),
          onSelectProject: (path) => void requestOpenWorkspace(path),
          onSelectSession: (path, sessionId) => void switchProjectSession(path, sessionId),
          onSessionContextMenu: (event, path, session) => openContextMenu(event, projectSessionContextMenuItems(path, session)),
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
            approvalChange: setComposerApprovalMode,
            layoutChange: setWorkbenchLayout,
            openFolder: () => pickWorkspace(),
            refreshFiles: refreshFileTree,
            setSurfaceMode: setAgentSurfaceMode,
            toggleRawTerminal,
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
          onWorkspaceContextMenu: (event) => openContextMenu(event, workspaceContextMenuItems()),
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
            gitFileContextMenu: (event, file) => openContextMenu(
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
            find: openEditorSearch,
            onChange: setEditorText,
            onCreateEditor: restoreEditorView,
            onUpdate: handleEditorUpdate,
            openContextMenu: (kind, event) => openContextMenu(
              event, kind === "diff" ? diffContextMenuItems() : editorContextMenuItems(),
            ),
            openDiff: (line = null) => void openDiffFile(line),
            openExternally: () => void openSelectedFileExternally(),
            overwrite: () => void overwriteSelectedFile(),
            reload: () => void reloadSelectedFileFromDisk(),
            runDiffAction: (action) => { if (diffReview) void runGitFileAction(action, diffReview.file); },
            save: () => void saveEditorFile(),
            selectTab: (tab) => void requestOpenEditorFile(tab, { focusEditor: true }),
            tabContextMenu: (event, tab) => openContextMenu(event, editorTabContextMenuItems(tab)),
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
          contextMenu: (event) => openContextMenu(event, browserContextMenuItems()),
          openExternal: openUrl,
        })} />

        <AgentConversationPanel
          surfaceMode={agentSurfaceMode}
          chat={{
            conversation: activeChatConversation,
            events: selectedAgentActivityLog,
            hidden: false,
            onSuggestion: (draft) => setComposerLocalState(activeComposerHarnessKey, draft, composerHistory),
            onRetry: (prompt) => void submitComposerDraft(prompt),
            onApprovalDecision: (message, decision) => void resolveChatApproval(message, decision),
            onToggleBookmark: toggleChatMessageBookmark,
            onForkMessage: (message) => void forkChatFromMessage(message),
            onReviewFile: (path) => void reviewRunCardFile(path),
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
            onApprovalChange: (mode) => void setComposerApprovalMode(mode),
            onAttachMention: (file) => {
              setComposerLocalState(activeComposerHarnessKey, composerDraft.replace(/@[^\s@]*$/, ""), composerHistory);
              void attachWorkspaceFileToComposer(file);
            },
            onClearGoal: () => void setComposerGoal(""),
            onContextMenu: (event) => openContextMenu(event, composerContextMenuItems()),
            onDismissNotice: () => setComposerNotice(null),
            onDraftChange: (draft) => {
              setComposerLocalState(activeComposerHarnessKey, draft, composerHistory);
              setComposerHistoryIndex(null);
            },
            onGoalChange: (goal) => void setComposerGoal(goal),
            onGoalCommit: () => void setComposerGoal(activeComposerHarness.goal, { log: true }),
            onManageModels: () => setSettingsOpen(true),
            onNextHistory: showNextComposerHistory,
            onOpenAddMenu: openComposerAddMenu,
            onPasteImage: () => void pasteComposerImage(),
            onPreviousHistory: showPreviousComposerHistory,
            onReasoningChange: setComposerReasoningEffort,
            onRemoveAttachment: (attachment) => void removeComposerAttachmentById(attachment),
            onReviewContext: () => void reviewComposerContext(),
            onRuntimeChange: setComposerRuntime,
            onStop: () => void stopActiveChatRun(),
            onSubmit: () => void submitComposerDraft(),
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
          onCreate={(profile) => void createTerminalPane(profile)} onFocus={(paneId) => void focusTerminalPane(paneId)}
          onKill={() => { if (activeTerminalPane) void terminateTerminalPane(activeTerminalPane); }}
          onOpenFolder={() => void pickWorkspace({ openTerminal: true })}
          onOpenTab={(mode) => void openUtilityTray(mode)}
          onPaneContextMenu={(event, pane) => openContextMenu(event, terminalPaneContextMenuItems(pane))}
          onPaste={(text) => { invoke("paste", { text }).catch(() => {}); }}
          onProfileChange={(profileId) => {
            void profiles.switchTerminalProfile(profiles.resolveProfile(profileId));
          }}
          onRename={(pane) => void renameTerminalPane(pane)}
          onResizeStart={(event) => { setAgentSurfaceMode("terminal"); beginUtilityTrayResize(event); }}
          onRestart={() => { if (activeTerminalPane) void restartTerminalPane(activeTerminalPane); }}
          onStartShell={() => void createTerminalPane(defaultTerminalLaunchProfile())}
          onTabContextMenu={(event, mode) => openContextMenu(event, utilityTrayTabContextMenuItems(mode))}
          onTerminalContextMenu={(event) => openContextMenu(event, terminalContextMenuItems())}
          onToggleVisibility={toggleUtilityTrayVisibility}
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
          openAgentConnection,
          openSourceControlLink: (url) => openUrl(url).catch(() => {}),
          refreshAgentConnections,
          resetLayout: resetInterface,
          saveConnectionSecret,
          saveConnectionSettings: saveAiConnectionSettings,
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
      <TranscriptsModal
        activeTranscriptId={openTranscriptId}
        onClose={() => setTranscriptsOpen(false)}
        onSelect={setOpenTranscriptId}
        open={transcriptsOpen}
        projectId={workspacePath}
        projectSessionId={activeSessionId}
        transcripts={paneTranscripts}
      />
      <AppRuntimeDialogs
        notices={{
          actionNotice,
          canUseShellProfile: canUseShellProfile(profiles.changing, profiles.launchProfile.id),
          crashNotice, launchError,
          onDismissAction: () => setActionNotice(null), onDismissCrash: () => setCrashNotice(null),
          onOpenFolder: () => void pickWorkspace(),
          onUseShellProfile: () => {
            const shell = findShellProfile(LAUNCH_PROFILES);
            if (shell) void profiles.switchLaunchProfile(shell);
          },
        }}
        orchestration={{
          approvalMode: activeComposerHarness.approvalMode, error: orchestrationError,
          ...deriveOrchestrationDialogState({
            activeSessionId, conversations: chatConversations,
            sessions: projectSessions, workspacePath,
          }),
          launching: orchestrationLaunching, open: orchestrationOpen,
          onClose: () => {
            if (orchestrationLaunching) return;
            setOrchestrationOpen(false);
            setOrchestrationError(null);
          },
          onLaunch: (children) => void launchOrchestration(children), projectPath: workspacePath ?? "",
          provider: activeComposerProvider ?? activeChatConversation.provider,
        }}
      />
      {contextMenuHost.element}
      {commandPalette.open ? (
        <SearchCommandDialog
          commands={visiblePaletteCommands}
          activeIndex={commandPalette.activeIndex}
          query={commandPalette.query}
          shortcut={shortcutKeys("chrome.command-palette")}
          loading={chatSearchLoading}
          error={chatSearchError}
          inputRef={commandPalette.inputRef}
          onClose={commandPalette.close}
          onQueryChange={commandPalette.setQuery}
          onKeyDown={(event) => commandPalette.onKeyDown(event, visiblePaletteCommands)}
          onActiveIndexChange={commandPalette.setActiveIndex}
          onRun={commandPalette.run}
        />
      ) : null}
      <QuickOpenDialog
        controller={quickOpen}
        shortcut={shortcutKeys("workspace.quick-open")}
        workspacePath={workspacePath}
        onOpenFile={(file) => void requestOpenEditorFile(file, { focusEditor: true })}
      />
      {pendingNavigation && selectedFile ? (
        <DraftNavigationDialog
          fileName={selectedFile.name}
          error={draftDialogError}
          saving={editorSaving}
          onCancel={cancelPendingNavigation}
          onDiscard={() => void discardDraftAndContinue()}
          onSave={() => void saveDraftAndContinue()}
        />
      ) : null}
      <StatusBar
        workspaceName={activeWorkspaceName}
        primarySurfaceState={primarySurfaceState}
        primarySurfaceLabel={primarySurfaceLabel}
        primarySurfaceStatusLabel={primarySurfaceStatusLabel}
        repoLabel={repoLocation ? sourceRepoStatusLabel(repoLocation) : null}
        repoTitle={sourceRepoStatusTitle}
        onOpenRepo={() => {
          if (repoLocation) void openUrl(buildRepoUrl(repoLocation)).catch(() => {});
        }}
        surfaceMode={agentSurfaceMode}
        utilityLabel={utilityTrayStatusLabel}
      />
        </>,
      }}
    />
  );
}

export default App;
