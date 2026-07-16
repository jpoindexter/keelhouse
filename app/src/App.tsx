import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
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
import type { UtilityTrayMode } from "./BottomUtilityTabs";
import { BottomUtilityTray } from "./BottomUtilityTray";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import { FilesDock, SourceControlDock } from "./WorkbenchDocks";
import { WorkbenchResizers } from "./WorkbenchResizers";
import { DRAWER_MODES, drawerTitleFor } from "./drawerModes";
import { EditorChrome } from "./EditorChrome";
import { EditorDiffView } from "./EditorDiffView";
import { EditorCodeSurface } from "./EditorCodeSurface";
import { AppRuntimeDialogs } from "./AppRuntimeDialogs";
import { DEFAULT_BROWSER_PREVIEW_URL } from "./browserPreview";
import { useBrowserPreviewController } from "./useBrowserPreviewController";
import { resolveBrowserDevServerDetection } from "./browserDevServerDetection";
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
import { createTerminalClipboardActions } from "./terminalClipboardActions";
import { useContextMenuHost } from "./useContextMenuHost";
import type { EditorFileLoadState } from "./editorFileLoadState";
import { createEditorFileWorkflow } from "./editorFileWorkflow";
import {
  removeEditorBuffersWithin,
  removeEditorTabsWithin,
  retargetEditorBuffers,
  retargetEditorTabs,
  upsertEditorTab,
} from "./editorTabs";
import {
  LAUNCH_PROFILES,
  defaultTerminalLaunchProfile,
} from "./launchProfiles";
import type { LaunchProfile } from "./launchProfiles";
import { useLaunchProfileController } from "./useLaunchProfileController";
import { resolveScopedSetting } from "./scopedSettings";
import {
  composerHistoryAt,
  nextComposerHistoryIndex,
  previousComposerHistoryIndex,
} from "./agentComposer";
import type { ComposerAppCommand } from "./agentComposer";
import { runComposerAppCommand as runComposerAppCommandWithContext } from "./composerAppCommands";
import { submitComposerDraft as submitComposerDraftWithContext } from "./composerSubmission";
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
import {
  normalizeTerminalPaneLabel,
  terminalPaneLabelForDisplay,
} from "./terminalPane";
import type { TerminalPaneState } from "./terminalPane";
import { useGitStatus } from "./useGitStatus";
import { useGitDiffReview } from "./useGitDiffReview";
import { useShellLayout, type SideDrawerMode } from "./useShellLayout";
import { useAppChromeState } from "./useAppChromeState";
import { useSettingsRuntimeStatus } from "./useSettingsRuntimeStatus";
import { useSyncRef } from "./useSyncRef";
import { loadWorkspaceBootstrap } from "./workspaceBootstrap";
import { terminalSnapshotText } from "./terminalTranscript";
import { SettingsModal } from "./SettingsModal";
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
import { buildSnapshot, createRenderPerfState, recordIpcPayloadBytes } from "./renderPerf";
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
import { createTerminalProcessActionsController } from "./terminalProcessActionsController";
import { createSessionCheckpointActions } from "./sessionCheckpointActions";
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
import { createWorkspaceOpenActions } from "./workspaceOpenActions";
import { createWorkspaceOpenLifecycleController } from "./workspaceOpenLifecycleController";
import {
  createWorkspaceOpenTargetController,
} from "./workspaceOpenTargetController";
import { TranscriptsModal } from "./TranscriptsModal";
import { useTerminalFind } from "./useTerminalFind";
import {
  applyChatRunEnvelope,
  chatProviderLabel,
} from "./chatConversation";
import type { ChatMessage, ChatProvider } from "./chatConversation";
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
import { ToolTrayTabs } from "./ToolTrayTabs";
import type { FileTreeNode } from "./fileTreeTypes";
import { createWorkspaceFileActions } from "./workspaceFileActions";
import { StatusBar } from "./StatusBar";
import {
  type OrchestrationChildDraft,
} from "./chatOrchestration";
import { launchOrchestration as launchOrchestrationWithContext } from "./orchestrationLaunch";
import { createOrchestrationChildActions } from "./orchestrationChildActions";
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
import { createTerminalPaneActionsController } from "./terminalPaneActionsController";
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
const basename = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? path;
const fileNodeFromPath = (path: string, kind: FileTreeNode["kind"]): FileTreeNode => ({
  id: path, kind, name: basename(path), path,
});
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
  const {
    activeFilesByWorkspaceRef, captureCurrentEditorBuffer, captureCurrentEditorViewState,
    captureSessionSnapshot: captureEditorSessionSnapshot,
    closeActiveEditorTabRef, editorBuffersRef, editorBytes, editorCursor, editorError,
    editorLoadSeq, editorLoading, editorModifiedMs, editorRecoveryError, editorSaving,
    editorTabs, editorText, editorViewRef, editorViewStatesRef, fileOpError,
    openEditorSearchRef, pendingEditorFocusRef, resetEditor, restoredActiveFileWorkspaceRef,
    restoreSessionSnapshot: restoreEditorSessionSnapshot, saveEditorFileRef,
    savedEditorText, selectedFile, selectedFileRef,
    sessionEditorSnapshotsRef, setEditorBufferRevision, setEditorBytes, setEditorCursor,
    setEditorError, setEditorLoading, setEditorModifiedMs, setEditorRecoveryError,
    setEditorSaving, setEditorTabs, setEditorText, setFileOpError, setSavedEditorText,
    setSelectedFile,
  } = useEditorSessionController();
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
  const composerMentionQuery = composerDraft.match(/(?:^|\s)@([^\s@]*)$/)?.[1] ?? null;
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
  const primarySurfaceState: TerminalPaneState = activeChatConversation.activeRunId ? "starting" : "idle";
  const primarySurfaceLabel = "Codex";
  const primarySurfaceStatusLabel = activeChatConversation.activeRunId ? "Working" : "Ready";
  const utilityTrayStatusLabel = utilityTrayMode.charAt(0).toUpperCase() + utilityTrayMode.slice(1);


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

  const terminalPaneLabel = (pane: ManagedTerminalPane, index: number) => terminalPaneLabelForDisplay(pane.label, pane.profile.label, index);

  const detectLocalDevServerFromSnapshot = (paneId: number, snapshot: Snapshot) => {
    const context = paneContextForPaneId(paneId);
    const detection = resolveBrowserDevServerDetection({
      approvalMode: (root, sessionId) =>
        composerHarnessBySessionRef.current[composerHarnessSessionKey(root, sessionId)]?.approvalMode ?? "ask",
      context,
      fallbackPanes: terminalPanesRef.current,
      fallbackRoot: workspacePathRef.current,
      fallbackSessionId: activeSessionForProject,
      now: Date.now,
      paneId,
      previous: browser.detectedServerRef.current,
      text: terminalSnapshotText(snapshot),
    });
    if (!detection) return;
    browser.setDetectedServer(detection.server);
    recordAgentActivity(detection.handle, {
      kind: "browser", label: "Detected dev server", detail: detection.server.url,
      target: detection.server.url, outputRef: "terminal", status: "complete",
    });
  };

  const captureCurrentSessionSnapshot = () => {
    const root = workspacePathRef.current;
    const sessionId = activeProjectSessionId(activeSessionByProjectRef.current, projectSessionsRef.current, root);
    if (!root || !sessionId) return;
    captureEditorSessionSnapshot({
      key: sessionSnapshotKey(root, sessionId),
      persistPaneLayout: persistPaneLayoutForSession,
      persistSnapshots: persistSessionEditorSnapshots,
      root,
      sessionId,
    });
  };

  const restoreSessionEditorSnapshot = (root: string, sessionId: string | null) => {
    restoreEditorSessionSnapshot({
      key: sessionId ? sessionSnapshotKey(root, sessionId) : null,
      openFile: openEditorFileDirect,
    });
  };

  const {
    applyOpenedWorkspaceTarget, prepareAndOpenWorkspaceTarget,
  } = createWorkspaceOpenTargetController({
    activePaneForSession, activePaneIds: activeTerminalPaneByContextRef,
    activeSessions: activeSessionByProjectRef,
    createPane: (target, paneProfile, environment) => invoke<OpenPaneResponse>("create_pane", {
      path: target, profile: paneProfile, environment,
    }),
    defaultProfileId: defaultTerminalLaunchProfile().id,
    focusPane: (paneId) => invoke("focus_pane", { paneId }),
    getEnvironment: (target) => connectionEnvironmentInputs(aiConnectionSettingsRef.current, target),
    getSurfaceMode: () => agentSurfaceMode, latest, now: Date.now,
    openWorkspace: (target, firstProfile, environment) => invoke("open_workspace", {
      path: target, profile: firstProfile, environment,
    }),
    paneLayouts: paneLayoutsBySessionRef, panesByContext: terminalPanesByContextRef,
    panesForSession: terminalPanesForSession,
    requestPaint: () => requestTerminalPaintRef.current(), resetEditor,
    resolveProfile: profiles.resolveProfile,
    resolveWorkspace: (target) => invoke("resolve_workspace", { path: target }),
    restoredActiveFileWorkspace: restoredActiveFileWorkspaceRef,
    savedLabelForSlot: savedPaneLabelForSlot,
    scheduleResize: () => setTimeout(sendTerminalResize, 0), sessions: projectSessionsRef,
    setFocusedPane: setFocusedTerminalPane, setLaunchError, setManagedPanes: setManagedTerminalPanes,
    setWorkspacePath, snapshots: terminalSnapshotsRef, workspacePath: workspacePathRef,
  });

  const {
    completeOpenedWorkspace, handleWorkspaceOpenError,
  } = createWorkspaceOpenLifecycleController({
    clearCurrentWorkspace: (path) => {
      if (workspacePathRef.current !== path) return;
      setManagedTerminalPanes([]); setFocusedTerminalPane(null); setWorkspacePath(null);
      setFileTree([]); resetEditor();
    },
    deleteProjectChats: deleteDurableProjectChats,
    logHealthEvent: (message) => invoke("log_health_event", { message }),
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
  });

  const workspaceOpenActions = createWorkspaceOpenActions({
    applyOpened: applyOpenedWorkspaceTarget,
    captureCurrentSession: captureCurrentSessionSnapshot,
    clearBackgroundExits: (path) => {
      setBackgroundExits((exits) => clearBackgroundExitsForProject(exits, path));
    },
    completeOpened: completeOpenedWorkspace,
    confirmDiscard: (count) => confirmDialog(
      `Switch workspace and discard ${count} unsaved editor tabs?`,
    ),
    dirtyTabPaths, editorDirty, editorTabs,
    flushComposer: flushActiveComposerLocalState,
    getDefaultProfile: () => profiles.launchProfileRef.current,
    getPreviousActivePaneId: () => activeTerminalPaneIdRef.current,
    getPreviousPanes: () => terminalPanesRef.current,
    getPreviousRoot: () => workspacePathRef.current,
    getSelectedFilePath: () => selectedFileRef.current?.path ?? null,
    getStore: () => storeRef.current,
    handleError: handleWorkspaceOpenError,
    openEditorFile: (file) => openEditorFileDirect(file),
    openTarget: prepareAndOpenWorkspaceTarget,
    setFocusedPane: setFocusedTerminalPane,
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

  const openChatSearchResult = async (result: ChatSearchViewResult) => {
    const session = projectSessionsRef.current[result.projectPath]?.find((item) => item.id === result.sessionId);
    if (!session) {
      setChatSearchError("This chat's navigation metadata is unavailable. Open its project and try again.");
      return;
    }
    if (session.archived) setShowArchivedSessions(true);
    await switchProjectSession(result.projectPath, result.sessionId);
    setFocusedChatMessageId(result.messageId ?? null);
    setSideDrawerMode("projects");
  };

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

  const finalizeCreatedTerminalPane = async (
    root: string,
    nextPanes: ManagedTerminalPane[],
    profile: LaunchProfile,
  ) => {
    profiles.setTerminalProfile(profile);
    await storeRef.current?.set("terminalLaunchProfile", profile);
    await storeRef.current?.save();
    setLaunchError(null);
    setTimeout(sendTerminalResize, 0);
    await updateOpenProjectStatus(root, projectStatusForRoot(root));
    await updateActiveSessionStatus(root, terminalPaneProjectStatus(nextPanes));
  };

  const pickWorkspace = async (options: { openTerminal?: boolean } = {}) => {
    const dir = await open({ directory: true });
    if (typeof dir !== "string") return false;
    const opened = await requestOpenWorkspace(dir);
    if (!opened) return false;
    if (options.openTerminal) return createTerminalPane(defaultTerminalLaunchProfile());
    return true;
  };

  const terminalProcessActionsController = createTerminalProcessActionsController({
    approvalMode: () => agentApprovalMode,
    gateAction: async (action, handle) => (await gateAppAction(action, handle)).decision,
    getActiveDescriptor: () => activeAgentSessionDescriptor,
    getActiveHandle: () => activeAgentSessionHandle,
    getActivePane: () => activeTerminalPane,
    getChanging: () => profiles.changing, getPanes: terminalPanesForSession,
    getProjectStatus: projectStatusForRoot, getSessionId: activeSessionForProject,
    getWorkspacePath: () => workspacePathRef.current,
    intentionallyTerminatedPaneIds: intentionallyTerminatedPaneIdsRef.current,
    latest, now: Date.now,
    recordActivity: recordAgentActivity,
    requestPaint: () => requestTerminalPaintRef.current(),
    restartPane: async (root, pane) => (await invoke<OpenPaneResponse>("restart_pane", {
      path: root, paneId: pane.id, profile: pane.profile,
      environment: connectionEnvironmentInputs(aiConnectionSettingsRef.current, root),
    })).paneId,
    scheduleResize: () => setTimeout(sendTerminalResize, 0),
    setChanging: profiles.setChanging,
    setComposerError, setLaunchError,
    setPaneExited: (paneId) => setPaneState(paneId, "exited", null),
    setSessionPanes: setSessionTerminalPanes,
    snapshots: terminalSnapshotsRef, statusForPanes: terminalPaneProjectStatus,
    terminatePane: (paneId) => invoke("terminate_pane", { paneId }),
    updateProjectStatus: updateOpenProjectStatus,
    updateSessionStatus: (root, status) => updateActiveSessionStatus(root, status),
  });
  const interruptActivePane = terminalProcessActionsController.interruptActivePane;
  const terminateTerminalPane = terminalProcessActionsController.terminateTerminalPane;
  const restartTerminalPane = terminalProcessActionsController.restartTerminalPane;

  const runComposerAppCommand = async (command: ComposerAppCommand): Promise<boolean> => {
    return runComposerAppCommandWithContext(command, {
      selectedFilePath: selectedFile?.path ?? null,
      terminalLabel: activeTerminalPaneLabel,
      gateAction: (action) => gateAppAction(action, activeAgentSessionHandle),
      saveFile: saveEditorFile,
      openSearch: openEditorSearch,
      pickWorkspace,
      clearTerminal: clearActiveTerminal,
      setError: setComposerError,
      setNotice: setComposerNotice,
    });
  };

  const submitComposerDraft = async (draftOverride?: string) => {
    await submitComposerDraftWithContext({
      sending: composerSending,
      activeRunId: activeChatConversation.activeRunId,
      draft: composerDraft,
      history: composerHistory,
      workspacePath: workspacePathRef.current,
      chatId: activeComposerHarnessKey,
      activeSessionId,
      harness: activeComposerHarness,
      settings: aiConnectionSettingsRef.current,
      activeProvider: activeComposerProvider,
      activeConversation: activeChatConversation,
      conversations: chatConversationsRef.current,
      sessions: projectSessionsRef.current,
      activeSessions: activeSessionByProjectRef.current,
      resolveProfileLabel: (id) => profiles.resolveProfile(id).label,
      runAppCommand: runComposerAppCommand,
      updateConversation: updateChatConversation,
      persistSessions: persistProjectSessions,
      recordActivity: (event) => recordAgentActivity(activeAgentSessionHandle, event),
      setError: setComposerError,
      setNotice: setComposerNotice,
      setSending: setComposerSending,
      setLocalState: setComposerLocalState,
      setHistoryIndex: setComposerHistoryIndex,
      updateHarness: updateActiveComposerHarness,
    }, draftOverride);
  };

  const stopActiveChatRun = async () => {
    const runId = activeChatConversation.activeRunId;
    if (!runId) return;
    try {
      await invoke("stop_chat_run", { runId });
    } catch (err) {
      setComposerError(String(err));
    }
  };

  const launchOrchestration = async (drafts: OrchestrationChildDraft[]) => {
    await launchOrchestrationWithContext(drafts, {
      projectPath: workspacePathRef.current,
      sessions: projectSessionsRef.current,
      activeSessions: activeSessionByProjectRef.current,
      conversations: chatConversationsRef.current,
      harnessRecords: composerHarnessBySessionRef.current,
      settings: aiConnectionSettingsRef.current,
      chatIdForSession: composerHarnessSessionKey,
      gateAction: (action) => gateAppAction(action),
      updateConversation: updateChatConversation,
      replaceConversations: setChatConversations,
      persistHarnessRecords: persistComposerHarnessRecords,
      persistSessions: persistProjectSessions,
      setLaunching: setOrchestrationLaunching,
      setError: setOrchestrationError,
      setOpen: setOrchestrationOpen,
      setNotice: setActionNotice,
    });
  };

  const orchestrationChildActions = createOrchestrationChildActions({
    conversations: chatConversationsRef, now: Date.now,
    removeWorktree: (input) => invoke("remove_project_worktree", input),
    setNotice: setActionNotice, stopRun: (runId) => invoke("stop_chat_run", { runId }),
    updateConversation: updateChatConversation,
    updateSessionMetadata: (projectPath, sessionId, orchestration) =>
      updateProjectSessionMetadata(projectPath, sessionId, { orchestration }),
  });
  const removeChildWorktree = orchestrationChildActions.removeChildWorktree;
  const returnChildResult = orchestrationChildActions.returnChildResult;
  const stopChildChatRun = orchestrationChildActions.stopChildRun;

  const resolveChatApproval = async (
    message: ChatMessage,
    decision: "accept" | "acceptForSession" | "decline",
  ) => {
    const runId = message.approvalRunId ?? activeChatConversation.activeRunId;
    if (!runId || message.approvalRequestId == null) return;
    if (activeChatConversation.activeRunId !== runId) {
      setComposerError("That approval belongs to a run that is no longer active.");
      return;
    }
    try {
      await invoke("respond_chat_approval", {
        runId,
        requestId: message.approvalRequestId,
        decision,
      });
    } catch (err) {
      setComposerError(String(err));
    }
  };

  const showPreviousComposerHistory = () => {
    const nextIndex = previousComposerHistoryIndex(composerHistory, composerHistoryIndex);
    if (nextIndex == null) return;
    setComposerHistoryIndex(nextIndex);
    setComposerLocalState(activeComposerHarnessKey, composerHistoryAt(composerHistory, nextIndex), composerHistory);
  };

  const showNextComposerHistory = () => {
    const nextIndex = nextComposerHistoryIndex(composerHistory, composerHistoryIndex);
    setComposerHistoryIndex(nextIndex);
    setComposerLocalState(activeComposerHarnessKey, nextIndex == null ? "" : composerHistoryAt(composerHistory, nextIndex), composerHistory);
  };

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

  const terminalPaneActionsController = createTerminalPaneActionsController({
    activeAgentDescriptor: activeAgentSessionDescriptor, activePaneId: activeTerminalPaneIdRef,
    activePaneIds: activeTerminalPaneByContextRef,
    closePane: async (paneId) =>
      (await invoke<{ activePaneId: number | null }>("close_pane", { paneId })).activePaneId,
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
    getWorkspacePath: () => workspacePathRef.current ?? workspacePath,
    getWorktrees: () => worktrees,
    intentionallyTerminatedPaneIds: intentionallyTerminatedPaneIdsRef.current,
    latest, now: Date.now,
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
    recordCreated: recordCreatedPaneActivity,
    recordCreatedWorktree: recordCreatedWorktreePaneActivity,
    removeWorktree: (root, worktree) => invoke("remove_project_worktree", {
      root, worktreePath: worktree.path, branch: worktree.branch,
    }),
    requestPaint: () => requestTerminalPaintRef.current(), savedLabel: savedPaneLabelForSlot,
    scheduleResize: () => setTimeout(sendTerminalResize, 0), selection,
    setChanging: profiles.setChanging, setError: setLaunchError,
    setFocusedPane: setFocusedTerminalPane, setSessionPanes: setSessionTerminalPanes,
    snapshots: terminalSnapshotsRef, statusForPanes: terminalPaneProjectStatus,
    updateProjectStatus: updateOpenProjectStatus,
    updateSessionStatus: (root, status) => updateActiveSessionStatus(root, status),
  });
  const closeTerminalPane = terminalPaneActionsController.closeTerminalPane;
  const closeWorktreePane = terminalPaneActionsController.closeWorktreePane;
  const createTerminalPane = terminalPaneActionsController.createTerminalPane;
  const createWorktreePane = terminalPaneActionsController.createWorktreePane;
  const focusTerminalPane = terminalPaneActionsController.focusTerminalPane;

  const toggleRawTerminal = async () => {
    if (agentSurfaceMode === "terminal" && utilityTrayMode === "terminal") {
      setAgentSurfaceMode("chat");
      return;
    }
    const root = workspacePathRef.current ?? workspacePath;
    if (!root) {
      setUtilityTrayMode("terminal");
      setAgentSurfaceMode("terminal");
      await pickWorkspace({ openTerminal: true });
      return;
    }
    const sessionId = activeSessionForProject(root);
    const hasTerminal = Boolean(root && sessionId && terminalPanesForSession(root, sessionId).length > 0);
    if (!hasTerminal && !await createTerminalPane(defaultTerminalLaunchProfile())) return;
    setUtilityTrayMode("terminal");
    setAgentSurfaceMode("terminal");
  };

  const openUtilityTray = async (mode: UtilityTrayMode) => {
    if (agentSurfaceMode === "terminal" && utilityTrayMode === mode) {
      setAgentSurfaceMode("chat");
      return;
    }
    if (mode === "terminal") {
      await toggleRawTerminal();
      return;
    }
    setUtilityTrayMode(mode);
    setAgentSurfaceMode("terminal");
  };

  const toggleUtilityTrayVisibility = () => {
    setAgentSurfaceMode((current) => current === "terminal" ? "chat" : "terminal");
  };

  const openAgentConnection = async (providerId: "codex" | "gemini" | "claude") => {
    setSettingsOpen(false);
    const created = await createTerminalPane(profiles.resolveProfile(providerId));
    if (!created) return;
    setUtilityTrayMode("terminal");
    setAgentSurfaceMode("terminal");
  };

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

  const renameTerminalPane = async (pane: ManagedTerminalPane) => {
    const root = workspacePathRef.current;
    const sessionId = activeSessionForProject(root);
    if (!root || !sessionId) return;
    const currentIndex = terminalPanesForSession(root, sessionId).findIndex((item) => item.id === pane.id);
    const current = terminalPaneLabelForDisplay(pane.label, pane.profile.label, currentIndex >= 0 ? currentIndex : pane.slot);
    const value = window.prompt("Pane name or task label", current);
    if (value == null) return;
    const nextLabel = normalizeTerminalPaneLabel(value);
    const nextPanes = terminalPanesForSession(root, sessionId).map((item) =>
      item.id === pane.id ? { ...item, label: nextLabel } : item,
    );
    setSessionTerminalPanes(root, sessionId, nextPanes, pane.id);
    await persistPaneLabel(root, pane.slot, nextLabel);
  };

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

  const projectRailStatus = (project: OpenProject): ProjectRailStatus => {
    const conversations = Object.entries(chatConversations).filter(([key]) => key.startsWith(`${project.path}\n`));
    if (conversations.some(([, conversation]) => conversation.activeRunId)) return "running";
    if (conversations.some(([, conversation]) => conversation.messages[conversation.messages.length - 1]?.role === "error")) return "attention";
    return "exited";
  };

  const projectSessionsFor = (projectPath: string) => projectSessions[projectPath] ?? [];

  const projectSessionStatus = (projectPath: string, session: ProjectSession): ProjectRailStatus => {
    const conversation = chatConversations[`${projectPath}\n${session.id}`];
    if (conversation?.activeRunId) return "running";
    if (conversation?.messages[conversation.messages.length - 1]?.role === "error") return "attention";
    return "exited";
  };

  const visibleOpenProjects = openProjects.length > 0
    ? openProjects
    : workspacePath
      ? [{ path: workspacePath, status: activeProjectStatus() }]
      : [];

  const {
    openDirect: openEditorFileDirect,
    requestOpen: requestOpenEditorFile,
    save: saveEditorFileWithForce,
  } = createEditorFileWorkflow({
    applyState: (state: EditorFileLoadState) => {
      setEditorText(state.text);
      setSavedEditorText(state.savedText);
      setEditorBytes(state.bytes);
      setEditorModifiedMs(state.modifiedMs);
      setEditorError(state.error);
      setEditorRecoveryError(state.recoveryError);
      setEditorCursor(state.cursor);
    },
    beginOpen: (file, focusEditor) => {
      closeDiffReview();
      captureCurrentEditorViewState();
      captureCurrentEditorBuffer();
      pendingEditorFocusRef.current = focusEditor;
      setEditorTabs((tabs) => upsertEditorTab(tabs, file));
      setSelectedFile(file);
      setEditorSaving(false);
    },
    buffers: editorBuffersRef,
    bumpBufferRevision: () => setEditorBufferRevision((value) => value + 1),
    focusEditor: () => editorViewRef.current?.focus(),
    gateAction: (action) => gateAppAction(action),
    getActiveFilePath: () => selectedFileRef.current?.path ?? null,
    getRoot: () => workspacePathRef.current ?? workspacePath,
    getSaveState: () => ({
      bytes: editorBytes,
      dirty: editorDirty,
      file: selectedFile,
      modifiedMs: editorModifiedMs,
      recoveryError: editorRecoveryError,
      root: workspacePathRef.current ?? workspacePath,
      savedText: savedEditorText,
      saving: editorSaving,
      text: editorText,
    }),
    loadSequence: editorLoadSeq,
    onCurrentFile: (focusEditor) => {
      closeDiffReview();
      if (focusEditor) requestAnimationFrame(() => editorViewRef.current?.focus());
    },
    onSaveError: setEditorError,
    onSaveSuccess: (result) => {
      setSavedEditorText(result.content);
      setEditorBytes(result.bytes);
      setEditorModifiedMs(result.modifiedMs);
    },
    persistActiveFile,
    prepareSave: () => { setEditorError(null); setEditorRecoveryError(null); },
    prepareRead: () => {
      setEditorError(null);
      setEditorRecoveryError(null);
      setEditorBytes(null);
      setEditorModifiedMs(null);
      setEditorCursor({ line: 1, column: 1 });
    },
    recordEdit: (file) => recordAgentActivity(activeAgentSessionDescriptor, {
      kind: "file", label: "Edited a file", detail: file.name, status: "complete",
    }),
    setLoading: setEditorLoading,
    setSaving: setEditorSaving,
    viewStates: editorViewStatesRef,
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
      makeFileNode: (path) => fileNodeFromPath(path, "file"),
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
  } = createWorkspaceFileActions({
    editorDirty,
    getRoot: () => workspacePathRef.current ?? workspacePath,
    getSelectedFile: () => selectedFile,
    onOpenFile: async (file) => { await requestOpenEditorFile(file, { focusEditor: true }); },
    onRename: async (node, nextPath, affectedSelectedFile) => {
      setEditorTabs((tabs) => retargetEditorTabs(tabs, node.path, nextPath, basename));
      editorBuffersRef.current = retargetEditorBuffers(editorBuffersRef.current, node.path, nextPath);
      editorViewStatesRef.current = retargetEditorBuffers(editorViewStatesRef.current, node.path, nextPath);
      setEditorBufferRevision((value) => value + 1);
      if (!affectedSelectedFile) return;
      const selectedPath = affectedSelectedFile.path === node.path
        ? nextPath : `${nextPath}${affectedSelectedFile.path.slice(node.path.length)}`;
      selectedFileRef.current = null;
      setSelectedFile(null);
      await openEditorFileDirect({ id: selectedPath, kind: "file", name: basename(selectedPath), path: selectedPath }, { focusEditor: true });
    },
    onDelete: async (node, affectedSelectedFile) => {
      const nextTabs = removeEditorTabsWithin(editorTabs, node.path);
      editorBuffersRef.current = removeEditorBuffersWithin(editorBuffersRef.current, node.path);
      editorViewStatesRef.current = removeEditorBuffersWithin(editorViewStatesRef.current, node.path);
      setEditorTabs(nextTabs);
      setEditorBufferRevision((value) => value + 1);
      if (!affectedSelectedFile) return;
      const nextTab = nextTabs[0] ?? null;
      if (nextTab) {
        selectedFileRef.current = null;
        setSelectedFile(null);
        await openEditorFileDirect(nextTab, { focusEditor: true });
      } else {
        if (workspacePathRef.current) void clearPersistedActiveFile(workspacePathRef.current);
        resetEditor();
      }
    },
    refresh: refreshFileTree,
    setError: setFileOpError,
  });

  const terminalClipboardActions = createTerminalClipboardActions({
    copyText: writeText,
    getActivePaneId: () => activeTerminalPaneIdRef.current,
    getSnapshot: () => latest.current,
    paste: (text) => invoke("paste", { text }),
    readClipboard: readText,
    readTail: async (lines) => activeAgentSessionHandle?.readTail(lines),
    recordActivity: (event) => recordAgentActivity(activeAgentSessionHandle ?? null, event),
    selection,
    selectionText: (snap, snapSelection) => selectionToText(snap.cells, snap.cols, snapSelection),
    sendClearKey: () => invoke("send_key", {
      code: "KeyL", text: null, shift: false, alt: false, ctrl: true, sup: false,
    }),
  });
  const terminalSelectedText = terminalClipboardActions.terminalSelectedText;
  const copyTerminalSelection = terminalClipboardActions.copyTerminalSelection;
  const copyActivePaneTail = terminalClipboardActions.copyActivePaneTail;
  const pasteIntoTerminal = terminalClipboardActions.pasteIntoTerminal;
  const clearActiveTerminal = terminalClipboardActions.clearActiveTerminal;



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
  } = createSessionCheckpointActions({
    gateAction: (action) => gateAppAction(action),
    getDirtyTabPaths: () => dirtyTabPaths,
    getSelectedFile: () => selectedFileRef.current,
    getWorkspacePath: () => workspacePathRef.current,
    onClearBuffers: (paths) => {
      for (const path of paths) delete editorBuffersRef.current[path];
      setEditorBufferRevision((revision) => revision + 1);
    },
    onMetadata: updateProjectSessionMetadata,
    onReconcile: async (activeFile, action) => {
      if (!activeFile || !action) return;
      if (action === "delete") {
        setSelectedFile(null);
        setEditorText("");
        setSavedEditorText("");
        return;
      }
      await openEditorFileDirect(activeFile);
    },
    refreshFiles: refreshFileTree,
    refreshGit: () => refreshGitStatus(),
    setError: setLaunchError,
    setNotice: setActionNotice,
  });

  const projectSessionContextMenuItems = (projectPath: string, session: ProjectSession): ContextMenuItem[] => {
    const sessions = projectSessionsRef.current[projectPath] ?? [];
    const conversation = chatConversationsRef.current[composerHarnessSessionKey(projectPath, session.id)];
    return buildProjectSessionContextMenuItems({
      activeProjectSessionCount: sessions.filter((s) => !s.archived).length,
      hasAssistantMessage: Boolean(conversation?.messages.some((message) => message.role === "assistant")),
      hasRunningChildRun: Boolean(conversation?.activeRunId),
      isActiveSession: projectPath === workspacePath && session.id === activeSessionId,
      isWorkspaceProject: projectPath === workspacePath,
      projectSessionCount: sessions.length,
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

  const saveActivePaneTranscript = () => {
    const pane = activeTerminalPane;
    const root = workspacePathRef.current;
    const sessionId = activeSessionId;
    if (!pane || !root || !sessionId) return;
    const snapshot = terminalSnapshotsRef.current[pane.id];
    if (!snapshot) return;
    const paneIndex = terminalPanes.findIndex((p) => p.id === pane.id);
    persistPaneTranscript(root, sessionId, pane, paneIndex, terminalSnapshotText(snapshot), Date.now());
  };

  const exportRenderPerfSnapshot = async () => {
    const root = workspacePathRef.current;
    if (!root) return;
    const paneCount = terminalPanesForSession(root).length;
    const snapshot = buildSnapshot(renderPerfRef.current, paneCount, new Date().toISOString());
    const absolutePath = `${root}/docs/qa/perf-budget/render-perf-live.json`;
    // write_text_file's `path` is a raw filesystem path, not root-relative, and
    // requires the target to already exist (it reads metadata for the editor's
    // optimistic-concurrency check) — so create it first on a fresh run;
    // "Path already exists" on later runs is expected and ignored.
    await invoke("create_workspace_file", {
      root,
      parent: `${root}/docs/qa/perf-budget`,
      name: "render-perf-live.json",
    }).catch(() => {});
    await invoke("write_text_file", {
      root,
      path: absolutePath,
      content: `${JSON.stringify(snapshot, null, 2)}\n`,
      expectedModifiedMs: null,
    }).catch((err) => setLaunchError(`Render perf snapshot failed: ${String(err)}`));
  };

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

  const activeTerminalPaneCommandIndex = activeTerminalPane ? terminalPanes.findIndex((pane) => pane.id === activeTerminalPane.id) : -1;
  const activeTerminalPaneLabelForCommands = activeTerminalPane
    ? terminalPaneLabel(activeTerminalPane, activeTerminalPaneCommandIndex >= 0 ? activeTerminalPaneCommandIndex : activeTerminalPane.slot)
    : null;
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
      fileNodeFromPath(`${root}/${path}`, "file"),
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

  const activeTerminalPaneIndex = activeTerminalPane ? terminalPanes.findIndex((pane) => pane.id === activeTerminalPane.id) : -1;
  const activeTerminalPaneLabel = activeTerminalPane
    ? terminalPaneLabel(activeTerminalPane, activeTerminalPaneIndex >= 0 ? activeTerminalPaneIndex : activeTerminalPane.slot)
    : null;
  const activeWorkspaceName = workspacePath ? basename(workspacePath) : "Open workspace";
  const activeSessionTitle = activeSessionId
    ? projectSessionsFor(workspacePath ?? "").find((session) => session.id === activeSessionId)?.title ?? "New chat"
    : "No chat";
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
    <div className={`app-shell ${sideDrawerCollapsed ? "app-shell--side-drawer-collapsed" : ""} ${renderedWorkbenchLayout === "hidden" ? "app-shell--tools-hidden" : ""} ${settingsOpen ? "app-shell--settings-open" : ""}`} style={appShellStyle}>
      <AppTitlebar
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
      />
      <WorkspaceSideRail
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
          onToggleExpanded: (path) => setExpandedSessionProjects((expanded) => ({ ...expanded, [path]: !(expanded[path] ?? false) })),
        }}
        git={{
          error: gitStatusError, hasWorkspace: Boolean(workspacePath), loading: gitStatusLoading,
          status: gitStatus,
          onOpenDiff: (file) => void openGitDiff(file), onRefresh: () => void refreshGitStatus(),
        }}
        browser={{
          address: browser.address, canGoBack: browser.canGoBack, canGoForward: browser.canGoForward,
          detectedPaneLabel: browser.activeDetectedServer?.paneLabel ?? null,
          detectedUrl: browser.activeDetectedServer?.url ?? null,
          error: browser.error, url: browser.url,
          onAddressChange: (address) => { browser.setAddress(address); browser.setError(null); },
          onBack: () => browser.goHistory(-1), onForward: () => browser.goHistory(1),
          onOpenDetected: () => void browser.openDetectedServer(),
          onOpenExternal: () => void openUrl(browser.url), onReload: browser.reload,
          onShow: () => setWorkbenchLayout(workbenchLayout === "hidden" ? "right" : workbenchLayout),
          onSubmit: browser.submitAddress,
        }}
        settings={{
          approvalMode: activeComposerHarness.approvalMode,
          canSetApproval: Boolean(activeComposerHarnessKey), hasWorkspace: Boolean(workspacePath),
          launchProfile: profiles.terminalProfile, launchProfileChanging: profiles.changing,
          launchProfiles: profiles.allProfiles, terminalOpen: agentSurfaceMode === "terminal",
          toolMode: toolTrayMode, workbenchLayout: renderedWorkbenchLayout,
          onApprovalChange: (mode) => void setComposerApprovalMode(mode),
          onBottomTrayChange: (open) => open ? void toggleRawTerminal() : setAgentSurfaceMode("chat"),
          onLayoutChange: setWorkbenchLayout, onOpenFolder: () => void pickWorkspace(),
          onProfileChange: (profileId) => { void profiles.switchTerminalProfile(profiles.resolveProfile(profileId)); },
          onRefreshFiles: refreshFileTree, onToolModeChange: setToolTrayMode,
        }}
        files={{
          fileOpError, fileTree, fileTreeError, fileTreeLoading, fileTreeTruncated,
          railBodyRef, railHeight, selectedFileId: selectedFile?.id, treeRef, visibleFileTree,
          workspaceName: workspacePath ? basename(workspacePath) : null, workspacePath,
          onCreateFile: () => void createFileInRail(), onCreateFolder: () => void createFolderInRail(),
          onOpenFile: (file) => void requestOpenEditorFile(file, { focusEditor: true }),
          onOpenFolder: () => void pickWorkspace(),
          onWorkspaceContextMenu: (event) => openContextMenu(event, workspaceContextMenuItems()),
        }}
      />
      {!sideDrawerCollapsed ? (
        <button
          className="side-drawer-resizer"
          type="button"
          aria-label="Resize side drawer"
          title="Resize side drawer"
          onPointerDown={beginSideDrawerResize}
          onKeyDown={nudgeSideDrawerResize}
        />
      ) : null}

      <main
        ref={workbenchRef}
        className={`workbench workbench--drawer-${renderedWorkbenchLayout} workbench--tools-${toolTrayMode} ${agentSurfaceMode === "terminal" ? "workbench--utility-open" : ""}`}
        style={{ ...workbenchStyle, "--utility-tray-height": `${agentSurfaceMode === "terminal" ? utilityTrayHeight : 42}px` } as CSSProperties}
      >
        {renderedWorkbenchLayout !== "hidden" ? (
          <ToolTrayTabs
            mode={toolTrayMode}
            onModeChange={setToolTrayMode}
            onClose={() => setWorkbenchLayout("hidden")}
          />
        ) : null}
        <FilesDock
          files={drawerSearchQuery.trim() ? drawerSearchResults : searchableFiles}
          loading={fileTreeLoading}
          error={fileTreeError}
          query={drawerSearchQuery}
          selectedFilePath={selectedFile?.path ?? null}
          workspacePath={workspacePath}
          onCreateFile={() => void createFileInRail()}
          onCreateFolder={() => void createFolderInRail()}
          onOpenFile={(file) => void requestOpenEditorFile(file, { focusEditor: true })}
          onQueryChange={setDrawerSearchQuery}
          onRefresh={refreshFileTree}
        />
        <SourceControlDock
          branch={gitStatus?.branch ?? null}
          error={gitStatusError}
          files={gitStatus?.files ?? []}
          isRepository={gitStatus?.isRepository ?? null}
          loading={gitStatusLoading}
          staged={gitStatus?.staged ?? 0}
          untracked={gitStatus?.untracked ?? 0}
          workspacePath={workspacePath}
          onFileContextMenu={(event, file) => openContextMenu(
            event, buildGitFileContextMenuItems(file, workspaceContextMenuActions),
          )}
          onOpenDiff={(file) => void openGitDiff(file)}
          onRefresh={() => void refreshGitStatus()}
        />
        <section
          className="editor-area"
          aria-label="Editor"
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "w") {
              event.preventDefault();
              void closeActiveEditorTab();
            }
          }}
        >
          <EditorChrome
            activeFileMissing={activeFileMissing}
            breadcrumbs={diffReview ? diffBreadcrumbs : editorBreadcrumbs}
            canCopyDiff={Boolean(diffReview?.response.diff.length)}
            canDiscardDiff={diffReviewCanDiscard}
            canOpenDiff={diffReviewCanOpenFile}
            canStageDiff={diffReviewCanStage}
            canUnstageDiff={diffReviewCanUnstage}
            cursorColumn={editorCursor.column}
            cursorLine={editorCursor.line}
            diff={diffReview ? { absolutePath: diffReview.absolutePath, hasDiff: Boolean(diffReview.response.diff.length), path: diffReview.response.path } : null}
            diffError={diffReviewError}
            diffLoading={diffReviewLoading}
            editorBytesLabel={formatBytes(editorBytes)}
            editorDirty={editorDirty}
            editorLanguage={editorLanguage}
            editorLoading={editorLoading}
            editorSaving={editorSaving}
            selectedFile={selectedFile}
            tabs={editorTabs}
            tabIsDirty={tabIsDirty}
            onCloseDiff={closeDiffReview}
            onCloseTab={(tab) => void closeEditorTab(tab)}
            onCopyDiff={() => void copyShownDiff()}
            onDiscardDiff={() => { if (diffReview) void runGitFileAction("discard", diffReview.file); }}
            onFind={openEditorSearch}
            onOpenDiff={() => void openDiffFile()}
            onSave={() => void saveEditorFile()}
            onSelectTab={(tab) => void requestOpenEditorFile(tab, { focusEditor: true })}
            onStageDiff={() => { if (diffReview) void runGitFileAction("stage", diffReview.file); }}
            onTabContextMenu={(event, tab) => openContextMenu(event, editorTabContextMenuItems(tab))}
            onUnstageDiff={() => { if (diffReview) void runGitFileAction("unstage", diffReview.file); }}
          />
          {diffReview || diffReviewLoading || diffReviewError ? (
            <EditorDiffView
              canOpenFile={diffReviewCanOpenFile}
              error={diffReviewError}
              loading={diffReviewLoading}
              review={diffReview}
              onContextMenu={(event) => openContextMenu(event, diffContextMenuItems())}
              onOpenFile={(line) => void openDiffFile(line)}
            />
          ) : selectedFile ? (
            <EditorCodeSurface
              conflict={editorSaveConflict}
              error={editorError}
              filePath={selectedFile.path}
              loading={editorLoading}
              recoveryError={editorRecoveryError}
              saving={editorSaving}
              value={editorText}
              onChange={setEditorText}
              onContextMenu={(event) => openContextMenu(event, editorContextMenuItems())}
              onCreateEditor={restoreEditorView}
              onOpenExternally={() => void openSelectedFileExternally()}
              onOverwrite={() => void overwriteSelectedFile()}
              onReload={() => void reloadSelectedFileFromDisk()}
              onRetry={() => void saveEditorFile()}
              onSave={() => void saveEditorFile()}
              onUpdate={handleEditorUpdate}
            />
          ) : (
            <div className="editor-empty">
              <div className="editor-empty-title">Select a file</div>
              <div className="editor-empty-path">Project editor surface</div>
            </div>
          )}
        </section>

        <WorkbenchResizers
          layout={renderedWorkbenchLayout}
          onKeyDown={nudgeWorkbenchResize}
          onPointerDown={beginWorkbenchResize}
          sizing={workbenchSizing}
          trayMode={toolTrayMode}
        />

        <BrowserPreviewPanel
          address={browser.address}
          canGoBack={browser.canGoBack}
          canGoForward={browser.canGoForward}
          detectedPaneLabel={browser.activeDetectedServer?.paneLabel ?? null}
          detectedUrl={browser.activeDetectedServer?.url ?? null}
          error={browser.error}
          onAddressChange={(address) => { browser.setAddress(address); browser.setError(null); }}
          onBack={() => browser.goHistory(-1)}
          onContextMenu={(event) => openContextMenu(event, browserContextMenuItems())}
          onForward={() => browser.goHistory(1)}
          onOpenDetected={() => void browser.openDetectedServer()}
          onOpenExternal={() => void openUrl(browser.url)}
          onReload={browser.reload}
          onSubmit={browser.submitAddress}
          reloadNonce={browser.reloadNonce}
          url={browser.url}
        />

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
      </main>

      {settingsOpen ? (
        <SettingsModal
          approvalSetting={activeApprovalSetting}
          agentConnectionsStatus={agentConnectionsStatus}
          agentConnectionsRefreshing={agentConnectionsRefreshing}
          agentHookStatus={agentHookStatus}
          browserSetting={activeBrowserSetting}
          aiConnectionSettings={aiConnectionSettings}
          connectionSecretPresence={connectionSecretPresence}
          mcpOAuthStatuses={mcpOAuthStatuses}
          commandPaletteSources={commandPaletteSources}
          customTerminalProfiles={profiles.customProfiles}
          gitBranch={gitStatus?.branch ?? null}
          gitChangeCount={gitStatus ? gitStatus.files.length : null}
          sourceControlStatus={sourceControlStatus}
          repoLocation={repoLocation}
          onOpenSourceControlLink={(url) => void openUrl(url).catch(() => {})}
          layout={renderedWorkbenchLayout}
          profileSetting={activeAgentProfileSetting}
          profiles={LAUNCH_PROFILES.map((profile) => ({
            id: profile.id,
            label: profile.id === "codex" || profile.id === "claude"
              ? profile.label
              : `${profile.label} · ${profile.id === "shell" ? "not a chat provider" : "raw terminal only"}`,
            disabled: profile.id !== "codex" && profile.id !== "claude",
          }))}
          sessionTitle={activeSessionTitle}
          trayMode={toolTrayMode}
          workspaceName={activeWorkspaceName}
          workspacePath={workspacePath ?? ""}
          onApprovalModeChange={settingsScopedActions.onApprovalModeChange}
          onOpenAgentConnection={(providerId) => void openAgentConnection(providerId)}
          onRefreshAgentConnections={refreshAgentConnections}
          onBrowserUrlCommit={settingsScopedActions.onBrowserUrlCommit}
          onAiConnectionSettingsChange={(next) => void saveAiConnectionSettings(next)}
          onDeleteConnectionSecret={deleteConnectionSecret}
          onSaveConnectionSecret={saveConnectionSecret}
          onValidateConnectionTarget={settingsConnectionActions.validateConnectionTarget}
          onBeginMcpOAuth={settingsConnectionActions.beginMcpOAuth}
          onDisconnectMcpOAuth={settingsConnectionActions.disconnectMcpOAuth}
          onCommandPaletteSourceChange={settingsPreferenceActions.onCommandPaletteSourceChange}
          onAddCustomTerminalProfile={(label, command) => {
            void profiles.addCustomProfile(label, command);
          }}
          keybindingOverrides={keybindingOverrides}
          onResetLocalData={() => void settingsConnectionActions.resetLocalData()}
          notificationsEnabled={notificationsEnabled}
          onNotificationsChange={settingsPreferenceActions.onNotificationsChange}
          onRemoveCustomTerminalProfile={(profileId) => {
            void profiles.removeCustomProfile(profileId);
          }}
          theme={appTheme}
          onThemeChange={settingsPreferenceActions.onThemeChange}
          onKeybindingOverrideChange={settingsPreferenceActions.onKeybindingOverrideChange}
          onClose={() => setSettingsOpen(false)}
          onLayoutChange={setWorkbenchLayout}
          onProfileChange={settingsScopedActions.onProfileChange}
          onScopedSettingReset={settingsScopedActions.onScopedSettingReset}
          onResetLayout={resetInterface}
          onTrayModeChange={setToolTrayMode}
        />
      ) : null}
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
          actionNotice, canUseShellProfile: !profiles.changing && profiles.launchProfile.id !== "shell",
          crashNotice, launchError,
          onDismissAction: () => setActionNotice(null), onDismissCrash: () => setCrashNotice(null),
          onOpenFolder: () => void pickWorkspace(),
          onUseShellProfile: () => {
            const shell = LAUNCH_PROFILES.find((profile) => profile.id === "shell");
            if (shell) void profiles.switchLaunchProfile(shell);
          },
        }}
        orchestration={{
          approvalMode: activeComposerHarness.approvalMode, error: orchestrationError,
          activeRunCount: Object.values(chatConversations).filter((conversation) => conversation.activeRunId).length,
          launching: orchestrationLaunching, open: orchestrationOpen,
          onClose: () => {
            if (orchestrationLaunching) return;
            setOrchestrationOpen(false);
            setOrchestrationError(null);
          },
          parentTitle: projectSessions[workspacePath ?? ""]?.find((session) => session.id === activeSessionId)?.title ?? "Current chat",
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
    </div>
  );
}

export default App;
