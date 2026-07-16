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
      persistence.activeSessionByProjectRef.current, persistence.projectSessionsRef.current, root,
    ),
    saveStore: async () => { await storeRef.current?.save(); },
    setStoreValue: async (key, value) => { await storeRef.current?.set(key, value); },
  });
  const editorSession = useEditorSessionController();
  const terminal = useTerminalPaneController<Snapshot>({
    activeSessionForProject: (root) => activeSessionLookupRef.current(root),
    activeWorkspace: workspacePathRef,
    persistPaneLayout: (root, sessionId, panes) => {
      persistPaneLayoutRef.current(root, sessionId, panes);
    },
  });
  const workspaceTree = useWorkspaceTree({
    onClearWorkspace: () => editorSession.resetEditor(),
    onRootResolved: (root) => { workspacePathRef.current = root; },
    workspacePath,
  });
  const persistence = useWorkspacePersistenceController({
    activeFiles: editorSession.activeFilesByWorkspaceRef,
    getPanes: (root, sessionId) => terminal.panesForSession(root, sessionId),
    paneLabels: terminal.paneLabelsRef,
    paneLayouts: terminal.paneLayoutsRef,
    sessionSnapshots: editorSession.sessionEditorSnapshotsRef,
    setPaneLabels: terminal.setPaneLabels,
    store: storeRef,
  });
  activeSessionLookupRef.current = persistence.activeSessionForProject;
  persistPaneLayoutRef.current = persistence.persistPaneLayout;
  const [agentHookStatus, setAgentHookStatus] = useState<AgentHookStatus | null>(null);
  const profiles = useLaunchProfileController({
    getCurrentRoot: () => workspacePathRef.current,
    getCurrentSessionId: () => persistence.activeSessionForProject(workspacePathRef.current),
    randomId: () => crypto.randomUUID(),
    saveStore: async () => { await storeRef.current?.save(); },
    scopedSettings: composerWorkspace.scopedSettingsRef,
    setScopedSettings: composerWorkspace.setScopedSettings,
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
  const settingsRuntime = useSettingsRuntimeStatus(settingsOpen, workspacePath);
  const [aiConnectionSettings, setAiConnectionSettings] = useState<AiConnectionSettings>(DEFAULT_AI_CONNECTION_SETTINGS);
  const mcpOAuth = useMcpOAuthStatus();
  const [worktrees, setWorktrees] = useState<WorktreeRecord[]>([]);
  const [backgroundExits, setBackgroundExits] = useState<BackgroundExit[]>([]);
  const paneTranscripts = usePaneTranscriptController({
    saveStore: () => { void storeRef.current?.save(); },
    setStoreValue: (key, value) => { void storeRef.current?.set(key, value); },
  });
  const [keybindingOverrides, setKeybindingOverrides] = useState<KeybindingOverrides>({});
  const [composerSending, setComposerSending] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const shellLayout = useShellLayout(() => setSettingsOpen(false));
  const railHeight = useFilesRailHeight(shellLayout.sideDrawerMode === "files", railBodyRef);
  const [drawerSearchQuery, setDrawerSearchQuery] = useState("");
  const chatSearch = useChatSearch({ open: commandPalette.open, query: commandPalette.query });
  const [focusedChatMessageId, setFocusedChatMessageId] = useState<string | null>(null);
  const gitStatusHook = useGitStatus({
    active: shellLayout.sideDrawerMode === "files" || shellLayout.sideDrawerMode === "git", refreshKey: workspaceTree.refreshKey,
    resolveRoot: () => workspacePathRef.current ?? workspacePath, workspacePath,
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
  const activeChat = deriveActiveChatState({
    activeSessionByProject: persistence.activeSessionByProject, chatConversations: composerWorkspace.chatConversations, composerHarnessBySession: composerWorkspace.composerHarnessBySession,
    launchProfileId: profiles.launchProfile.id, projectSessions: persistence.projectSessions,
    resolveLaunchProfile: profiles.resolveProfile,
    scopedSettings: composerWorkspace.scopedSettings, workspacePath,
  });
  const agentApprovalMode: AgentApprovalMode = activeChat.activeComposerHarness.approvalMode;
  const agentActivityHook = useAgentActivityController({
    activeAgentDescriptor: activeAgentSessionDescriptorRef,
    activeProviderId: activeChat.activeComposerProvider,
    activeProviderLabel: activeChat.activeComposerProviderLabel,
    approvalMode: agentApprovalMode,
    confirmAction: (_action, message) => confirmDialog(message),
    getChatApprovalMode: (root, sessionId) =>
      composerWorkspace.composerHarnessBySessionRef.current[`${root}\n${sessionId}`]?.approvalMode ?? "ask",
    getRoot: () => workspacePathRef.current,
    getSessionId: (root) => activeProjectSessionId(
      persistence.activeSessionByProjectRef.current, persistence.projectSessionsRef.current, root,
    ),
    persistEvents: (events) => {
      void storeRef.current?.set("agentActivityHook.agentActivityEvents", events);
      void storeRef.current?.save();
    },
  });
  const browser = useBrowserPreviewController({
    activeRoot: workspacePath,
    activeSessionId: activeChat.activeSessionId,
    ensureVisible: () => {
      if (shellLayout.workbenchLayout === "hidden") shellLayout.setWorkbenchLayout("right");
      if (shellLayout.toolTrayMode === "editor") shellLayout.setToolTrayMode("browser");
    },
    gateAction: async (action) => (await agentActivityHook.gateAppAction(action)).decision,
    getCurrentRoot: () => workspacePathRef.current,
    getCurrentSessionId: () => activeProjectSessionId(
      persistence.activeSessionByProjectRef.current, persistence.projectSessionsRef.current, workspacePathRef.current,
    ),
    saveStore: async () => { await storeRef.current?.save(); },
    scopedSettings: composerWorkspace.scopedSettingsRef,
    setScopedSettings: composerWorkspace.setScopedSettings,
    setStoreValue: async (key, value) => { await storeRef.current?.set(key, value); },
  });
  const composerLocal = useComposerLocalState({
    activeHarness: activeChat.activeComposerHarness, activeKey: activeChat.activeComposerHarnessKey,
    getDefaultProfileId: () => profiles.launchProfileRef.current.id,
    getRecords: () => composerWorkspace.composerHarnessBySessionRef.current,
    persistRecords: (records) => composerWorkspace.persistComposerHarnessRecords(records),
  });
  const composerAttachments = useComposerAttachments({
    active: shellLayout.agentSurfaceMode === "chat",
    activeHarness: activeChat.activeComposerHarness,
    activeKey: activeChat.activeComposerHarnessKey,
    draft: composerLocal.draft,
    gateAction: (action) => agentActivityHook.gateAppAction(action),
    getBrowserUrl: () => browser.urlRef.current,
    getRoot: () => workspacePathRef.current,
    logEvent: (label, detail) => logComposerHarnessEvent(label, detail),
    setError: setComposerError,
    setNotice: setComposerNotice,
    updateHarness: composerLocal.updateHarness,
  });
  const attachSelectedFileToComposer = async () => composerAttachments.attachWorkspaceFile(editorSession.selectedFile);
  const composerMentionQuery = composerMentionQueryFrom(composerLocal.draft);
  const composerMentionResults = useMemo(
    () => composerMentionQuery == null ? [] : filterWorkspaceFiles(editorWorkspace.searchableFiles, composerMentionQuery, 8),
    [composerMentionQuery, editorWorkspace.searchableFiles],
  );
  const activeAgentSession = deriveActiveAgentSessionState({
    activeSessionId: activeChat.activeSessionId, activeTerminalPaneId: terminal.activePaneId, agentActivityEvents: agentActivityHook.agentActivityEvents, agentActivityFilter: agentActivityHook.agentActivityFilter,
    agentApprovalMode, terminalPanes: terminal.panes, workspacePath,
  });
  const terminalFind = useTerminalFind(activeAgentSession.activeTerminalPane != null);
  useSyncRef(activeAgentSessionDescriptorRef, activeAgentSession.activeAgentSessionDescriptor);
  const activeTerminalProfile = activeAgentSession.activeTerminalPane?.profile ?? profiles.terminalProfile;


  useEffect(() => {
    if (!editorSession.selectedFile) return;
    treeRef.current?.scrollTo(editorSession.selectedFile.id, "smart");
  }, [editorSession.selectedFile, editorWorkspace.visibleFileTree]);

  useEffect(() => {
    if (!editorSession.selectedFile || workspaceTree.tree.length === 0) return;
    const syncedFile = reconcileActiveFileNode(workspaceTree.tree, editorSession.selectedFile);
    if (syncedFile !== editorSession.selectedFile) editorSession.setSelectedFile(syncedFile);
  }, [workspaceTree.tree, editorSession.selectedFile]);

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

  const captureCurrentSessionSnapshot = createSessionSnapshotCapture({
    capture: editorSession.captureSessionSnapshot,
    getRoot: () => workspacePathRef.current,
    makeKey: persistence.sessionKey,
    persistPaneLayout: persistence.persistPaneLayout,
    persistSnapshots: persistence.persistSessionSnapshots,
    resolveSessionId: (root) =>
      activeProjectSessionId(persistence.activeSessionByProjectRef.current, persistence.projectSessionsRef.current, root),
  });

  const restoreSessionEditorSnapshot = createSessionSnapshotRestore({
    makeKey: persistence.sessionKey,
    openFile: (...args: Parameters<typeof editorFileWorkflow.openDirect>) => editorFileWorkflow.openDirect(...args),
    restore: editorSession.restoreSessionSnapshot,
  });

  const workspaceOpenActions = createWorkspaceOpenSurface({
    actions: {
      captureCurrentSession: captureCurrentSessionSnapshot,
      clearBackgroundExits: (path) => {
        setBackgroundExits((exits) => clearBackgroundExitsForProject(exits, path));
      },
      dirtyTabPaths: editorWorkspace.dirtyTabPaths, editorDirty: editorWorkspace.editorDirty, editorTabs: editorSession.editorTabs,
      flushComposer: composerLocal.flush,
      getDefaultProfile: () => profiles.launchProfileRef.current,
      getPreviousActivePaneId: () => terminal.activePaneIdRef.current,
      getPreviousPanes: () => terminal.panesRef.current,
      getPreviousRoot: () => workspacePathRef.current,
      getSelectedFilePath: () => editorSession.selectedFileRef.current?.path ?? null,
      getStore: () => storeRef.current,
      openEditorFile: (file) => editorFileWorkflow.openDirect(file),
      setFocusedPane: terminal.setFocusedPane,
    },
    connectionSettings: aiConnectionSettingsRef,
    lifecycle: {
      clearCurrentWorkspace: (path) => {
        if (workspacePathRef.current !== path) return;
        terminal.setManagedPanes([]); terminal.setFocusedPane(null); setWorkspacePath(null);
        workspaceTree.setTree([]); editorSession.resetEditor();
      },
      deleteProjectChats: deleteDurableProjectChats,
      now: Date.now, persistPaneLayout: persistence.persistPaneLayout,
      projectStatus: terminal.projectStatusForRoot,
      records: workspaceOpenRecordsFromHooks({
        browser, composer: composerWorkspace, editorSession, persistence, terminal,
      }),
      restoreBrowser: browser.restoreScopedUrl, restoreEditor: restoreSessionEditorSnapshot,
      sessionStatus: terminal.statusForPanes, setFocusedPane: terminal.setFocusedPane,
      setLaunchError, setManagedPanes: terminal.setManagedPanes,
    },
    target: workspaceOpenTargetFromHook(terminal, {
      activeSessions: persistence.activeSessionByProjectRef,
      getSurfaceMode: () => shellLayout.agentSurfaceMode, latest, now: Date.now,
      resetEditor: editorSession.resetEditor,
      resolveProfile: profiles.resolveProfile,
      restoredActiveFileWorkspace: editorSession.restoredActiveFileWorkspaceRef,
      savedLabelForSlot: persistence.savedPaneLabel,
      scheduleResize: () => setTimeout(sendTerminalResize, 0), sessions: persistence.projectSessionsRef,
      setLaunchError,
      setWorkspacePath, workspacePath: workspacePathRef,
    }),
  });

  const requestOpenWorkspace = (path: string) => workspaceOpenActions.requestOpenWorkspace(
    path, () => editorNavigation.requestNavigation({ kind: "workspace", path }),
  );

  const projectCloseController = createProjectCloseController(projectCloseFromHook(terminal, {
    clearActiveWorkspace: () => {
      setWorkspacePath(null); terminal.setManagedPanes([]); terminal.setFocusedPane(null);
      latest.current = null; workspaceTree.setTree([]); editorSession.resetEditor();
    },
    closePane: (paneId) => invoke("close_pane", { paneId }),
    confirmClose: (message) => confirmDialog(message), conversations: composerWorkspace.chatConversationsRef,
    deleteStoredFolder: async () => { await storeRef.current?.delete("folder"); },
    dirtyTabCount: editorWorkspace.dirtyTabPaths.length,
    hasSelectedFile: () => editorSession.selectedFileRef.current != null,
    openProjects: persistence.openProjectsRef, openWorkspace: workspaceOpenActions.openWorkspaceDirect,
    persistOpenProjects: persistence.persistOpenProjects,
    saveStore: async () => { await storeRef.current?.save(); },
    setActionNotice: chrome.setActionNotice, setLaunchError,
    stopChatRun: (runId) => invoke("stop_chat_run", { runId }),
    stopWorkspaceWatcher: () => invoke("stop_workspace_watcher"),
    workspacePath: workspacePathRef,
  }));
  const requestCloseProject = (project: OpenProject) => projectCloseController.requestCloseProject(
    project, () => editorNavigation.requestNavigation({ kind: "close-project", projectPath: project.path }),
  );

  const projectSessionNavigationActions = createProjectSessionNavigationActions({
    captureCurrentSession: captureCurrentSessionSnapshot,
    defaultBrowserUrl: DEFAULT_BROWSER_PREVIEW_URL,
    flushComposer: composerLocal.flush,
    getPreviousStatus: terminal.activeSessionStatus,
    getState: () => ({
      activeSessions: persistence.activeSessionByProjectRef.current,
      browserUrl: browser.urlRef.current,
      browserUrlsByProject: browser.projectRecordsRef.current,
      currentRoot: workspacePathRef.current,
      sessions: persistence.projectSessionsRef.current,
    }),
    getTargetStatus: (projectPath, sessionId) =>
      terminal.statusForPanes(terminal.panesForSession(projectPath, sessionId)),
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
    persistSessions: persistence.persistProjectSessions,
    promptTitle: (title) => window.prompt("Chat name", title),
    setFocusedMessage: setFocusedChatMessageId,
  });

  const openChatSearchResult = createChatSearchNavigation({
    focusMessage: setFocusedChatMessageId,
    getSessions: () => persistence.projectSessionsRef.current,
    setError: chatSearch.setError,
    showArchived: () => persistence.setShowArchivedSessions(true),
    showProjectsDrawer: () => shellLayout.setSideDrawerMode("projects"),
    switchSession: projectSessionNavigationActions.switchSession,
  });


  const projectSessionDeletionController = createProjectSessionDeletionController(projectSessionDeletionFromHook(terminal, {
    activeSessionId: activeChat.activeSessionId,
    activeSessions: persistence.activeSessionByProjectRef, browserSessions: browser.sessionRecordsRef,
    closePane: (paneId) => invoke("close_pane", { paneId }),
    composerHarness: composerWorkspace.composerHarnessBySessionRef, confirmDelete: confirmDialog,
    conversations: composerWorkspace.chatConversationsRef, deleteHistory: deleteDurableChatConversation,
    persistBrowserSessions: async (records) => {
      await storeRef.current?.set("browserPreviewBySession", records);
    },
    persistComposerHarness: composerWorkspace.persistComposerHarnessRecords, persistSessions: persistence.persistProjectSessions,
    removePersistedRestore: persistence.removeSessionRestore,
    reopenActiveWorkspace: (projectPath) => workspaceOpenActions.openWorkspaceDirect(
      projectPath, profiles.launchProfileRef.current, { captureCurrentSession: false },
    ),
    sessions: persistence.projectSessionsRef, setBrowserSessions: browser.setSessionRecords,
    setConversations: composerWorkspace.setChatConversations, setError: setLaunchError,
    workspacePath: workspacePathRef,
  }));

  const paneActivityLog = createPaneActivityLog({
    approvalMode: () => agentApprovalMode,
    recordActivity: agentActivityHook.recordAgentActivity,
  });

  const finalizeCreatedTerminalPane = createTerminalPaneFinalize({
    getProjectStatus: terminal.projectStatusForRoot,
    persistProfile: async (profile) => {
      await storeRef.current?.set("terminalLaunchProfile", profile);
      await storeRef.current?.save();
    },
    scheduleResize: () => setTimeout(sendTerminalResize, 0),
    setError: setLaunchError,
    setTerminalProfile: profiles.setTerminalProfile,
    statusForPanes: terminal.statusForPanes,
    updateProjectStatus: persistence.updateOpenProjectStatus,
    updateSessionStatus: persistence.updateActiveSessionStatus,
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
    gateAction: (action) => agentActivityHook.gateAppAction(action, activeAgentSessionHandle),
    getActiveConversation: () => activeChat.activeChatConversation,
    getActiveProvider: () => activeChat.activeComposerProvider,
    getActiveSessionId: () => activeChat.activeSessionId,
    getActiveSessions: () => persistence.activeSessionByProjectRef.current,
    getChatId: () => activeChat.activeComposerHarnessKey,
    getComposerDraft: () => composerLocal.draft,
    getComposerHistory: () => composerLocal.history,
    getComposerSending: () => composerSending,
    getConversations: () => composerWorkspace.chatConversationsRef.current,
    getHarness: () => activeChat.activeComposerHarness,
    getHarnessRecords: () => composerWorkspace.composerHarnessBySessionRef.current,
    getSelectedFilePath: () => editorSession.selectedFile?.path ?? null,
    getSessions: () => persistence.projectSessionsRef.current,
    getSettings: () => aiConnectionSettingsRef.current,
    getTerminalLabel: () => activeTerminalPaneLabel,
    getWorkspacePath: () => workspacePathRef.current,
    now: Date.now,
    openSearch: () => editorSurface.openEditorSearch(),
    orchestrationGateAction: (action) => agentActivityHook.gateAppAction(action),
    persistHarnessRecords: (records) => composerWorkspace.persistComposerHarnessRecords(records),
    persistSessions: (sessions, activeSessions) => persistence.persistProjectSessions(sessions, activeSessions),
    pickWorkspace: () => pickWorkspace(),
    recordActivity: (event) => agentActivityHook.recordAgentActivity(activeAgentSessionHandle, event),
    removeWorktree: (input) => invoke("remove_project_worktree", input),
    replaceConversations: composerWorkspace.setChatConversations,
    resolveProfileLabel: (id) => profiles.resolveProfile(id).label,
    saveFile: () => saveEditorFile(),
    setActionNotice: chrome.setActionNotice,
    setComposerError,
    setComposerHistoryIndex: composerLocal.setHistoryIndex,
    setComposerLocalState: composerLocal.setLocalState,
    setComposerNotice,
    setComposerSending,
    setOrchestrationError,
    setOrchestrationLaunching,
    setOrchestrationOpen,
    stopRun: (runId) => invoke("stop_chat_run", { runId }),
    updateConversation: chatConversationActions.updateConversation,
    updateHarness: (update) => composerLocal.updateHarness(update),
    updateSessionMetadata: (projectPath, sessionId, orchestration) =>
      projectSessionMetadataActions.updateSessionMetadata(projectPath, sessionId, { orchestration }),
  });

  const chatRunControls = createChatRunControls({
    getActiveRunId: () => activeChat.activeChatConversation.activeRunId,
    respondApproval: ({ decision, requestId, runId }) =>
      invoke("respond_chat_approval", { runId, requestId, decision }),
    setError: setComposerError,
    stopRun: (runId) => invoke("stop_chat_run", { runId }),
  });

  const composerHistoryNavigation = createComposerHistoryNavigation({
    getChatId: () => activeChat.activeComposerHarnessKey,
    getHistory: () => composerLocal.history,
    getHistoryIndex: () => composerLocal.historyIndex,
    setHistoryIndex: composerLocal.setHistoryIndex,
    setLocalState: composerLocal.setLocalState,
  });



  const composerSettingsActions = createComposerSettingsActions({
    getRuntimeState: () => ({
      activeRunId: activeChat.activeChatConversation.activeRunId,
      chatId: activeChat.activeComposerHarnessKey,
      provider: activeChat.activeComposerProvider,
    }),
    labelProvider: chatProviderLabel,
    labelReasoning: composerReasoningLabel,
    logEvent: logComposerHarnessEvent,
    now: Date.now,
    updateConversation: chatConversationActions.updateConversation,
    updateHarness: composerLocal.updateHarness,
    updateScopedSetting: (key, value) => key === "approvalMode"
      ? composerWorkspace.updateScopedSetting("chat", "approvalMode", value as AgentApprovalMode)
      : composerWorkspace.updateScopedSetting("chat", "agentProfileId", value as ChatProvider),
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
    promptWorktreeLabel: () => window.prompt("Worktree label (used for the branch name)"),
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

  const editorFileWorkflow = wireEditorFileWorkflow(editorSession, {
    closeDiffReview: () => diffReviewHook.close(),
    gateAction: (action) => agentActivityHook.gateAppAction(action),
    getDirty: () => editorWorkspace.editorDirty,
    getRoot: () => workspacePathRef.current ?? workspacePath,
    persistActiveFile: persistence.persistActiveFile,
    recordEdit: (file) => agentActivityHook.recordAgentActivity(activeAgentSession.activeAgentSessionDescriptor, {
      kind: "file", label: "Edited a file", detail: file.name, status: "complete",
    }),
  });
  const saveEditorFile = (options: SaveEditorFileOptions = {}) => editorFileWorkflow.save(options.force ?? false);

  const editorSurface = createEditorSurfaceActions<
    FileTreeNode, EditorView, GitStatusFile, ReturnType<typeof EditorView.scrollIntoView>
  >(
    editorSession,
    {
      copyText: writeText,
      getDiffReviewPath: () => diffReviewHook.review?.absolutePath ?? null,
      getGitFiles: () => gitStatusHook.status?.files ?? [],
      getRoot: () => workspacePathRef.current,
      makeFileNode: (path) => fileTreeNodeFromPath(path, "file"),
      notify: chrome.setActionNotice,
      openExternal: openPath,
      openFileDirect: (file, fileOptions) => editorFileWorkflow.openDirect(file, fileOptions),
      openGitDiff: async (file) => Boolean(await diffReviewHook.open(file)),
      openSearchPanel,
      requestOpenFile: async (file, fileOptions) => Boolean(await editorFileWorkflow.requestOpen(file, fileOptions)),
      revealEditorTools: () => {
        if (shellLayout.workbenchLayout === "hidden") shellLayout.setWorkbenchLayout("right");
        shellLayout.setToolTrayMode("editor");
      },
      revealInDir: revealItemInDir,
      saveFile: (saveOptions) => saveEditorFile(saveOptions),
      schedule: (callback, delayMs) => { window.setTimeout(callback, delayMs); },
      scheduleFrame: (callback) => requestAnimationFrame(callback),
      scrollEffect: (position) => EditorView.scrollIntoView(position, { y: "center" }),
    },
  );
  const handleEditorUpdate = (update: ViewUpdate) => editorSurface.handleEditorUpdate(update);

  const workspaceFileActions = wireWorkspaceFileActions(editorSession, {
    clearPersistedActiveFile: persistence.clearActiveFile,
    getDirty: () => editorWorkspace.editorDirty,
    getPersistRoot: () => workspacePathRef.current,
    getRoot: () => workspacePathRef.current ?? workspacePath,
    getSelectedFile: () => editorSession.selectedFile,
    openFileDirect: (file, fileOptions) => editorFileWorkflow.openDirect(file, fileOptions),
    refresh: workspaceTree.refresh,
    requestOpenFile: (file, fileOptions) => editorFileWorkflow.requestOpen(file, fileOptions),
    setError: editorSession.setFileOpError,
  });



  const workspaceContextMenuActions = {
    closeProject: requestCloseProject,
    copyPath: editorSurface.copyPath,
    deleteNode: workspaceFileActions.delete,
    duplicateNode: workspaceFileActions.duplicate,
    newFile: workspaceFileActions.createFile,
    newFolder: workspaceFileActions.createFolder,
    openDiff: diffReviewHook.open,
    openWorkspace: pickWorkspace,
    renameNode: workspaceFileActions.rename,
    revealNode: workspaceFileActions.reveal,
    revealPath: revealItemInDir,
    runGitAction: diffReviewHook.runFileAction,
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
    getActiveSessions: () => persistence.activeSessionByProjectRef.current,
    getSessions: () => persistence.projectSessionsRef.current,
    notify: chrome.setActionNotice,
    now: Date.now,
    persist: persistence.persistProjectSessions,
  });

  const sessionCheckpoints = wireSessionCheckpointActions(editorSession, {
    gateAction: (action) => agentActivityHook.gateAppAction(action),
    getDirtyTabPaths: () => editorWorkspace.dirtyTabPaths,
    getWorkspacePath: () => workspacePathRef.current,
    onMetadata: projectSessionMetadataActions.updateSessionMetadata,
    openFileDirect: (file) => editorFileWorkflow.openDirect(file),
    refreshFiles: workspaceTree.refresh,
    refreshGit: () => gitStatusHook.refresh(),
    setError: setLaunchError,
    setNotice: chrome.setActionNotice,
  });

  const projectSessionContextMenuItems = (projectPath: string, session: ProjectSession): ContextMenuItem[] => {
    return buildProjectSessionContextMenuItems({
      ...deriveProjectSessionMenuState({
        activeSessionId: activeChat.activeSessionId,
        chatIdForSession: composerHarnessSessionKey,
        conversations: composerWorkspace.chatConversationsRef.current,
        projectPath,
        session,
        sessions: persistence.projectSessionsRef.current[projectPath] ?? [],
        workspacePath,
      }),
      session,
      actions: {
        archive: () => projectSessionMetadataActions.archiveSession(projectPath, session, !session.archived),
        captureCheckpoint: () => sessionCheckpoints.capture(projectPath, session),
        copyName: async () => { await writeText(session.title); chrome.setActionNotice("Copied chat name"); },
        delete: () => projectSessionDeletionController.deleteProjectSession(projectPath, session),
        pin: () => projectSessionMetadataActions.pinSession(projectPath, session, !session.pinnedAt),
        removeChildWorktree: () => composerSurface.removeChildWorktree(projectPath, session),
        rename: () => projectSessionNavigationActions.renameSession(projectPath, session),
        restoreCheckpoint: () => session.checkpointId ? sessionCheckpoints.restore(projectPath, session, session.checkpointId) : undefined,
        restoreRecoveryCheckpoint: () => session.recoveryCheckpointId ? sessionCheckpoints.restore(projectPath, session, session.recoveryCheckpointId) : undefined,
        returnChildResult: () => composerSurface.returnChildResult(projectPath, session),
        stopChildRun: () => composerSurface.stopChildChatRun(projectPath, session),
        switchChat: () => projectSessionNavigationActions.switchSession(projectPath, session.id),
      },
    });
  };

  const editorContextMenuActions = {
    closeDiff: diffReviewHook.close,
    closeTab: (tab: FileTreeNode) => editorNavigation.closeTab(tab),
    copyDiff: diffReviewHook.copy,
    copyPath: editorSurface.copyPath,
    find: editorSurface.openEditorSearch,
    openDiffFile: editorSurface.openDiffFile,
    openExternal: editorSurface.openExternally,
    openTab: (tab: FileTreeNode) => editorFileWorkflow.requestOpen(tab, { focusEditor: true }),
    revealNode: workspaceFileActions.reveal,
    revealSelected: editorSurface.reveal,
    runGitAction: diffReviewHook.runFileAction,
    save: saveEditorFile,
    shortcut: shortcutKeys,
  };
  const editorTabContextMenuItems = (tab: FileTreeNode) =>
    buildEditorTabContextMenuItems(tab, editorContextMenuActions);
  const editorContextMenuItems = () => buildEditorContextMenuItems({
    editorDirty: editorWorkspace.editorDirty, editorLoading: editorSession.editorLoading, editorSaving: editorSession.editorSaving, selectedFile: editorSession.selectedFile,
  }, editorContextMenuActions);
  const diffContextMenuItems = () => buildDiffContextMenuItems({
    canDiscard: editorWorkspace.diffReviewCanDiscard, canOpenFile: editorWorkspace.diffReviewCanOpenFile,
    canStage: editorWorkspace.diffReviewCanStage, canUnstage: editorWorkspace.diffReviewCanUnstage,
    loading: diffReviewHook.loading, review: diffReviewHook.review,
  }, editorContextMenuActions);

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

  const terminalContextMenuItems = (): ContextMenuItem[] => buildTerminalContextMenuItems({
    activePaneState: activeAgentSession.activeTerminalPane?.state ?? null,
    hasActiveHandle: Boolean(activeAgentSessionHandle),
    hasActivePane: Boolean(activeAgentSession.activeTerminalPane),
    hasSelection: Boolean(terminalSurface.terminalSelectedText()),
    hasWorkspace: Boolean(workspacePath),
    hasWorktreeForActivePane: Boolean(activeAgentSession.activeTerminalPane && worktreeForPaneId(worktrees, String(activeAgentSession.activeTerminalPane.id))),
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
      copySelection: async () => { await terminalSurface.copyTerminalSelection(); chrome.setActionNotice("Copied terminal selection"); },
      copyTail: async () => { await terminalSurface.copyActivePaneTail(); chrome.setActionNotice("Copied last 20 lines"); },
      copyWorkingDirectory: () => workspacePath ? editorSurface.copyPath(workspacePath) : undefined,
      createPane: () => terminalSurface.createTerminalPane(profiles.terminalProfile),
      createWorktreePane: () => terminalSurface.createWorktreePane(profiles.terminalProfile),
      interrupt: () => terminalSurface.interruptActivePane(),
      killPane: () => activeAgentSession.activeTerminalPane ? terminalSurface.terminateTerminalPane(activeAgentSession.activeTerminalPane) : undefined,
      paste: () => terminalSurface.pasteIntoTerminal(),
      removeWorktree: () => activeAgentSession.activeTerminalPane ? terminalSurface.closeWorktreePane(activeAgentSession.activeTerminalPane.id) : undefined,
      renamePane: () => activeAgentSession.activeTerminalPane ? renameTerminalPane(activeAgentSession.activeTerminalPane) : undefined,
      restartPane: () => activeAgentSession.activeTerminalPane ? terminalSurface.restartTerminalPane(activeAgentSession.activeTerminalPane) : undefined,
      saveTranscript: saveActivePaneTranscript,
    },
  });

  const appMenuAssembly = createAppMenuAssembly({
    activityLog: () => activeAgentSession.selectedAgentActivityLog,
    browser: {
      back: () => browser.goHistory(-1), canGoBack: browser.canGoBack,
      canGoForward: browser.canGoForward, forward: () => browser.goHistory(1),
      openExternal: () => openUrl(browser.url), reload: browser.reload, url: browser.url,
    },
    composer: {
      activeRun: Boolean(activeChat.activeChatConversation.activeRunId),
      attachCurrent: () => attachSelectedFileToComposer(),
      attachLocal: () => composerAttachments.attachLocalFiles(),
      attachPreview: () => composerAttachments.attachPreview(),
      canAttachCurrent: Boolean(editorSession.selectedFile),
      canRunParallel: Boolean(workspacePath && activeChat.activeSessionId && !activeChat.activeChatConversation.activeRunId),
      clearDraft: () => composerLocal.setLocalState(activeChat.activeComposerHarnessKey, "", composerLocal.history),
      copyWorkspace: () => workspacePath ? editorSurface.copyPath(workspacePath) : undefined,
      draft: composerLocal.draft, hasWorkspace: Boolean(workspacePath),
      parallel: () => { setOrchestrationError(null); setOrchestrationOpen(true); },
      send: () => composerSurface.submitComposerDraft(), sending: composerSending,
      shortcut: shortcutKeys("composer.send"), stop: () => chatRunControls.stopActiveChatRun(),
    },
    copyText: writeText,
    notify: chrome.setActionNotice,
    pane: {
      activePaneId: terminal.activePaneId, changing: profiles.changing,
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
      activeMode: shellLayout.utilityTrayMode, activePaneState: activeAgentSession.activeTerminalPane?.state ?? null,
      activeSurface: shellLayout.agentSurfaceMode === "terminal",
      closePane: () => activeAgentSession.activeTerminalPane ? terminalSurface.closeTerminalPane(activeAgentSession.activeTerminalPane.id) : undefined,
      createShell: () => terminalSurface.createTerminalPane(defaultTerminalLaunchProfile()),
      hasActivePane: Boolean(activeAgentSession.activeTerminalPane), hasWorkspace: Boolean(workspacePath),
      hide: () => shellLayout.setAgentSurfaceMode("chat"),
      killPane: () => activeAgentSession.activeTerminalPane ? terminalSurface.terminateTerminalPane(activeAgentSession.activeTerminalPane) : undefined,
      launchProfileChanging: profiles.changing,
      restartPane: () => activeAgentSession.activeTerminalPane ? terminalSurface.restartTerminalPane(activeAgentSession.activeTerminalPane) : undefined,
      show: (nextMode) => { shellLayout.setUtilityTrayMode(nextMode); shellLayout.setAgentSurfaceMode("terminal"); },
    },
  });

  const activeTerminalPaneLabelForCommands = activePaneDisplayLabel(terminal.panes, activeAgentSession.activeTerminalPane);
  const commandPaletteNavigation = {
    drawerModes: DRAWER_MODES,
    editorTabs: editorSession.editorTabs,
    files: editorWorkspace.searchableFiles,
    onFocusWorktree: (paneId: number) => {
      shellLayout.setAgentSurfaceMode("terminal");
      void terminalSurface.focusTerminalPane(paneId);
    },
    onLayoutChange: shellLayout.setWorkbenchLayout,
    onOpenFile: (file: FileTreeNode) => void editorFileWorkflow.requestOpen(file, { focusEditor: true }),
    onShowDrawer: (mode: SideDrawerMode) => {
      shellLayout.setSideDrawerCollapsed(false);
      shellLayout.setSideDrawerMode(mode);
    },
    onTrayModeChange: shellLayout.setToolTrayMode,
    terminalPanes: terminal.panes,
    workbenchLayout: shellLayout.workbenchLayout,
    workspacePath,
    worktrees,
  };
  const commandPaletteTerminal = {
    activePane: activeAgentSession.activeTerminalPane,
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
    activeComposerHarnessKey: activeChat.activeComposerHarnessKey,
    browserUrl: browser.url,
    detectedBrowserUrl: browser.activeDetectedServer?.url ?? null,
    editorDirty: editorWorkspace.editorDirty,
    editorLoading: editorSession.editorLoading,
    editorSaving: editorSession.editorSaving,
    onAttachCurrentFile: () => void attachSelectedFileToComposer(),
    onAttachPreview: () => void composerAttachments.attachPreview(),
    onCloseEditorTab: () => { if (editorSession.selectedFile) void editorNavigation.closeTab(editorSession.selectedFile); },
    onExportPerformance: () => void exportRenderPerfSnapshot(),
    onFindEditor: editorSurface.openEditorSearch,
    onOpenDetectedBrowser: () => void browser.openDetectedServer(),
    onOpenSettings: () => setSettingsOpen(true),
    onOpenTranscripts: () => paneTranscripts.setTranscriptsOpen(true),
    onOpenWorkspace: () => void pickWorkspace(),
    onQuickOpen: quickOpen.openDialog,
    onReloadBrowser: browser.reload,
    onResetLayout: shellLayout.resetInterface,
    onSaveEditor: () => void saveEditorFile(),
    selectedFile: editorSession.selectedFile,
    shortcut: shortcutKeys,
    workspacePath,
  };
  const commandPaletteChats = {
    activeRun: Boolean(activeChat.activeChatConversation.activeRunId),
    activeSessionId: activeChat.activeSessionId,
    onOpenSearchResult: (result: ChatSearchViewResult) => void openChatSearchResult(result),
    onOpenSession: (projectPath: string, sessionId: string) => void projectSessionNavigationActions.switchSession(projectPath, sessionId),
    onParallel: () => {
      setOrchestrationError(null);
      setOrchestrationOpen(true);
    },
    openProjects: visibleOpenProjects,
    projectSessions: persistence.projectSessions,
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
  const tabIsDirty = (path: string) => editorWorkspace.dirtyTabPathSet.has(path);
  const editorNavigation = useEditorNavigationLifecycle({
    activeFile: editorSession.selectedFile,
    captureEditor: () => { editorSession.captureCurrentEditorViewState(); editorSession.captureCurrentEditorBuffer(); },
    closeProject: async (projectPath) => { await projectCloseController.closeProjectDirect(projectPath); },
    confirmClose: (message) => confirmDialog(message),
    editorTabs: editorSession.editorTabs,
    isDirty: tabIsDirty,
    onActivateTab: async (tab) => {
      editorSession.selectedFileRef.current = null;
      editorSession.setSelectedFile(null);
      await editorFileWorkflow.openDirect(tab, { focusEditor: true });
    },
    onRemoveTab: (path) => {
      delete editorSession.editorBuffersRef.current[path];
      delete editorSession.editorViewStatesRef.current[path];
      editorSession.setEditorBufferRevision((value) => value + 1);
    },
    onResetAfterClose: () => {
      if (workspacePathRef.current) void persistence.clearActiveFile(workspacePathRef.current);
      editorSession.resetEditor();
    },
    openFile: async (file, options) => { await editorFileWorkflow.openDirect(file, options); },
    openWorkspace: async (path) => { await workspaceOpenActions.openWorkspaceDirect(path); },
    saveEditorFile: () => saveEditorFile(),
    setEditorTabs: editorSession.setEditorTabs,
  });

  editorSession.saveEditorFileRef.current = saveEditorFile;
  editorSession.openEditorSearchRef.current = editorSurface.openEditorSearch;
  editorSession.closeActiveEditorTabRef.current = editorNavigation.closeActiveTab;

  useEffect(() => {
    void invoke("update_agent_hook_snapshot", {
      snapshot: buildAgentHookSnapshot({
        activeChatId: activeChat.activeSessionId,
        activeProjectPath: workspacePath,
        editorTabs: editorSession.editorTabs,
        openProjects: persistence.openProjects,
        panes: terminal.panes,
        selectedFilePath: editorSession.selectedFile?.path ?? null,
      }),
    }).catch(() => {});
  }, [activeChat.activeSessionId, editorSession.editorTabs, persistence.openProjects, editorSession.selectedFile?.path, terminal.panes, workspacePath]);

  useAgentHookRequests({
    setStatus: setAgentHookStatus,
    isPaneOpen: (paneId) => terminal.panesRef.current.some((pane) => pane.id === paneId),
    focusPane: (paneId) => terminalSurface.focusTerminalPane(paneId, "agent"),
    getWorkspacePath: () => workspacePathRef.current,
    openFile: (root, path) => editorFileWorkflow.requestOpen(
      fileTreeNodeFromPath(`${root}/${path}`, "file"),
      { focusEditor: true },
      "agent",
    ),
    createShell: () => terminalSurface.createTerminalPane(defaultTerminalLaunchProfile(), "agent"),
    recordReport: (report) => agentActivityHook.recordAgentActivity(agentActivityHook.activeChatActivityHandle(), hookReportToActivity(report)),
  });

  useSyncRef(workspacePathRef, workspacePath);

  useEffect(() => {
    if (!workspacePath || workspaceTree.loading || workspaceTree.error || workspaceTree.tree.length === 0 || editorSession.selectedFile) return;
    if (editorSession.restoredActiveFileWorkspaceRef.current === workspacePath) return;
    editorSession.restoredActiveFileWorkspaceRef.current = workspacePath;
    const savedActiveFile = editorSession.activeFilesByWorkspaceRef.current[workspacePath];
    if (!savedActiveFile) return;
    const node = findFileTreeNode(workspaceTree.tree, savedActiveFile);
    if (node?.kind === "file") {
      void editorFileWorkflow.openDirect(node);
      return;
    }
    void persistence.clearActiveFile(workspacePath);
  }, [workspaceTree.tree, workspaceTree.error, workspaceTree.loading, editorSession.selectedFile, workspacePath]);


  useWorkspaceTreeWatcher({
    getActiveRoot: () => workspacePathRef.current,
    onChange: workspaceTree.refresh,
    onError: (error) => workspaceTree.setError(`Live file watcher unavailable: ${error}`),
    workspacePath,
  });

  // Reopen the last folder on startup, otherwise ask for a workspace.
  const workspaceBootstrapController = createWorkspaceBootstrapController({
    hydrateProfiles: profiles.hydrate,
    loadBootstrap: loadWorkspaceBootstrap,
    openWorkspace: (folder, profile) => workspaceOpenActions.openWorkspaceDirect(folder, profile),
    pickWorkspace,
    refreshSecretPresence: (settings) => { void mcpOAuth.refreshSecretPresence(settings); },
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
        setAgentActivity: agentActivityHook.setAgentActivityEvents,
        setAiConnectionSettings,
        setCommandPaletteSources,
        setKeybindingOverrides,
        setKeybindings: setActiveKeybindingOverrides,
        setPaneLabels: terminal.setPaneLabels,
        setPaneTranscripts: paneTranscripts.setPaneTranscripts,
        setWorktrees,
      },
    }),
  });

  useTerminalCanvasRuntime({
    canvasRef,
    imeInputRef,
    terminalHostRef,
    activePaneIdRef: terminal.activePaneIdRef,
    latest,
    frame,
    metrics,
    selection,
    selecting,
    requestPaintRef: terminal.requestPaintRef,
    renderPerfRef,
    onCommandPalette: commandPalette.openDialog,
    onQuickOpen: quickOpen.openDialog,
    onSettings: () => setSettingsOpen(true),
    onResize: sendTerminalResize,
    onReady: async () => {
      const staleLock = await invoke<boolean>("begin_session").catch(() => false);
      await workspaceBootstrapController.initWorkspace();
      chrome.setCrashNotice(crashRecoveryMessage(deriveCrashRecovery(staleLock, persistence.openProjectsRef.current.length)));
      window.addEventListener("beforeunload", () => { void invoke("end_session_clean").catch(() => {}); });
    },
  });

  const terminalRuntimeEventHandlers = createTerminalRuntimeEventHandlers(terminalRuntimeFromHook(terminal, {
    activeSessionForProject: persistence.activeSessionForProject,
    approvalMode: agentApprovalMode,
    detectLocalServer: detectLocalDevServerFromSnapshot,
    ipcSampleCounter, latest, notificationsEnabled: chrome.notificationsEnabledRef,
    notifyBackgroundExit, now: Date.now, persistTranscript: paneTranscripts.persistPaneTranscript,
    recordActivity: agentActivityHook.recordAgentActivity,
    recordIpcPayload: recordIpcPayloadBytes, renderPerf: renderPerfRef,
    requestPaint: () => terminal.requestPaintRef.current(), setBackgroundExits,
    setError: setLaunchError, snapshotText: terminalSnapshotText,
    updateProjectStatus: persistence.updateOpenProjectStatus,
    updateSessionStatus: persistence.updateSessionStatus, workspacePath: workspacePathRef,
  }));

  useNativeAppEvents<TerminalGridPayload<Snapshot>, TerminalPaneExitPayload>({
    onGrid: terminalRuntimeEventHandlers.handleGridPayload,
    onOpenFolder: () => { void pickWorkspace(); },
    onSaveFile: () => { void editorSession.saveEditorFileRef.current(); },
    onFindInFile: () => editorSession.openEditorSearchRef.current(),
    onCloseEditorTab: () => { void editorSession.closeActiveEditorTabRef.current(); },
    onPaneExit: terminalRuntimeEventHandlers.handlePaneExit,
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
    setNotificationsEnabled: chrome.setNotificationsEnabled,
    setTheme: chrome.setAppTheme,
  });
  const settingsScopedActions = createSettingsScopedActions({
    clearScopedSetting: composerWorkspace.clearScopedSetting,
    readEffectiveBrowserUrl: () => resolveScopedSetting(
      composerWorkspace.scopedSettingsRef.current, "browserUrl", workspacePathRef.current,
      persistence.activeSessionForProject(workspacePathRef.current),
    ).value,
    resolveLaunchProfile: profiles.resolveProfile,
    restoreBrowserPreview: () => browser.restoreScopedUrl(
      workspacePathRef.current, persistence.activeSessionForProject(workspacePathRef.current),
    ),
    setBrowserLocation: browser.setLocation,
    setComposerApprovalMode: composerSettingsActions.setApprovalMode,
    switchLaunchProfile: profiles.switchLaunchProfile,
    updateScopedSetting: composerWorkspace.updateScopedSetting,
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
    clearSecretPresence: (keys) => mcpOAuth.setSecretPresence((current) => ({
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
    recordOAuthStatus: (id, status) => mcpOAuth.setStatuses((current) => ({ ...current, [id]: status })),
    reload: () => window.location.reload(),
    resetDurableChats: resetDurableChatStore,
    resetNativeState: () => invoke("reset_local_state"),
    startOAuth: (input) => invoke<McpOAuthStart>("begin_mcp_oauth", input),
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
        createSession: projectSessionNavigationActions.createSession,
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
        rail: <WorkspaceSideRail
        activeTitle={drawerActiveTitle}
        collapsed={shellLayout.sideDrawerCollapsed}
        mode={shellLayout.sideDrawerMode}
        onOpenSettings={() => setSettingsOpen(true)}
        onSelectMode={shellLayout.setSideDrawerMode}
        projects={{
          activeProjectPath: workspacePath, activeSessionId: activeChat.activeSessionId, backgroundExits,
          expandedProjects: persistence.expandedSessionProjects, projects: visibleOpenProjects,
          sessionsByProject: persistence.projectSessions, showArchived: persistence.showArchivedSessions,
          projectStatus: projectRailStatus, sessionStatus: projectSessionStatus,
          onProjectContextMenu: (event, project) => contextMenuHost.openContextMenu(event, projectRailContextMenuItems(project)),
          onSelectProject: (path) => void requestOpenWorkspace(path),
          onSelectSession: (path, sessionId) => void projectSessionNavigationActions.switchSession(path, sessionId),
          onSessionContextMenu: (event, path, session) => contextMenuHost.openContextMenu(event, projectSessionContextMenuItems(path, session)),
          onToggleArchived: () => persistence.setShowArchivedSessions((show) => !show),
          onToggleExpanded: (path) => persistence.setExpandedSessionProjects((expanded) => toggleExpandedProject(expanded, path)),
        }}
        git={{
          error: gitStatusHook.error, hasWorkspace: Boolean(workspacePath), loading: gitStatusHook.loading,
          status: gitStatusHook.status,
          onOpenDiff: (file) => void diffReviewHook.open(file), onRefresh: () => void gitStatusHook.refresh(),
        }}
        browser={browserToolsDrawerPropsFrom(browser, {
          openExternal: openUrl,
          show: () => shellLayout.setWorkbenchLayout(shellLayout.workbenchLayout === "hidden" ? "right" : shellLayout.workbenchLayout),
        })}
        settings={quickSettingsDrawerPropsFrom({
          composer: {
            approvalMode: activeChat.activeComposerHarness.approvalMode,
            canSetApproval: Boolean(activeChat.activeComposerHarnessKey),
          },
          handlers: {
            approvalChange: composerSettingsActions.setApprovalMode,
            layoutChange: shellLayout.setWorkbenchLayout,
            openFolder: () => pickWorkspace(),
            refreshFiles: workspaceTree.refresh,
            setSurfaceMode: shellLayout.setAgentSurfaceMode,
            toggleRawTerminal: utilityTrayControls.toggleRawTerminal,
            toolModeChange: shellLayout.setToolTrayMode,
          },
          layout: {
            surfaceMode: shellLayout.agentSurfaceMode, toolMode: shellLayout.toolTrayMode,
            workbenchLayout: shellLayout.renderedWorkbenchLayout,
          },
          profiles,
          workspacePath,
        })}
        files={{
          fileOpError: editorSession.fileOpError, fileTree: workspaceTree.tree, fileTreeError: workspaceTree.error, fileTreeLoading: workspaceTree.loading, fileTreeTruncated: workspaceTree.truncated,
          railBodyRef, railHeight, selectedFileId: editorSession.selectedFile?.id, treeRef, visibleFileTree: editorWorkspace.visibleFileTree,
          workspaceName: workspacePath ? pathBasename(workspacePath) : null, workspacePath,
          onCreateFile: () => void workspaceFileActions.createFile(), onCreateFolder: () => void workspaceFileActions.createFolder(),
          onOpenFile: (file) => void editorFileWorkflow.requestOpen(file, { focusEditor: true }),
          onOpenFolder: () => void pickWorkspace(),
          onWorkspaceContextMenu: (event) => contextMenuHost.openContextMenu(event, workspaceContextMenuItems()),
        }}
      />,
        main: <>
        <WorkbenchDockPanels
          files={{
            error: workspaceTree.error, loading: workspaceTree.loading, query: drawerSearchQuery,
            results: drawerSearchResults, searchable: editorWorkspace.searchableFiles,
            selectedFilePath: editorSession.selectedFile?.path ?? null,
          }}
          git={{ error: gitStatusHook.error, loading: gitStatusHook.loading, status: gitStatusHook.status }}
          handlers={{
            createFile: () => void workspaceFileActions.createFile(),
            createFolder: () => void workspaceFileActions.createFolder(),
            gitFileContextMenu: (event, file) => contextMenuHost.openContextMenu(
              event, buildGitFileContextMenuItems(file, workspaceContextMenuActions),
            ),
            openDiff: (gitFile) => void diffReviewHook.open(gitFile),
            openFile: (treeFile) => void editorFileWorkflow.requestOpen(treeFile, { focusEditor: true }),
            refreshFiles: workspaceTree.refresh,
            refreshGit: () => void gitStatusHook.refresh(),
            setQuery: setDrawerSearchQuery,
          }}
          workspacePath={workspacePath}
        />
        <WorkbenchEditorSection
          activeFileMissing={editorWorkspace.activeFileMissing}
          code={{
            conflict: editorWorkspace.editorSaveConflict, error: editorSession.editorError, loading: editorSession.editorLoading,
            recoveryError: editorSession.editorRecoveryError, saving: editorSession.editorSaving, text: editorSession.editorText,
          }}
          cursor={editorSession.editorCursor}
          diff={{
            breadcrumbs: editorWorkspace.diffBreadcrumbs, canDiscard: editorWorkspace.diffReviewCanDiscard,
            canOpenFile: editorWorkspace.diffReviewCanOpenFile, canStage: editorWorkspace.diffReviewCanStage,
            canUnstage: editorWorkspace.diffReviewCanUnstage, error: diffReviewHook.error,
            loading: diffReviewHook.loading, review: diffReviewHook.review,
          }}
          editorBreadcrumbs={editorWorkspace.editorBreadcrumbs}
          editorBytesLabel={formatBytes(editorSession.editorBytes)}
          editorDirty={editorWorkspace.editorDirty}
          editorLanguage={editorWorkspace.editorLanguage}
          editorLoading={editorSession.editorLoading}
          editorSaving={editorSession.editorSaving}
          handlers={{
            closeActiveTab: () => void editorNavigation.closeActiveTab(),
            closeDiff: diffReviewHook.close,
            closeTab: (tab) => void editorNavigation.closeTab(tab),
            copyDiff: () => void diffReviewHook.copy(),
            find: editorSurface.openEditorSearch,
            onChange: editorSession.setEditorText,
            onCreateEditor: editorSurface.restoreEditorView,
            onUpdate: handleEditorUpdate,
            openContextMenu: (kind, event) => contextMenuHost.openContextMenu(
              event, kind === "diff" ? diffContextMenuItems() : editorContextMenuItems(),
            ),
            openDiff: (line = null) => void editorSurface.openDiffFile(line),
            openExternally: () => void editorSurface.openExternally(),
            overwrite: () => void editorSurface.overwrite(),
            reload: () => void editorSurface.reloadFromDisk(),
            runDiffAction: (action) => { if (diffReviewHook.review) void diffReviewHook.runFileAction(action, diffReviewHook.review.file); },
            save: () => void saveEditorFile(),
            selectTab: (tab) => void editorFileWorkflow.requestOpen(tab, { focusEditor: true }),
            tabContextMenu: (event, tab) => contextMenuHost.openContextMenu(event, editorTabContextMenuItems(tab)),
          }}
          selectedFile={editorSession.selectedFile}
          tabIsDirty={tabIsDirty}
          tabs={editorSession.editorTabs}
        />

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

        <AgentConversationPanel
          surfaceMode={shellLayout.agentSurfaceMode}
          chat={{
            conversation: activeChat.activeChatConversation,
            events: activeAgentSession.selectedAgentActivityLog,
            hidden: false,
            onSuggestion: (draft) => composerLocal.setLocalState(activeChat.activeComposerHarnessKey, draft, composerLocal.history),
            onRetry: (prompt) => void composerSurface.submitComposerDraft(prompt),
            onApprovalDecision: (message, decision) => void chatRunControls.resolveChatApproval(message, decision),
            onToggleBookmark: chatConversationActions.toggleBookmark,
            onForkMessage: (message) => void chatConversationActions.forkFromMessage(message),
            onReviewFile: (path) => void editorSurface.reviewRunCardFile(path),
            focusMessageId: focusedChatMessageId,
          }}
          composer={{
            activeRun: Boolean(activeChat.activeChatConversation.activeRunId),
            approvalMode: activeChat.activeComposerHarness.approvalMode,
            attachments: activeChat.activeComposerHarness.attachments,
            configuredModels: aiConnectionSettings.providerModels,
            draft: composerLocal.draft, error: composerError, goal: activeChat.activeComposerHarness.goal,
            hasHarness: Boolean(activeChat.activeComposerHarnessKey),
            hasHistory: composerLocal.history.length > 0,
            historyCursorActive: composerLocal.historyIndex != null,
            mentionResults: composerMentionQuery != null ? composerMentionResults : [],
            model: activeChat.activeComposerHarness.model, notice: composerNotice,
            provider: activeChat.activeComposerProvider,
            reasoningEffort: activeChat.activeComposerHarness.reasoningEffort, sending: composerSending,
            onApprovalChange: (mode) => void composerSettingsActions.setApprovalMode(mode),
            onAttachMention: (file) => {
              composerLocal.setLocalState(activeChat.activeComposerHarnessKey, composerLocal.draft.replace(/@[^\s@]*$/, ""), composerLocal.history);
              void composerAttachments.attachWorkspaceFile(file);
            },
            onClearGoal: () => void composerSettingsActions.setGoal(""),
            onContextMenu: (event) => contextMenuHost.openContextMenu(event, appMenuAssembly.composerContextMenuItems()),
            onDismissNotice: () => setComposerNotice(null),
            onDraftChange: (draft) => {
              composerLocal.setLocalState(activeChat.activeComposerHarnessKey, draft, composerLocal.history);
              composerLocal.setHistoryIndex(null);
            },
            onGoalChange: (goal) => void composerSettingsActions.setGoal(goal),
            onGoalCommit: () => void composerSettingsActions.setGoal(activeChat.activeComposerHarness.goal, { log: true }),
            onManageModels: () => setSettingsOpen(true),
            onNextHistory: composerHistoryNavigation.showNext,
            onOpenAddMenu: appMenuAssembly.openComposerAddMenu,
            onPasteImage: () => void composerAttachments.pasteImage(),
            onPreviousHistory: composerHistoryNavigation.showPrevious,
            onReasoningChange: composerSettingsActions.setReasoningEffort,
            onRemoveAttachment: (attachment) => void composerAttachments.removeAttachment(attachment),
            onReviewContext: () => void composerAttachments.reviewContext(),
            onRuntimeChange: composerSettingsActions.setRuntime,
            onStop: () => void chatRunControls.stopActiveChatRun(),
            onSubmit: () => void composerSurface.submitComposerDraft(),
          }}
        />
        <BottomUtilityTray
          activePane={activeAgentSession.activeTerminalPane} activePaneId={terminal.activePaneId}
          activeProfileLabel={activeTerminalProfile.label} canClose={Boolean(activeAgentSessionHandle)}
          canvasRef={canvasRef} events={activeAgentSession.selectedAgentActivityLog} find={terminalFind}
          hasWorkspace={Boolean(workspacePath)} imeInputRef={imeInputRef}
          launchProfile={profiles.terminalProfile} launchProfileChanging={profiles.changing}
          launchProfiles={profiles.allProfiles}
          mode={shellLayout.utilityTrayMode} open={shellLayout.agentSurfaceMode === "terminal"} panes={terminal.panes}
          terminalHostRef={terminalHostRef}
          onClose={() => { if (activeAgentSessionHandle) void activeAgentSessionHandle.close(); }}
          onCreate={(profile) => void terminalSurface.createTerminalPane(profile)} onFocus={(paneId) => void terminalSurface.focusTerminalPane(paneId)}
          onKill={() => { if (activeAgentSession.activeTerminalPane) void terminalSurface.terminateTerminalPane(activeAgentSession.activeTerminalPane); }}
          onOpenFolder={() => void pickWorkspace({ openTerminal: true })}
          onOpenTab={(mode) => void utilityTrayControls.openUtilityTray(mode)}
          onPaneContextMenu={(event, pane) => contextMenuHost.openContextMenu(event, appMenuAssembly.terminalPaneContextMenuItems(pane))}
          onPaste={(text) => { invoke("paste", { text }).catch(() => {}); }}
          onProfileChange={(profileId) => {
            void profiles.switchTerminalProfile(profiles.resolveProfile(profileId));
          }}
          onRename={(pane) => void renameTerminalPane(pane)}
          onResizeStart={(event) => { shellLayout.setAgentSurfaceMode("terminal"); shellLayout.beginUtilityTrayResize(event); }}
          onRestart={() => { if (activeAgentSession.activeTerminalPane) void terminalSurface.restartTerminalPane(activeAgentSession.activeTerminalPane); }}
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
          deleteConnectionSecret: mcpOAuth.deleteSecret,
          openAgentConnection: utilityTrayControls.openAgentConnection,
          openSourceControlLink: (url) => openUrl(url).catch(() => {}),
          refreshAgentConnections: settingsRuntime.refreshAgentConnections,
          resetLayout: shellLayout.resetInterface,
          saveConnectionSecret: mcpOAuth.saveSecret,
          saveConnectionSettings: settingsConnectionActions.saveSettings,
          setLayout: shellLayout.setWorkbenchLayout,
          setTrayMode: shellLayout.setToolTrayMode,
        }}
        modal={{
          agentConnectionsRefreshing: settingsRuntime.agentConnectionsRefreshing, agentConnectionsStatus: settingsRuntime.agentConnectionsStatus, agentHookStatus,
          aiConnectionSettings,
          approvalSetting: activeChat.activeApprovalSetting,
          browserSetting: activeChat.activeBrowserSetting,
          commandPaletteSources, connectionSecretPresence: mcpOAuth.secretPresence,
          customTerminalProfiles: profiles.customProfiles,
          gitBranch: gitStatusHook.status?.branch ?? null,
          gitChangeCount: gitStatusHook.status ? gitStatusHook.status.files.length : null,
          keybindingOverrides,
          layout: shellLayout.renderedWorkbenchLayout,
          mcpOAuthStatuses: mcpOAuth.statuses, notificationsEnabled: chrome.notificationsEnabled,
          profileSetting: activeChat.activeAgentProfileSetting,
          profiles: settingsAgentProfileOptions(LAUNCH_PROFILES),
          repoLocation: settingsRuntime.repoLocation,
          sessionTitle: surfaceLabels.activeSessionTitle,
          sourceControlStatus: settingsRuntime.sourceControlStatus,
          theme: chrome.appTheme,
          trayMode: shellLayout.toolTrayMode,
          workspaceName: surfaceLabels.activeWorkspaceName,
          workspacePath: workspacePath ?? "",
        }}
      />
      <TranscriptsModal {...transcriptsModalPropsFrom(
        { openTranscriptId: paneTranscripts.openTranscriptId, paneTranscripts: paneTranscripts.paneTranscripts, setOpenTranscriptId: paneTranscripts.setOpenTranscriptId, setTranscriptsOpen: paneTranscripts.setTranscriptsOpen, transcriptsOpen: paneTranscripts.transcriptsOpen },
        { projectId: workspacePath, projectSessionId: activeChat.activeSessionId },
      )} />
      <AppRuntimeDialogs
        notices={appNoticesPropsFrom({
          chrome: { actionNotice: chrome.actionNotice, crashNotice: chrome.crashNotice, setActionNotice: chrome.setActionNotice, setCrashNotice: chrome.setCrashNotice },
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
          activeProvider: activeChat.activeComposerProvider,
          approvalMode: activeChat.activeComposerHarness.approvalMode,
          conversationProvider: activeChat.activeChatConversation.provider,
          derived: deriveOrchestrationDialogState({
            activeSessionId: activeChat.activeSessionId, conversations: composerWorkspace.chatConversations,
            sessions: persistence.projectSessions, workspacePath,
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
