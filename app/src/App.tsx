import { type CSSProperties, type FormEvent, type MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from "react";
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
import { BrowserToolsDrawer } from "./BrowserToolsDrawer";
import { SourceControlDrawer } from "./SourceControlDrawer";
import { QuickSettingsDrawer } from "./QuickSettingsDrawer";
import { FilesSideDrawer } from "./FilesSideDrawer";
import { ProjectThreadsDrawer } from "./ProjectThreadsDrawer";
import { FilesDock, SourceControlDock } from "./WorkbenchDocks";
import { WorkbenchResizers } from "./WorkbenchResizers";
import { DRAWER_MODES, drawerTitleFor } from "./drawerModes";
import { EditorChrome } from "./EditorChrome";
import { EditorDiffView } from "./EditorDiffView";
import { EditorCodeSurface } from "./EditorCodeSurface";
import { AgentComposerSurface } from "./AgentComposerSurface";
import { AppRuntimeDialogs } from "./AppRuntimeDialogs";
import {
  DEFAULT_BROWSER_PREVIEW_URL,
  detectLocalDevServerUrl,
  normalizeBrowserPreviewUrl,
} from "./browserPreview";
import { useBrowserPreviewState } from "./useBrowserPreviewState";
import { useFilesRailHeight } from "./useFilesRailHeight";
import { useComposerLocalState } from "./useComposerLocalState";
import { useComposerAttachments } from "./useComposerAttachments";
import { useEditorNavigationLifecycle } from "./useEditorNavigationLifecycle";
import { createWorkspacePersistence } from "./workspacePersistence";
import {
  createTerminalPaneContexts,
  type ActiveTerminalPaneByContext,
  type TerminalPanesByContext,
} from "./terminalPaneContexts";
import type { BrowserPreviewRecords } from "./browserPreview";
import { selectionToText } from "./selection";
import type { SelectionRange } from "./selection";
import {
  activeProjectSessionId,
  planProjectClose,
  removeOpenProject,
  setOpenProjectStatus,
  setProjectSessionStatus,
  setProjectSessionArchived,
  setProjectSessionPinned,
  upsertProjectSession,
} from "./workspaceState";
import type { ActiveFileByWorkspace, ActiveSessionByProject, OpenProject, ProjectRailStatus, ProjectSession, ProjectSessionsByProject } from "./workspaceState";
import {
  clampEditorViewState,
  findFileTreeNode,
  reconcileActiveFileNode,
} from "./editorState";
import type { CursorPosition, EditorViewState } from "./editorState";
import {
  type EditorFileBuffer,
  type EditorFileLoadState,
} from "./editorFileLoadState";
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
  createCustomLaunchProfile,
  defaultLaunchProfile,
  defaultTerminalLaunchProfile,
  launchProfileById,
} from "./launchProfiles";
import type { LaunchProfile } from "./launchProfiles";
import {
  defaultScopedSettings,
  resetScopedSetting,
  resolveScopedSetting,
  setScopedSetting,
} from "./scopedSettings";
import type { ScopedSettingKey, ScopedSettingsState, SettingsScope } from "./scopedSettings";
import {
  composerHistoryAt,
  nextComposerHistoryIndex,
  previousComposerHistoryIndex,
  COMPOSER_APP_COMMANDS,
} from "./agentComposer";
import type { ComposerAppCommand } from "./agentComposer";
import { runComposerAppCommand as runComposerAppCommandWithContext } from "./composerAppCommands";
import type { ComposerHarnessRecords, ComposerReasoningEffort } from "./composerHarness";
import { submitComposerDraft as submitComposerDraftWithContext } from "./composerSubmission";
import {
  appActionAuditLabel,
  createAppAction,
  resolveAppAction,
} from "./appActions";
import type { AppActionAuditEvent, AppActionDescriptor } from "./appActions";
import {
  buildAgentSessionHandleDescriptor,
  readTailFromSnapshot,
} from "./agentSessionHandle";
import type { AgentApprovalMode, AgentSessionHandle, AgentSessionHandleDescriptor } from "./agentSessionHandle";
import { executeAgentPaneInterrupt } from "./agentPaneInterrupt";
import { executeTerminalPaneClose } from "./terminalPaneCloseWorkflow";
import { AppIcon } from "./icons";
import type { AppIconName } from "./icons";
import {
  setActiveKeybindingOverrides,
  shortcutKeys,
  type KeybindingOverrides,
} from "./shortcuts";
import { filterCommandPaletteCommands } from "./commandPalette";
import { buildChatPaletteCommands } from "./commandPaletteChats";
import {
  buildCommandPaletteLayoutCommands,
  buildCommandPaletteResourceCommands,
} from "./commandPaletteNavigation";
import {
  buildTerminalFindCommands,
  buildTerminalLifecycleCommands,
} from "./commandPaletteTerminal";
import {
  buildBrowserCommands,
  buildChromeCommands,
  buildComposerAttachmentCommands,
  buildEditorCommands,
  buildWorkspaceCommands,
  buildWorkspaceOpenCommands,
} from "./commandPaletteWorkbench";
import { SearchCommandDialog, type SearchDialogCommand } from "./SearchCommandDialog";
import { useCommandPalette } from "./useCommandPalette";
import { QuickOpenDialog } from "./QuickOpenDialog";
import { useQuickOpen } from "./useQuickOpen";
import {
  DEFAULT_COMMAND_PALETTE_SOURCES,
} from "./commandPaletteSources";
import { filterWorkspaceFiles } from "./workspaceSearch";
import {
  MAX_AGENT_ACTIVITY_LOG_EVENTS,
  createAgentActivityEvent,
  pushAgentActivityEvent,
} from "./agentActivity";
import type { AgentActivityEvent, AgentActivityLogFilter } from "./agentActivity";
import {
  normalizeTerminalPaneLabel,
  terminalPaneLabelForDisplay,
} from "./terminalPane";
import type { TerminalPaneState } from "./terminalPane";
import type { GitStatusFile } from "./fileGitStatus";
import { useGitStatus } from "./useGitStatus";
import { useGitDiffReview } from "./useGitDiffReview";
import type { PaneLayoutsBySession } from "./sessionRestore";
import { useShellLayout, type SideDrawerMode } from "./useShellLayout";
import { useAppChromeState } from "./useAppChromeState";
import { useSettingsRuntimeStatus } from "./useSettingsRuntimeStatus";
import { useSyncRef } from "./useSyncRef";
import { loadWorkspaceBootstrap, type PaneLabelsBySession } from "./workspaceBootstrap";
import { applyWorkspaceCleanupRecord } from "./workspaceOpenRecovery";
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
  type McpServerConfig,
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
  buildBrowserContextMenuItems,
  buildComposerAddMenuItems,
  buildComposerContextMenuItems,
} from "./browserComposerContextMenu";
import { planPaneExit } from "./paneExitPlan";
import { planProjectSessionDelete } from "./deleteProjectSessionPlan";
import { executeProjectSessionDelete } from "./projectSessionDelete";
import { executeTerminalPaneRestart } from "./terminalPaneRestartWorkflow";
import { executeTerminalPaneTerminate } from "./terminalPaneTerminate";
import { createSessionCheckpointActions } from "./sessionCheckpointActions";
import { buildCreatedTerminalPane } from "./terminalPaneCreate";
import { buildCreatedWorktreePaneState } from "./terminalWorktreePaneCreate";
import { openWorkspaceTerminalPanes } from "./workspaceOpenPanes";
import { prepareWorkspaceOpenSession } from "./workspaceOpenSession";
import { persistMissingWorkspaceCleanup } from "./workspaceOpenRecoveryPersistence";
import { persistWorkspaceOpenFailure, persistWorkspaceOpenSuccess } from "./workspaceOpenPersistence";
import { requestWorkspaceOpen } from "./workspaceOpenRequest";
import {
  addBackgroundExit,
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
import { executeWorkspaceOpenFailure } from "./workspaceOpenFailureWorkflow";
import { resolveWorkspaceOpenTarget } from "./workspaceOpenTarget";
import { executeWorkspaceOpenSuccess } from "./workspaceOpenSuccessWorkflow";
import {
  addPaneTranscript,
  buildPaneTranscript,
  type PaneTranscript,
} from "./paneTranscripts";
import { TranscriptsModal } from "./TranscriptsModal";
import { useTerminalFind } from "./useTerminalFind";
import { ChatThreadSurface } from "./ChatThreadSurface";
import {
  appendToolChatMessage,
  applyChatRunEnvelope,
  chatProviderLabel,
  emptyChatConversation,
} from "./chatConversation";
import type { ChatConversation, ChatConversationRecords, ChatMessage, ChatProvider } from "./chatConversation";
import { useChatRunEvents } from "./useChatRunEvents";
import { useWorkspaceTreeWatcher } from "./useWorkspaceTreeWatcher";
import { useWorkspaceTree } from "./useWorkspaceTree";
import { createChatForkPlan } from "./chatForkPlan";
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
import { executeOrchestrationChildResult } from "./orchestrationChildResult";
import {
  beginSettingsMcpOAuth,
  disconnectSettingsMcpOAuth,
  probeSettingsMcpServer,
} from "./settingsMcpActions";
import { resetSettingsLocalData } from "./settingsLocalReset";
import { ContextMenu, type ContextMenuItem, type ContextMenuState } from "./ContextMenu";
import { paneContextKey } from "./paneOwnership";
import { composerReasoningLabel } from "./ComposerReasoningPicker";
import { closeProjectResources as closeProjectResourcesWithContext } from "./projectResourceClose";
import { requestProjectClose } from "./projectCloseRequest";
import { planProjectSessionSwitch } from "./projectSessionSwitch";
import { planProjectSessionCreate } from "./projectSessionCreate";
import { planSessionScopedRecordRemoval } from "./sessionScopedRecords";
import {
  buildCreatedPaneActivity,
  buildCreatedWorktreePaneActivity,
  buildRestartedPaneActivity,
} from "./paneActivityRecords";
import "./App.css";
import "./composerModelPicker.css";
import "./responsive-shell.css";
import "./workbenchTransitions.css";

// SPIKE-2 frontend: paint the grid snapshots from the Rust backend onto a canvas,
// and encode keydowns back into pty bytes. Ship-ugly on purpose.

type Cell = { t: string; f: [number, number, number]; b: [number, number, number]; bold: boolean };
type Snapshot = { cols: number; rows: number; cx: number; cy: number; cvis: boolean; sb: number; cells: Cell[] };
type GridPayload = { paneId: number; snapshot: Snapshot };
type PaneExit = { paneId: number; command: string; code: number; message: string };
type OpenWorkspaceResponse = { root: string; paneId: number };
type ResolveWorkspaceResponse = { root: string };
type OpenPaneResponse = { paneId: number };
type WorktreeResponse = { path: string; branch: string };
type SaveEditorFileOptions = { force?: boolean };
type DetectedLocalDevServer = {
  url: string;
  paneId: number;
  projectId: string;
  projectSessionId: string;
  paneLabel: string;
  detectedAt: number;
};
type EditorBuffer = EditorFileBuffer;
type ProjectEditorSnapshot = {
  tabs: FileTreeNode[];
  activePath: string | null;
  buffers: Record<string, EditorBuffer>;
  viewStates: Record<string, EditorViewState>;
};
type CommandPaletteCommand = SearchDialogCommand;
type WorkspaceBootstrapSnapshot = Awaited<ReturnType<typeof loadWorkspaceBootstrap>>;
type OpenedWorkspaceTarget = {
  activePaneId: number | null;
  panes: ManagedTerminalPane[];
  requestedSessionId: string | null;
  root: string;
};

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
const menuItem = (
  id: string,
  label: string,
  onSelect: () => void,
  options: Pick<ContextMenuItem, "shortcut" | "icon" | "disabled" | "danger"> = {},
): ContextMenuItem => ({ id, label, onSelect, ...options });

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
  const recentProjectsRef = useRef<string[]>([]);
  const openProjectsRef = useRef<OpenProject[]>([]);
  const projectSessionsRef = useRef<ProjectSessionsByProject>({});
  const activeSessionByProjectRef = useRef<ActiveSessionByProject>({});
  const browserPreviewByProjectRef = useRef<BrowserPreviewRecords>({});
  const browserPreviewBySessionRef = useRef<BrowserPreviewRecords>({});
  const composerHarnessBySessionRef = useRef<ComposerHarnessRecords>({});
  const scopedSettingsRef = useRef<ScopedSettingsState>(defaultScopedSettings());
  const chatConversationsRef = useRef<ChatConversationRecords>({});
  const browserUrlRef = useRef(DEFAULT_BROWSER_PREVIEW_URL);
  const detectedLocalDevServerRef = useRef<DetectedLocalDevServer | null>(null);
  const launchProfileRef = useRef<LaunchProfile>(defaultLaunchProfile());
  const terminalLaunchProfileRef = useRef<LaunchProfile>(defaultTerminalLaunchProfile());
  const customLaunchProfilesRef = useRef<LaunchProfile[]>([]);
  const aiConnectionSettingsRef = useRef<AiConnectionSettings>(DEFAULT_AI_CONNECTION_SETTINGS);
  const intentionallyTerminatedPaneIdsRef = useRef<Set<number>>(new Set());
  const terminalPanesRef = useRef<ManagedTerminalPane[]>([]);
  const activeAgentSessionDescriptorRef = useRef<AgentSessionHandleDescriptor | null>(null);
  const fileNodeContextMenuItemsRef = useRef<(node: FileTreeNode) => ContextMenuItem[]>(() => []);
  const terminalPanesByContextRef = useRef<TerminalPanesByContext>({});
  const activeTerminalPaneByContextRef = useRef<ActiveTerminalPaneByContext>({});
  const paneLabelsBySessionRef = useRef<PaneLabelsBySession>({});
  const paneLayoutsBySessionRef = useRef<PaneLayoutsBySession>({});
  const activeTerminalPaneIdRef = useRef<number | null>(null);
  const terminalSnapshotsRef = useRef<Record<number, Snapshot>>({});
  const requestTerminalPaintRef = useRef<() => void>(() => {});
  const activeFilesByWorkspaceRef = useRef<ActiveFileByWorkspace>({});
  const restoredActiveFileWorkspaceRef = useRef<string | null>(null);
  const selectedFileRef = useRef<FileTreeNode | null>(null);
  const saveEditorFileRef = useRef<() => Promise<boolean>>(async () => false);
  const openEditorSearchRef = useRef<() => void>(() => {});
  const closeActiveEditorTabRef = useRef<() => Promise<void>>(async () => {});
  const editorViewRef = useRef<EditorView | null>(null);
  const editorViewStatesRef = useRef<Record<string, EditorViewState>>({});
  const editorBuffersRef = useRef<Record<string, EditorBuffer>>({});
  const sessionEditorSnapshotsRef = useRef<Record<string, ProjectEditorSnapshot>>({});
  const pendingEditorFocusRef = useRef(false);
  const editorLoadSeq = useRef(0);
  const latest = useRef<Snapshot | null>(null);
  const frame = useRef<number | null>(null);
  const metrics = useRef({ cw: 9, ch: 19 });
  const renderPerfRef = useRef(createRenderPerfState());
  const ipcSampleCounter = useRef(0);
  const selection = useRef<SelectionRange | null>(null);
  const selecting = useRef(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [launchProfile, setLaunchProfile] = useState<LaunchProfile>(defaultLaunchProfile);
  const [terminalLaunchProfile, setTerminalLaunchProfile] = useState<LaunchProfile>(defaultTerminalLaunchProfile);
  const [customLaunchProfiles, setCustomLaunchProfiles] = useState<LaunchProfile[]>([]);
  const [launchProfileChanging, setLaunchProfileChanging] = useState(false);
  const allLaunchProfiles = useMemo(() => [...LAUNCH_PROFILES, ...customLaunchProfiles], [customLaunchProfiles]);
  const resolveLaunchProfile = (id: string) =>
    customLaunchProfilesRef.current.find((profile) => profile.id === id) ?? launchProfileById(id);
  const [terminalPanes, setTerminalPanes] = useState<ManagedTerminalPane[]>([]);
  const [activeTerminalPaneId, setActiveTerminalPaneId] = useState<number | null>(null);
  const [paneLabelsBySession, setPaneLabelsBySession] = useState<PaneLabelsBySession>({});
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const {
    error: fileTreeError, loading: fileTreeLoading, refresh: refreshFileTree,
    refreshKey: treeRefreshNonce, setError: setFileTreeError, setTree: setFileTree,
    tree: fileTree, truncated: fileTreeTruncated,
  } = useWorkspaceTree({
    onClearWorkspace: () => resetEditor(),
    onRootResolved: (root) => { workspacePathRef.current = root; },
    workspacePath,
  });
  const [fileOpError, setFileOpError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileTreeNode | null>(null);
  const [editorTabs, setEditorTabs] = useState<FileTreeNode[]>([]);
  const [, setEditorBufferRevision] = useState(0);
  const [editorText, setEditorText] = useState("");
  const [savedEditorText, setSavedEditorText] = useState("");
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [editorRecoveryError, setEditorRecoveryError] = useState<string | null>(null);
  const [editorBytes, setEditorBytes] = useState<number | null>(null);
  const [editorModifiedMs, setEditorModifiedMs] = useState<number | null>(null);
  const [editorCursor, setEditorCursor] = useState<CursorPosition>({ line: 1, column: 1 });
  const [recentProjects, setRecentProjects] = useState<string[]>([]);
  const [openProjects, setOpenProjects] = useState<OpenProject[]>([]);
  const [agentHookStatus, setAgentHookStatus] = useState<AgentHookStatus | null>(null);
  const [projectSessions, setProjectSessions] = useState<ProjectSessionsByProject>({});
  const [activeSessionByProject, setActiveSessionByProjectState] = useState<ActiveSessionByProject>({});
  const [expandedSessionProjects, setExpandedSessionProjects] = useState<Record<string, boolean>>({});
  const [showArchivedSessions, setShowArchivedSessions] = useState(false);
  const [browserPreviewByProject, setBrowserPreviewByProject] = useState<BrowserPreviewRecords>({});
  const [browserPreviewBySession, setBrowserPreviewBySession] = useState<BrowserPreviewRecords>({});
  const [composerHarnessBySession, setComposerHarnessBySession] = useState<ComposerHarnessRecords>({});
  const [scopedSettings, setScopedSettings] = useState<ScopedSettingsState>(defaultScopedSettings);
  const [chatConversations, setChatConversations] = useState<ChatConversationRecords>({});
  const {
    address: browserAddress, canGoBack: browserCanGoBack, canGoForward: browserCanGoForward,
    error: browserError, goHistory: goBrowserHistory, reload: reloadBrowserPreview,
    reloadNonce: browserReloadNonce, restore: restoreBrowserPreviewState,
    setAddress: setBrowserAddress, setError: setBrowserError, setLocation: setBrowserLocation,
    url: browserUrl,
  } = useBrowserPreviewState((url) => { browserUrlRef.current = url; });
  const [detectedLocalDevServer, setDetectedLocalDevServer] = useState<DetectedLocalDevServer | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
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
  const [paneTranscripts, setPaneTranscripts] = useState<PaneTranscript[]>([]);
  const [transcriptsOpen, setTranscriptsOpen] = useState(false);
  const [openTranscriptId, setOpenTranscriptId] = useState<string | null>(null);
  const [keybindingOverrides, setKeybindingOverrides] = useState<KeybindingOverrides>({});
  const [composerSending, setComposerSending] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [agentActivityEvents, setAgentActivityEvents] = useState<AgentActivityEvent[]>([]);
  const agentActivityFilter: AgentActivityLogFilter = "all";
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
    launchProfileId: launchProfile.id, projectSessions, resolveLaunchProfile,
    scopedSettings, workspacePath,
  });
  const {
    draft: composerDraft, flush: flushActiveComposerLocalState,
    history: composerHistory, historyIndex: composerHistoryIndex,
    setHistoryIndex: setComposerHistoryIndex, setLocalState: setComposerLocalState,
    updateHarness: updateActiveComposerHarness,
  } = useComposerLocalState({
    activeHarness: activeComposerHarness, activeKey: activeComposerHarnessKey,
    getDefaultProfileId: () => launchProfileRef.current.id,
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
    getBrowserUrl: () => browserUrlRef.current,
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
  const agentApprovalMode: AgentApprovalMode = activeComposerHarness.approvalMode;
  const {
    activeAgentSessionDescriptor, activeTerminalPane,
    selectedAgentActivityLog,
  } = deriveActiveAgentSessionState({
    activeSessionId, activeTerminalPaneId, agentActivityEvents, agentActivityFilter,
    agentApprovalMode, terminalPanes, workspacePath,
  });
  const terminalFind = useTerminalFind(activeTerminalPane != null);
  useSyncRef(activeAgentSessionDescriptorRef, activeAgentSessionDescriptor);
  const activeTerminalProfile = activeTerminalPane?.profile ?? terminalLaunchProfile;
  const primarySurfaceState: TerminalPaneState = activeChatConversation.activeRunId ? "starting" : "idle";
  const primarySurfaceLabel = "Codex";
  const primarySurfaceStatusLabel = activeChatConversation.activeRunId ? "Working" : "Ready";
  const utilityTrayStatusLabel = utilityTrayMode.charAt(0).toUpperCase() + utilityTrayMode.slice(1);
  const activeDetectedLocalDevServer =
    detectedLocalDevServer &&
    detectedLocalDevServer.projectId === workspacePath &&
    detectedLocalDevServer.projectSessionId === activeSessionId
      ? detectedLocalDevServer
      : null;

  const focusEditorLine = (line: number) => {
    const targetLine = Math.max(1, line);
    window.setTimeout(() => {
      const view = editorViewRef.current;
      if (!view) return;
      const docLine = view.state.doc.line(Math.min(targetLine, view.state.doc.lines));
      view.dispatch({
        selection: { anchor: docLine.from },
        effects: EditorView.scrollIntoView(docLine.from, { y: "center" }),
      });
      view.focus();
    }, 60);
  };

  const reviewRunCardFile = async (relativePath: string) => {
    const normalized = relativePath.trim().replace(/^\.\//, "");
    const changedFile = gitStatus?.files.find((file) => file.path === normalized);
    if (changedFile) {
      const opened = await openGitDiff(changedFile);
      if (opened) {
        if (workbenchLayout === "hidden") setWorkbenchLayout("right");
        setToolTrayMode("editor");
      }
      return;
    }
    const root = workspacePathRef.current;
    if (root && normalized) {
      const opened = await requestOpenEditorFile(fileNodeFromPath(`${root}/${normalized}`, "file"), { focusEditor: true });
      if (opened) {
        if (workbenchLayout === "hidden") setWorkbenchLayout("right");
        setToolTrayMode("editor");
      }
    }
  };

  const editorHasUnsavedBufferForPath = (path: string) => {
    if (selectedFileRef.current?.path === path && editorText !== savedEditorText) return true;
    const buffered = editorBuffersRef.current[path];
    return Boolean(buffered && buffered.text !== buffered.savedText);
  };

  const openDiffFile = async (line: number | null = null) => {
    if (!diffReview) return;
    const opened = await requestOpenEditorFile(fileNodeFromPath(diffReview.absolutePath, "file"), { focusEditor: true });
    if (opened && line != null) focusEditorLine(line);
  };

  useSyncRef(recentProjectsRef, recentProjects);
  useSyncRef(openProjectsRef, openProjects);
  useSyncRef(projectSessionsRef, projectSessions);
  useSyncRef(activeSessionByProjectRef, activeSessionByProject);
  useSyncRef(paneLabelsBySessionRef, paneLabelsBySession);

  useSyncRef(browserPreviewByProjectRef, browserPreviewByProject);
  useSyncRef(browserPreviewBySessionRef, browserPreviewBySession);
  useSyncRef(composerHarnessBySessionRef, composerHarnessBySession);
  useSyncRef(scopedSettingsRef, scopedSettings);
  useSyncRef(browserUrlRef, browserUrl);
  useSyncRef(terminalPanesRef, terminalPanes);
  useSyncRef(activeTerminalPaneIdRef, activeTerminalPaneId);
  useSyncRef(selectedFileRef, selectedFile);

  useEffect(() => {
    if (!selectedFile) return;
    treeRef.current?.scrollTo(selectedFile.id, "smart");
  }, [selectedFile, visibleFileTree]);

  useEffect(() => {
    const onContextMenu = (event: Event) => {
      const detail = (event as CustomEvent<{ node: FileTreeNode; x: number; y: number }>).detail;
      if (!detail?.node) return;
      setContextMenu({
        x: detail.x,
        y: detail.y,
        items: fileNodeContextMenuItemsRef.current(detail.node),
      });
    };
    window.addEventListener("file-tree-context-menu", onContextMenu);
    return () => {
      window.removeEventListener("file-tree-context-menu", onContextMenu);
    };
  }, []);

  useEffect(() => {
    if (!selectedFile || fileTree.length === 0) return;
    const syncedFile = reconcileActiveFileNode(fileTree, selectedFile);
    if (syncedFile !== selectedFile) setSelectedFile(syncedFile);
  }, [fileTree, selectedFile]);

  const resetEditor = () => {
    editorViewRef.current = null;
    editorLoadSeq.current += 1;
    editorBuffersRef.current = {};
    setEditorTabs([]);
    setEditorBufferRevision((value) => value + 1);
    setSelectedFile(null);
    setEditorText("");
    setSavedEditorText("");
    setEditorError(null);
    setEditorRecoveryError(null);
    setEditorBytes(null);
    setEditorModifiedMs(null);
    setEditorCursor({ line: 1, column: 1 });
  };

  const captureCurrentEditorViewState = () => {
    const file = selectedFileRef.current;
    const view = editorViewRef.current;
    if (!file || !view) return;
    const { anchor, head } = view.state.selection.main;
    editorViewStatesRef.current[file.path] = {
      anchor,
      head,
      scrollTop: view.scrollDOM.scrollTop,
      focused: view.hasFocus,
    };
  };

  const captureCurrentEditorBuffer = () => {
    const file = selectedFileRef.current;
    if (!file) return;
    editorBuffersRef.current[file.path] = {
      text: editorText,
      savedText: savedEditorText,
      bytes: editorBytes,
      modifiedMs: editorModifiedMs,
      error: editorError,
      recoveryError: editorRecoveryError,
    };
    setEditorBufferRevision((value) => value + 1);
  };

  const {
    clearActiveFile: clearPersistedActiveFile,
    persistActiveFile,
    persistOpenProjects,
    persistPaneLabel,
    persistPaneLayout: persistPaneLayoutForSession,
    persistProjectSessions,
    persistSessionSnapshots: persistSessionEditorSnapshots,
    removeSessionRestore: removePersistedSessionRestore,
    savedPaneLabel: savedPaneLabelForSlot,
    sessionKey: sessionSnapshotKey,
  } = createWorkspacePersistence({
    activeFiles: activeFilesByWorkspaceRef,
    activeSessions: activeSessionByProjectRef,
    getActiveSession: (root) => activeProjectSessionId(
      activeSessionByProjectRef.current, projectSessionsRef.current, root,
    ),
    getPanes: (root, sessionId) => terminalPanesForSession(root, sessionId),
    openProjects: openProjectsRef,
    paneLabels: paneLabelsBySessionRef,
    paneLayouts: paneLayoutsBySessionRef,
    projectSessions: projectSessionsRef,
    sessionSnapshots: sessionEditorSnapshotsRef,
    setActiveSessions: setActiveSessionByProjectState,
    setOpenProjects,
    setPaneLabels: setPaneLabelsBySession,
    setProjectSessions,
    store: storeRef,
  });

  const browserPreviewSessionKey = (root: string, sessionId: string) => `${root}\n${sessionId}`;
  const composerHarnessSessionKey = (root: string, sessionId: string) => `${root}\n${sessionId}`;

  const updateChatConversation = (
    key: string,
    updater: (conversation: ChatConversation) => ChatConversation,
  ) => {
    const previous = chatConversationsRef.current[key] ?? emptyChatConversation();
    const updated = updater(previous);
    const nextConversation = { ...updated, revision: previous.revision + 1 };
    const next = { ...chatConversationsRef.current, [key]: nextConversation };
    chatConversationsRef.current = next;
    setChatConversations(next);
    void saveDurableChatConversation(key, nextConversation).catch((error) => {
      const message = `Could not save chat history: ${String(error)}`;
      setLaunchError(message);
      void invoke("log_health_event", { message }).catch(() => {});
    });
    return nextConversation;
  };

  const toggleChatMessageBookmark = (message: ChatMessage) => {
    const chatId = activeComposerHarnessKey;
    if (!chatId) return;
    const bookmarked = !message.bookmarked;
    updateChatConversation(chatId, (conversation) => ({
      ...conversation,
      messages: conversation.messages.map((item) =>
        item.id === message.id ? { ...item, bookmarked: bookmarked ? true : undefined } : item,
      ),
      updatedAt: Date.now(),
    }));
    refreshChatSearch();
    setActionNotice(bookmarked ? "Bookmarked message" : "Removed bookmark");
  };

  const forkChatFromMessage = async (message: ChatMessage) => {
    const projectPath = workspacePathRef.current;
    const sourceSessionId = activeProjectSessionId(
      activeSessionByProjectRef.current,
      projectSessionsRef.current,
      projectPath,
    );
    if (!projectPath || !sourceSessionId) return;
    const sourceChatId = composerHarnessSessionKey(projectPath, sourceSessionId);
    const sourceConversation = chatConversationsRef.current[sourceChatId] ?? emptyChatConversation();
    if (sourceConversation.activeRunId) {
      setActionNotice("Wait for this response to finish before forking the chat");
      return;
    }
    const existing = projectSessionsRef.current[projectPath] ?? [];
    const sourceSession = existing.find((session) => session.id === sourceSessionId);
    let checkpointError: string | null = null;
    const checkpoint = await createWorkspaceCheckpoint(
      projectPath,
      `Fork from ${sourceSession?.title ?? "chat"}`,
    ).catch((error) => {
      checkpointError = String(error);
      return null;
    });
    const plan = createChatForkPlan({
      checkpoint,
      existingSessions: existing,
      messageId: message.id,
      now: Date.now(),
      sourceChatId,
      sourceConversation,
      sourceSessionId,
    });
    if (!plan) {
      setLaunchError("This message cannot be used to fork the chat.");
      return;
    }
    const forkedChatId = composerHarnessSessionKey(projectPath, plan.session.id);
    const nextSessions = upsertProjectSession(projectSessionsRef.current, projectPath, plan.session);
    const nextConversations = { ...chatConversationsRef.current, [forkedChatId]: plan.forkedConversation };
    await saveDurableChatConversation(forkedChatId, plan.forkedConversation);
    chatConversationsRef.current = nextConversations;
    setChatConversations(nextConversations);
    await persistProjectSessions(nextSessions, activeSessionByProjectRef.current);
    await persistBrowserPreviewUrl(projectPath, plan.session.id, browserUrlRef.current);
    await switchProjectSession(projectPath, plan.session.id);
    setActionNotice(checkpointError
      ? `Forked chat without workspace checkpoint: ${checkpointError}`
      : `Forked ${plan.sourceTitle}`);
  };

  useChatRunEvents((envelope) => {
    updateChatConversation(envelope.chatId, (conversation) =>
      applyChatRunEnvelope(conversation, envelope));
  });

  const persistComposerHarnessRecords = async (records: ComposerHarnessRecords) => {
    composerHarnessBySessionRef.current = records;
    setComposerHarnessBySession(records);
    await storeRef.current?.set("composerHarnessBySession", records);
    await storeRef.current?.save();
  };

  const persistScopedSettings = async (next: ScopedSettingsState) => {
    scopedSettingsRef.current = next;
    setScopedSettings(next);
    await storeRef.current?.set("scopedSettings", next);
    await storeRef.current?.save();
  };

  const updateScopedSetting = async <K extends ScopedSettingKey,>(
    scope: SettingsScope,
    key: K,
    value: ScopedSettingsState["global"][K],
  ) => {
    const root = workspacePathRef.current;
    const sessionId = activeSessionForProject(root);
    const next = setScopedSetting(scopedSettingsRef.current, scope, key, value, root, sessionId);
    if (next === scopedSettingsRef.current) return false;
    await persistScopedSettings(next);
    return true;
  };

  const clearScopedSetting = async (
    scope: Exclude<SettingsScope, "global">,
    key: ScopedSettingKey,
  ) => {
    const root = workspacePathRef.current;
    const sessionId = activeSessionForProject(root);
    const next = resetScopedSetting(scopedSettingsRef.current, scope, key, root, sessionId);
    if (next === scopedSettingsRef.current) return false;
    await persistScopedSettings(next);
    return true;
  };

  const logComposerHarnessEvent = (
    label: string,
    detail: string,
    status: Parameters<typeof createAgentActivityEvent>[1]["status"] = "complete",
  ) => {
    recordAgentActivity(activeAgentSessionDescriptor, {
      kind: "app",
      label,
      detail,
      status,
    });
  };

  const persistBrowserPreviewUrl = async (root: string | null, sessionId: string | null, url: string) => {
    if (!root) return;
    const nextByProject = { ...browserPreviewByProjectRef.current, [root]: url };
    const nextBySession = sessionId
      ? { ...browserPreviewBySessionRef.current, [browserPreviewSessionKey(root, sessionId)]: url }
      : browserPreviewBySessionRef.current;
    browserPreviewByProjectRef.current = nextByProject;
    browserPreviewBySessionRef.current = nextBySession;
    setBrowserPreviewByProject(nextByProject);
    setBrowserPreviewBySession(nextBySession);
    let nextScopedSettings = setScopedSetting(scopedSettingsRef.current, "project", "browserUrl", url, root, sessionId);
    if (sessionId) nextScopedSettings = setScopedSetting(nextScopedSettings, "chat", "browserUrl", url, root, sessionId);
    scopedSettingsRef.current = nextScopedSettings;
    setScopedSettings(nextScopedSettings);
    await storeRef.current?.set("browserPreviewByProject", nextByProject);
    await storeRef.current?.set("browserPreviewBySession", nextBySession);
    await storeRef.current?.set("scopedSettings", nextScopedSettings);
    await storeRef.current?.save();
  };

  const restoreBrowserPreview = (root: string | null, sessionId: string | null) => {
    const nextUrl = resolveScopedSetting(scopedSettingsRef.current, "browserUrl", root, sessionId).value;
    restoreBrowserPreviewState(nextUrl);
  };

  const navigateBrowserPreview = async (rawUrl: string) => {
    const normalized = normalizeBrowserPreviewUrl(rawUrl);
    if (!normalized) {
      setBrowserError("Enter an http, https, or file URL.");
      return false;
    }
    const audit = await gateAppAction(createAppAction({
      kind: "open-browser-preview",
      label: "Open browser preview",
      target: normalized,
      risk: "low",
      requestedBy: "user",
    }));
    if (audit.decision !== "approved") return false;
    setBrowserLocation(normalized);
    await persistBrowserPreviewUrl(workspacePathRef.current, activeProjectSessionId(activeSessionByProjectRef.current, projectSessionsRef.current, workspacePathRef.current), normalized);
    return true;
  };

  const submitBrowserAddress = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void navigateBrowserPreview(browserAddress);
  };

  const openDetectedLocalDevServer = async () => {
    if (!activeDetectedLocalDevServer) return;
    if (workbenchLayout === "hidden") setWorkbenchLayout("right");
    if (toolTrayMode === "editor") setToolTrayMode("browser");
    await navigateBrowserPreview(activeDetectedLocalDevServer.url);
  };

  const updateOpenProjectStatus = async (path: string | null, status: ProjectRailStatus) => {
    if (!path) return;
    const next = setOpenProjectStatus(openProjectsRef.current, path, status);
    await persistOpenProjects(next);
  };

  const updateSessionStatus = async (path: string | null, sessionId: string | null, status: ProjectRailStatus) => {
    if (!path || !sessionId) return;
    const nextSessions = setProjectSessionStatus(projectSessionsRef.current, path, sessionId, status);
    await persistProjectSessions(nextSessions, activeSessionByProjectRef.current);
  };

  const updateActiveSessionStatus = async (path: string | null, status: ProjectRailStatus) =>
    updateSessionStatus(path, activeSessionForProject(path), status);

  const activeSessionForProject = (root: string | null) =>
    activeProjectSessionId(activeSessionByProjectRef.current, projectSessionsRef.current, root);
  const {
    activePaneForSession,
    activeProjectStatus,
    activeSessionStatus,
    contextForPaneId: paneContextForPaneId,
    panesForProject: terminalPanesForProject,
    panesForSession: terminalPanesForSession,
    projectStatusForRoot,
    setFocusedPane: setFocusedTerminalPane,
    setManagedPanes: setManagedTerminalPanes,
    setPaneState,
    setSessionPanes: setSessionTerminalPanes,
    statusForPanes: terminalPaneProjectStatus,
  } = createTerminalPaneContexts({
    activePaneIds: activeTerminalPaneByContextRef,
    activeSessionForProject,
    activeWorkspace: workspacePathRef,
    panes: terminalPanesRef,
    panesByContext: terminalPanesByContextRef,
    persistPaneLayout: persistPaneLayoutForSession,
    setActivePaneId: (paneId) => {
      activeTerminalPaneIdRef.current = paneId;
      setActiveTerminalPaneId(paneId);
    },
    setPanes: setTerminalPanes,
  });

  const terminalPaneLabel = (pane: ManagedTerminalPane, index: number) => terminalPaneLabelForDisplay(pane.label, pane.profile.label, index);

  const recordAgentActivity = (
    handle: AgentSessionHandleDescriptor | null,
    event: Parameters<typeof createAgentActivityEvent>[1],
  ) => {
    if (!handle) return;
    const nextEvent = createAgentActivityEvent(handle, event);
    setAgentActivityEvents((events) => {
      const next = pushAgentActivityEvent(events, nextEvent, MAX_AGENT_ACTIVITY_LOG_EVENTS);
      void storeRef.current?.set("agentActivityEvents", next);
      void storeRef.current?.save();
      return next;
    });
  };

  const activeChatActivityHandle = (): AgentSessionHandleDescriptor | null => {
    const projectId = workspacePathRef.current;
    const projectSessionId = activeSessionForProject(projectId);
    if (!projectId || !projectSessionId) return null;
    return {
      id: `chat:${projectSessionId}`,
      paneId: -1,
      projectId,
      projectSessionId,
      cwd: projectId,
      label: "Structured chat",
      agentProfileId: activeComposerProvider ?? "codex",
      agentProfileLabel: activeComposerProviderLabel,
      processState: "running",
      approvalMode: composerHarnessBySessionRef.current[composerHarnessSessionKey(projectId, projectSessionId)]?.approvalMode ?? "ask",
      exitCode: null,
      createdAt: Date.now(),
      activity: { label: "Agent hook", status: "running", updatedAt: Date.now() },
    };
  };

  const activeAgentActivityHandle = (): AgentSessionHandleDescriptor | null =>
    activeAgentSessionDescriptorRef.current ?? activeChatActivityHandle();

  const detectLocalDevServerFromSnapshot = (paneId: number, snapshot: Snapshot) => {
    const url = detectLocalDevServerUrl(terminalSnapshotText(snapshot));
    if (!url) return;
    const context = paneContextForPaneId(paneId);
    const root = context?.projectRoot ?? workspacePathRef.current;
    const panes = context?.panes ?? terminalPanesRef.current;
    const paneIndex = panes.findIndex((pane) => pane.id === paneId);
    const pane = paneIndex >= 0 ? panes[paneIndex] : null;
    const sessionId = context?.sessionId ?? activeSessionForProject(root);
    if (!root || !sessionId || !pane) return;
    const previous = detectedLocalDevServerRef.current;
    if (previous?.url === url && previous.paneId === paneId && previous.projectId === root && previous.projectSessionId === sessionId) return;
    const paneLabel = terminalPaneLabelForDisplay(pane.label, pane.profile.label, paneIndex >= 0 ? paneIndex : pane.slot);
    const next: DetectedLocalDevServer = {
      url,
      paneId,
      projectId: root,
      projectSessionId: sessionId,
      paneLabel,
      detectedAt: Date.now(),
    };
    detectedLocalDevServerRef.current = next;
    setDetectedLocalDevServer(next);
    const harnessKey = composerHarnessSessionKey(root, sessionId);
    const approvalMode = composerHarnessBySessionRef.current[harnessKey]?.approvalMode ?? "ask";
    recordAgentActivity(
      buildAgentSessionHandleDescriptor({
        pane,
        projectId: root,
        projectSessionId: sessionId,
        label: paneLabel,
        approvalMode,
      }),
      {
        kind: "browser",
        label: "Detected dev server",
        detail: url,
        target: url,
        outputRef: "terminal",
        status: "complete",
      },
    );
  };

  const shouldLogAppActionAudit = (audit: AppActionAuditEvent) =>
    audit.prompted || audit.decision !== "approved" || audit.requestedBy !== "user";

  const gateAppAction = async (
    action: AppActionDescriptor,
    handle: AgentSessionHandleDescriptor | null = activeAgentActivityHandle(),
  ) => {
    const audit = await resolveAppAction(action, agentApprovalMode, (_action, message) => confirmDialog(message));
    if (shouldLogAppActionAudit(audit)) {
      recordAgentActivity(handle, {
        kind: "approval",
        label: appActionAuditLabel(audit),
        detail: audit.label,
        target: audit.target,
        undoHint: audit.undoHint,
        status: audit.decision === "approved" ? "complete" : "error",
        provenance: "app-action",
        runCardKind: "approval",
      });
    }
    return audit;
  };

  const captureCurrentSessionSnapshot = () => {
    const root = workspacePathRef.current;
    const sessionId = activeProjectSessionId(activeSessionByProjectRef.current, projectSessionsRef.current, root);
    if (!root || !sessionId) return;
    captureCurrentEditorViewState();
    captureCurrentEditorBuffer();
    persistSessionEditorSnapshots({
      ...sessionEditorSnapshotsRef.current,
      [sessionSnapshotKey(root, sessionId)]: {
        tabs: editorTabs,
        activePath: selectedFileRef.current?.path ?? null,
        buffers: { ...editorBuffersRef.current },
        viewStates: { ...editorViewStatesRef.current },
      },
    });
    persistPaneLayoutForSession(root, sessionId);
  };

  const restoreSessionEditorSnapshot = (root: string, sessionId: string | null) => {
    const snapshot = sessionId ? sessionEditorSnapshotsRef.current[sessionSnapshotKey(root, sessionId)] : null;
    resetEditor();
    if (!snapshot) return;
    editorBuffersRef.current = { ...snapshot.buffers };
    editorViewStatesRef.current = { ...snapshot.viewStates };
    setEditorTabs(snapshot.tabs);
    setEditorBufferRevision((value) => value + 1);
    const nextActive = snapshot.tabs.find((tab) => tab.path === snapshot.activePath) ?? snapshot.tabs[0] ?? null;
    if (nextActive) void openEditorFileDirect(nextActive);
  };

  useSyncRef(launchProfileRef, launchProfile);
  useSyncRef(terminalLaunchProfileRef, terminalLaunchProfile);

  const prepareAndOpenWorkspaceTarget = async (path: string): Promise<OpenedWorkspaceTarget> => {
    const prepared = prepareWorkspaceOpenSession({
      activeSessions: activeSessionByProjectRef.current, sessions: projectSessionsRef.current,
      paneLayouts: paneLayoutsBySessionRef.current, path, now: Date.now(),
      defaultProfileId: defaultTerminalLaunchProfile().id, savedLabel: savedPaneLabelForSlot(path, 0),
    });
    projectSessionsRef.current = prepared.sessions;
    activeSessionByProjectRef.current = prepared.activeSessions;
    const existingPanes = terminalPanesForSession(path, prepared.sessionId);
    const opened = await resolveWorkspaceOpenTarget({
      activePaneId: activePaneForSession(path, prepared.sessionId, existingPanes), existingPanes,
      focusPane: (paneId) => invoke("focus_pane", { paneId }),
      openTerminalPanes: () => openWorkspaceTerminalPanes({
        createPane: (target, paneProfile) => invoke<OpenPaneResponse>("create_pane", {
          path: target, profile: paneProfile, environment: connectionEnvironmentInputs(aiConnectionSettingsRef.current, target),
        }),
        fallbackLayout: prepared.fallbackLayout, initialLayout: prepared.layout, now: Date.now,
        openWorkspace: (target, firstProfile) => invoke<OpenWorkspaceResponse>("open_workspace", {
          path: target, profile: firstProfile, environment: connectionEnvironmentInputs(aiConnectionSettingsRef.current, target),
        }),
        paneLayouts: paneLayoutsBySessionRef.current, path, requestedSessionId: prepared.sessionId,
        resolveProfile: resolveLaunchProfile,
        savedLabelForSlot: (target, slot) => savedPaneLabelForSlot(target, slot, prepared.sessionId),
      }),
      path, resolveWorkspace: (target) => invoke<ResolveWorkspaceResponse>("resolve_workspace", { path: target }),
      surfaceMode: agentSurfaceMode,
    });
    return { ...opened, requestedSessionId: prepared.sessionId };
  };

  const applyOpenedWorkspaceTarget = (opened: OpenedWorkspaceTarget) => {
    const { activePaneId, panes, requestedSessionId, root } = opened;
    const contextKey = paneContextKey(root, requestedSessionId);
    if (!contextKey || !requestedSessionId) throw new Error("Workspace session context is unavailable");
    terminalPanesByContextRef.current = { ...terminalPanesByContextRef.current, [contextKey]: panes };
    if (activePaneId != null) activeTerminalPaneByContextRef.current = { ...activeTerminalPaneByContextRef.current, [contextKey]: activePaneId };
    setManagedTerminalPanes(panes); setFocusedTerminalPane(activePaneId);
    latest.current = activePaneId == null ? null : terminalSnapshotsRef.current[activePaneId] ?? null;
    requestTerminalPaintRef.current(); setLaunchError(null);
    restoredActiveFileWorkspaceRef.current = null; workspacePathRef.current = root; setWorkspacePath(root);
    resetEditor(); setTimeout(sendTerminalResize, 0);
  };

  const completeOpenedWorkspace = async (
    opened: OpenedWorkspaceTarget, profile: LaunchProfile, previousRoot: string | null,
    store: Awaited<ReturnType<typeof load>> | null,
  ) => executeWorkspaceOpenSuccess({
    applyPlan: ({ activeSessions, openProjects, recentProjects, sessions }) => {
      applyWorkspaceCleanupRecord(recentProjectsRef, recentProjects, setRecentProjects);
      applyWorkspaceCleanupRecord(openProjectsRef, openProjects, setOpenProjects);
      applyWorkspaceCleanupRecord(projectSessionsRef, sessions, setProjectSessions);
      applyWorkspaceCleanupRecord(activeSessionByProjectRef, activeSessions, setActiveSessionByProjectState);
    },
    now: Date.now(), panes: opened.panes, persistPaneLayout: persistPaneLayoutForSession,
    persistPlan: ({ activeSessions, openProjects, recentProjects, sessions }) => persistWorkspaceOpenSuccess({
      activeSessions, launchProfile: profile, openProjects, recentProjects, root: opened.root, sessions, store,
    }),
    previousRoot, previousStatus: previousRoot ? projectStatusForRoot(previousRoot) : "exited",
    projectStatus: projectStatusForRoot(opened.root), restoreBrowser: restoreBrowserPreview,
    restoreEditor: restoreSessionEditorSnapshot, root: opened.root,
    sessionStatus: terminalPaneProjectStatus(opened.panes),
    state: {
      activeSessions: activeSessionByProjectRef.current, openProjects: openProjectsRef.current,
      recentProjects: recentProjectsRef.current, sessions: projectSessionsRef.current,
    },
  });

  const handleWorkspaceOpenError = async (
    error: unknown, path: string, previousPanes: ManagedTerminalPane[], previousActivePaneId: number | null,
    store: Awaited<ReturnType<typeof load>> | null,
  ) => {
    const message = String(error);
    setLaunchError(message); setManagedTerminalPanes(previousPanes); setFocusedTerminalPane(previousActivePaneId);
    void invoke("log_health_event", { message: `open_workspace failed: ${message}` }).catch(() => {});
    await executeWorkspaceOpenFailure({
      applyFailure: ({ activeSessions, openProjects, sessions }) => {
        applyWorkspaceCleanupRecord(openProjectsRef, openProjects, setOpenProjects);
        applyWorkspaceCleanupRecord(projectSessionsRef, sessions, setProjectSessions);
        applyWorkspaceCleanupRecord(activeSessionByProjectRef, activeSessions, setActiveSessionByProjectState);
      },
      applyMissingCleanup: (cleanup) => {
        applyWorkspaceCleanupRecord(recentProjectsRef, cleanup.recentProjects, setRecentProjects);
        applyWorkspaceCleanupRecord(openProjectsRef, cleanup.openProjects, setOpenProjects);
        applyWorkspaceCleanupRecord(projectSessionsRef, cleanup.sessions, setProjectSessions);
        applyWorkspaceCleanupRecord(activeSessionByProjectRef, cleanup.activeSessions, setActiveSessionByProjectState);
        applyWorkspaceCleanupRecord(terminalPanesByContextRef, cleanup.projectPanes);
        applyWorkspaceCleanupRecord(activeTerminalPaneByContextRef, cleanup.activePanes);
        applyWorkspaceCleanupRecord(browserPreviewByProjectRef, cleanup.browserProjects, setBrowserPreviewByProject);
        applyWorkspaceCleanupRecord(browserPreviewBySessionRef, cleanup.browserSessions, setBrowserPreviewBySession);
        applyWorkspaceCleanupRecord(composerHarnessBySessionRef, cleanup.harnessRecords, setComposerHarnessBySession);
        applyWorkspaceCleanupRecord(chatConversationsRef, cleanup.conversations, setChatConversations);
        applyWorkspaceCleanupRecord(sessionEditorSnapshotsRef, cleanup.editorSnapshots);
        applyWorkspaceCleanupRecord(paneLayoutsBySessionRef, cleanup.paneLayouts);
      },
      message, now: Date.now(), path,
      persistFailure: ({ activeSessions, openProjects, sessions }) => persistWorkspaceOpenFailure({ activeSessions, openProjects, sessions, store }),
      persistMissingCleanup: (cleanup) => persistMissingWorkspaceCleanup({
        beforeDeleteFolder: () => {
          if (workspacePathRef.current !== path) return;
          setManagedTerminalPanes([]); setFocusedTerminalPane(null); setWorkspacePath(null); setFileTree([]); resetEditor();
        },
        cleanup, deleteProjectChats: deleteDurableProjectChats, path, store,
        onDeleteError: (failure) => { void invoke("log_health_event", { message: `delete project chats failed: ${String(failure)}` }).catch(() => {}); },
      }),
      state: {
        activePanes: activeTerminalPaneByContextRef.current, activeSessions: activeSessionByProjectRef.current,
        browserProjects: browserPreviewByProjectRef.current, browserSessions: browserPreviewBySessionRef.current,
        conversations: chatConversationsRef.current, editorSnapshots: sessionEditorSnapshotsRef.current,
        harnessRecords: composerHarnessBySessionRef.current, openProjects: openProjectsRef.current,
        paneLayouts: paneLayoutsBySessionRef.current, projectPanes: terminalPanesByContextRef.current,
        recentProjects: recentProjectsRef.current, sessions: projectSessionsRef.current,
      },
    });
  };

  const openWorkspaceDirect = async (
    path: string,
    profileOverride: LaunchProfile = launchProfileRef.current,
    options: { captureCurrentSession?: boolean } = {},
  ) => {
    const previousRoot = workspacePathRef.current;
    await flushActiveComposerLocalState();
    if (options.captureCurrentSession !== false) captureCurrentSessionSnapshot();
    const store = storeRef.current;
    const profile = profileOverride;
    const previousPanes = terminalPanesRef.current;
    const previousActivePaneId = activeTerminalPaneIdRef.current;
    setFocusedTerminalPane(null);
    try {
      const opened = await prepareAndOpenWorkspaceTarget(path);
      applyOpenedWorkspaceTarget(opened);
      await completeOpenedWorkspace(opened, profile, previousRoot, store);
      return true;
    } catch (err) {
      await handleWorkspaceOpenError(err, path, previousPanes, previousActivePaneId, store);
      return false;
    }
  };

  const requestOpenWorkspace = async (path: string) => {
    setBackgroundExits((exits) => clearBackgroundExitsForProject(exits, path));
    return requestWorkspaceOpen({
      confirmDiscard: (count) => confirmDialog(`Switch workspace and discard ${count} unsaved editor tabs?`),
      deferNavigation: () => requestPendingNavigation({ kind: "workspace", path }),
      dirtyTabPaths, editorDirty, editorTabs, path,
      openEditorFile: openEditorFileDirect, openWorkspace: openWorkspaceDirect,
      selectedFilePath: selectedFileRef.current?.path ?? null,
    });
  };

  const closeProjectResources = async (projectPath: string) => {
    const closed = await closeProjectResourcesWithContext({
      activePanes: activeTerminalPaneByContextRef.current,
      closePane: (paneId) => invoke("close_pane", { paneId }),
      conversations: chatConversationsRef.current,
      intentionallyTerminatedPaneIds: intentionallyTerminatedPaneIdsRef.current,
      panes: terminalPanesForProject(projectPath),
      projectPanes: terminalPanesByContextRef.current,
      projectPath,
      snapshots: terminalSnapshotsRef.current,
      stopChatRun: (runId) => invoke("stop_chat_run", { runId }),
    });
    activeTerminalPaneByContextRef.current = closed.activePanes;
    terminalPanesByContextRef.current = closed.projectPanes;
  };

  const closeProjectDirect = async (projectPath: string) => {
    const plan = planProjectClose(openProjectsRef.current, workspacePathRef.current, projectPath);
    if (plan.remaining.length === openProjectsRef.current.length) return false;

    try {
      if (plan.wasActive && plan.fallbackPath) {
        const switched = await openWorkspaceDirect(plan.fallbackPath);
        if (!switched) return false;
      }
      await closeProjectResources(projectPath);
      if (plan.wasActive && !plan.fallbackPath) {
        await invoke("stop_workspace_watcher");
        workspacePathRef.current = null;
        setWorkspacePath(null);
        setManagedTerminalPanes([]);
        setFocusedTerminalPane(null);
        latest.current = null;
        setFileTree([]);
        resetEditor();
        await storeRef.current?.delete("folder");
      }
      await persistOpenProjects(removeOpenProject(openProjectsRef.current, projectPath));
      await storeRef.current?.save();
      setActionNotice(`Closed ${basename(projectPath)}`);
      return true;
    } catch (error) {
      setLaunchError(`Could not close ${basename(projectPath)}: ${String(error)}`);
      return false;
    }
  };

  const requestCloseProject = async (project: OpenProject) => {
    return requestProjectClose({
      activeProjectPath: workspacePathRef.current, closeProject: closeProjectDirect,
      confirmDirtyTabs: (count) => confirmDialog(`Close ${basename(project.path)} with ${count} unsaved editor tabs?`),
      confirmRunningTasks: (count) => confirmDialog(`Close ${basename(project.path)} and stop ${count} running task${count === 1 ? "" : "s"}?`),
      conversations: chatConversationsRef.current,
      deferNavigation: () => requestPendingNavigation({ kind: "close-project", projectPath: project.path }),
      dirtyTabCount: dirtyTabPaths.length, hasSelectedFile: selectedFileRef.current != null,
      panes: terminalPanesForProject(project.path), projectPath: project.path,
    });
  };

  const switchProjectSession = async (projectPath: string, sessionId: string) => {
    setFocusedChatMessageId(null);
    const currentRoot = workspacePathRef.current;
    await flushActiveComposerLocalState();
    captureCurrentSessionSnapshot();
    const targetStatus = terminalPaneProjectStatus(terminalPanesForSession(projectPath, sessionId));
    const planned = planProjectSessionSwitch({
      activeSessions: activeSessionByProjectRef.current, sessions: projectSessionsRef.current,
      currentRoot, projectPath, sessionId, targetStatus, now: Date.now(),
      previousStatus: activeSessionStatus(),
    });
    await persistProjectSessions(planned.sessions, planned.activeSessions);
    if (planned.sameProject) {
      await openWorkspaceDirect(projectPath, launchProfileRef.current, { captureCurrentSession: false });
    } else {
      await requestOpenWorkspace(projectPath);
    }
  };

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

  const createProjectSession = async (projectPath: string) => {
    const sameProject = workspacePathRef.current === projectPath;
    captureCurrentSessionSnapshot();
    const planned = planProjectSessionCreate({
      activeSessions: activeSessionByProjectRef.current, sessions: projectSessionsRef.current,
      projectPath, now: Date.now(),
    });
    await persistProjectSessions(planned.sessions, planned.activeSessions);
    await persistBrowserPreviewUrl(projectPath, planned.session.id, sameProject ? browserUrlRef.current : browserPreviewByProjectRef.current[projectPath] ?? DEFAULT_BROWSER_PREVIEW_URL);
    if (sameProject) {
      await openWorkspaceDirect(projectPath, launchProfileRef.current, { captureCurrentSession: false });
    } else {
      await requestOpenWorkspace(projectPath);
    }
  };

  const renameProjectSession = async (projectPath: string, session: ProjectSession) => {
    const title = window.prompt("Chat name", session.title)?.trim();
    if (!title || title === session.title) return;
    const nextSessions = {
      ...projectSessionsRef.current,
      [projectPath]: (projectSessionsRef.current[projectPath] ?? []).map((item) =>
        item.id === session.id ? { ...item, title, updatedAt: Date.now() } : item,
      ),
    };
    await persistProjectSessions(nextSessions, activeSessionByProjectRef.current);
  };

  const closeSessionTerminalPanes = async (projectPath: string, sessionId: string) => {
    for (const pane of terminalPanesForSession(projectPath, sessionId)) {
      intentionallyTerminatedPaneIdsRef.current.add(pane.id);
      try {
        await invoke("close_pane", { paneId: pane.id });
      } catch (error) {
        intentionallyTerminatedPaneIdsRef.current.delete(pane.id);
        throw error;
      }
      delete terminalSnapshotsRef.current[pane.id];
    }
  };

  const removeSessionScopedRecords = async (plan: Extract<ReturnType<typeof planProjectSessionDelete>, { canDelete: true }>) => {
    const removed = planSessionScopedRecordRemoval({
      activePanes: activeTerminalPaneByContextRef.current,
      browserSessionKey: plan.browserSessionKey, browserSessions: browserPreviewBySessionRef.current,
      chatSessionKey: plan.chatSessionKey, composerHarness: composerHarnessBySessionRef.current,
      contextKey: plan.contextKey, conversations: chatConversationsRef.current,
      projectPanes: terminalPanesByContextRef.current,
    });
    applyWorkspaceCleanupRecord(activeTerminalPaneByContextRef, removed.activePanes);
    applyWorkspaceCleanupRecord(terminalPanesByContextRef, removed.projectPanes);
    applyWorkspaceCleanupRecord(browserPreviewBySessionRef, removed.browserSessions, setBrowserPreviewBySession);
    applyWorkspaceCleanupRecord(chatConversationsRef, removed.conversations, setChatConversations);
    await storeRef.current?.set("browserPreviewBySession", removed.browserSessions);
    await persistComposerHarnessRecords(removed.composerHarness);
  };

  const recordRestartedPaneActivity = (
    restarted: ManagedTerminalPane | undefined,
    previousPane: ManagedTerminalPane,
    projectId: string,
    projectSessionId: string,
    label: string,
  ) => {
    const record = buildRestartedPaneActivity({
      approvalMode: agentApprovalMode, label, previousPane, projectId, projectSessionId, restarted,
    });
    if (record) recordAgentActivity(record.handle, record.event);
  };

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
    terminalLaunchProfileRef.current = profile;
    setTerminalLaunchProfile(profile);
    await storeRef.current?.set("terminalLaunchProfile", profile);
    await storeRef.current?.save();
    setLaunchError(null);
    setTimeout(sendTerminalResize, 0);
    await updateOpenProjectStatus(root, projectStatusForRoot(root));
    await updateActiveSessionStatus(root, terminalPaneProjectStatus(nextPanes));
  };

  const deleteProjectSession = async (projectPath: string, session: ProjectSession) => {
    const plan = planProjectSessionDelete({
      activeSessionByProject: activeSessionByProjectRef.current,
      activeSessionId,
      activeWorkspacePath: workspacePathRef.current,
      projectPath,
      projectSessions: projectSessionsRef.current,
      sessionId: session.id,
    });
    if (!plan.canDelete) return;
    const result = await executeProjectSessionDelete({
      closeTerminalPanes: () => closeSessionTerminalPanes(projectPath, session.id),
      confirmDelete: confirmDialog,
      deleteHistory: () => deleteDurableChatConversation(composerHarnessSessionKey(projectPath, session.id)),
      persistSessions: persistProjectSessions,
      plan,
      removePersistedRestore: () => removePersistedSessionRestore(projectPath, session.id),
      removeScopedRecords: () => removeSessionScopedRecords(plan),
      reopenActiveWorkspace: () => openWorkspaceDirect(projectPath, launchProfileRef.current, { captureCurrentSession: false }),
      title: session.title,
    });
    if (result.status === "failed") setLaunchError(result.message);
  };

  const pickWorkspace = async (options: { openTerminal?: boolean } = {}) => {
    const dir = await open({ directory: true });
    if (typeof dir !== "string") return false;
    const opened = await requestOpenWorkspace(dir);
    if (!opened) return false;
    if (options.openTerminal) return createTerminalPane(defaultTerminalLaunchProfile());
    return true;
  };

  const interruptActivePane = async () => {
    if (!activeAgentSessionHandle) return;
    return executeAgentPaneInterrupt({
      gateAction: async (action) => (await gateAppAction(action, activeAgentSessionHandle)).decision,
      handle: activeAgentSessionHandle,
      recordActivity: (activity) => recordAgentActivity(activeAgentSessionHandle, activity),
      setError: setComposerError,
    });
  };

  const terminateTerminalPane = async (pane: ManagedTerminalPane | null = activeTerminalPane) => {
    const root = workspacePathRef.current;
    if (!root || !pane) return false;
    return executeTerminalPaneTerminate({
      gateAction: async (action) => (await gateAppAction(action, activeAgentSessionDescriptor)).decision,
      markIntentionallyTerminated: (paneId) => intentionallyTerminatedPaneIdsRef.current.add(paneId),
      pane,
      projectStatus: () => projectStatusForRoot(root),
      recordActivity: (activity) => recordAgentActivity(activeAgentSessionDescriptor, activity),
      sessionStatus: terminalPaneProjectStatus,
      setError: setLaunchError,
      setPaneExited: (paneId) => setPaneState(paneId, "exited", null),
      terminatePane: (paneId) => invoke("terminate_pane", { paneId }),
      updateProjectStatus: (status) => updateOpenProjectStatus(root, status),
      updateSessionStatus: (status) => updateActiveSessionStatus(root, status),
    });
  };

  const restartTerminalPane = async (pane: ManagedTerminalPane | null = activeTerminalPane) => {
    const root = workspacePathRef.current;
    const sessionId = activeSessionForProject(root);
    if (!root || !sessionId || !pane || launchProfileChanging) return false;
    return executeTerminalPaneRestart({
      clearLatestSnapshot: () => { latest.current = null; },
      clearPaneSnapshot: (paneId) => { delete terminalSnapshotsRef.current[paneId]; },
      currentPanes: () => terminalPanesForSession(root, sessionId),
      gateAction: async (action) => (await gateAppAction(action, activeAgentSessionDescriptor)).decision,
      now: Date.now,
      pane,
      projectStatus: () => projectStatusForRoot(root),
      recordRestarted: (restarted, label) => recordRestartedPaneActivity(restarted, pane, root, sessionId, label),
      requestPaint: () => requestTerminalPaintRef.current(),
      restartPane: async () => (await invoke<OpenPaneResponse>("restart_pane", { path: root, paneId: pane.id, profile: pane.profile, environment: connectionEnvironmentInputs(aiConnectionSettingsRef.current, root) })).paneId,
      scheduleResize: () => setTimeout(sendTerminalResize, 0),
      sessionStatus: terminalPaneProjectStatus,
      setChanging: setLaunchProfileChanging,
      setError: setLaunchError,
      setSessionPanes: (panes, paneId) => setSessionTerminalPanes(root, sessionId, panes, paneId),
      updateProjectStatus: (status) => updateOpenProjectStatus(root, status),
      updateSessionStatus: (status) => updateActiveSessionStatus(root, status),
    });
  };

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
      resolveProfileLabel: (id) => resolveLaunchProfile(id).label,
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
      replaceConversations: (conversations) => {
        chatConversationsRef.current = conversations;
        setChatConversations(conversations);
      },
      persistHarnessRecords: persistComposerHarnessRecords,
      persistSessions: persistProjectSessions,
      setLaunching: setOrchestrationLaunching,
      setError: setOrchestrationError,
      setOpen: setOrchestrationOpen,
      setNotice: setActionNotice,
    });
  };

  const stopChildChatRun = async (projectPath: string, session: ProjectSession) => {
    const runId = chatConversationsRef.current[composerHarnessSessionKey(projectPath, session.id)]?.activeRunId;
    if (!runId) return;
    await invoke("stop_chat_run", { runId });
    setActionNotice(`Stopping ${session.title}`);
  };

  const returnChildResult = async (projectPath: string, session: ProjectSession) => {
    return executeOrchestrationChildResult({
      childConversation: chatConversationsRef.current[composerHarnessSessionKey(projectPath, session.id)],
      now: Date.now,
      returnResult: ({ itemId, parentSessionId, text, title }) => {
        const parentChatId = composerHarnessSessionKey(projectPath, parentSessionId);
        updateChatConversation(parentChatId, (conversation) => appendToolChatMessage(conversation, title, text, itemId));
      },
      session,
      setNotice: setActionNotice,
      updateSessionMetadata: (orchestration) => updateProjectSessionMetadata(projectPath, session.id, {
        orchestration,
      }),
    });
  };

  const removeChildWorktree = async (projectPath: string, session: ProjectSession) => {
    const metadata = session.orchestration;
    if (!metadata?.worktreePath || !metadata.worktreeBranch) return;
    await invoke("remove_project_worktree", {
      root: projectPath,
      worktreePath: metadata.worktreePath,
      branch: metadata.worktreeBranch,
    });
    await updateProjectSessionMetadata(projectPath, session.id, {
      orchestration: { ...metadata, worktreePath: undefined, worktreeBranch: undefined },
    });
    setActionNotice(`Removed ${session.title} worktree`);
  };

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

  const switchLaunchProfile = async (profile: LaunchProfile) => {
    if (profile.id === launchProfile.id || launchProfileChanging) return;
    const store = storeRef.current;
    launchProfileRef.current = profile;
    setLaunchProfile(profile);
    const nextScopedSettings = setScopedSetting(
      scopedSettingsRef.current,
      "global",
      "agentProfileId",
      profile.id,
      workspacePathRef.current,
      activeSessionForProject(workspacePathRef.current),
    );
    scopedSettingsRef.current = nextScopedSettings;
    setScopedSettings(nextScopedSettings);
    await store?.set("launchProfile", profile);
    await store?.set("scopedSettings", nextScopedSettings);
    await store?.save();
  };

  const switchTerminalLaunchProfile = async (profile: LaunchProfile) => {
    if (profile.id === terminalLaunchProfile.id || launchProfileChanging) return;
    terminalLaunchProfileRef.current = profile;
    setTerminalLaunchProfile(profile);
    await storeRef.current?.set("terminalLaunchProfile", profile);
    await storeRef.current?.save();
  };

  const addCustomTerminalProfile = async (label: string, command: string) => {
    const profile = createCustomLaunchProfile(crypto.randomUUID(), label, command);
    const next = [...customLaunchProfilesRef.current, profile];
    customLaunchProfilesRef.current = next;
    setCustomLaunchProfiles(next);
    await storeRef.current?.set("customLaunchProfiles", next);
    await storeRef.current?.save();
  };

  const saveAiConnectionSettings = async (next: AiConnectionSettings) => {
    aiConnectionSettingsRef.current = next;
    setAiConnectionSettings(next);
    await storeRef.current?.set("aiConnectionSettings", next);
    await storeRef.current?.save();
  };

  const removeCustomTerminalProfile = async (profileId: string) => {
    const next = customLaunchProfilesRef.current.filter((profile) => profile.id !== profileId);
    if (next.length === customLaunchProfilesRef.current.length) return;
    customLaunchProfilesRef.current = next;
    setCustomLaunchProfiles(next);
    await storeRef.current?.set("customLaunchProfiles", next);
    if (terminalLaunchProfileRef.current.id === profileId) {
      await switchTerminalLaunchProfile(defaultTerminalLaunchProfile());
    } else {
      await storeRef.current?.save();
    }
  };

  const setComposerApprovalMode = async (approvalMode: AgentApprovalMode) => {
    await updateScopedSetting("chat", "approvalMode", approvalMode);
    const next = await updateActiveComposerHarness((state) => ({ ...state, approvalMode }));
    if (!next) return;
    logComposerHarnessEvent("Permission mode changed", approvalMode);
  };

  const setComposerGoal = async (goal: string, options: { log?: boolean } = {}) => {
    const next = await updateActiveComposerHarness((state) => ({ ...state, goal: goal.slice(0, 160) }));
    if (options.log && next?.goal) logComposerHarnessEvent("Goal updated", next.goal);
  };

  const setComposerRuntime = async (provider: ChatProvider, model: string) => {
    const chatId = activeComposerHarnessKey;
    if (!chatId || activeChatConversation.activeRunId) return;
    const providerChanged = provider !== activeComposerProvider;
    if (providerChanged) await updateScopedSetting("chat", "agentProfileId", provider);
    await updateActiveComposerHarness((state) => ({
      ...state,
      selectedProfileId: provider,
      model: model.trim().slice(0, 128),
    }));
    if (providerChanged) {
      updateChatConversation(chatId, (conversation) => ({
        ...conversation,
        provider,
        providerThreadId: undefined,
        updatedAt: Date.now(),
      }));
      logComposerHarnessEvent("Chat provider changed", chatProviderLabel(provider));
    }
    logComposerHarnessEvent("Chat model changed", model.trim() || `${chatProviderLabel(provider)} default`);
  };

  const setComposerReasoningEffort = async (reasoningEffort: ComposerReasoningEffort) => {
    const next = await updateActiveComposerHarness((state) => ({ ...state, reasoningEffort }));
    if (!next) return;
    logComposerHarnessEvent("Reasoning effort changed", composerReasoningLabel(reasoningEffort));
  };

  const focusTerminalPane = async (paneId: number, requestedBy: "user" | "agent" = "user") => {
    if (paneId === activeTerminalPaneIdRef.current) return;
    const pane = terminalPanesRef.current.find((item) => item.id === paneId);
    const audit = await gateAppAction(createAppAction({
      kind: "focus-pane",
      label: "Focus pane",
      target: pane ? terminalPaneLabelForDisplay(pane.label, pane.profile.label, pane.slot) : `pane:${paneId}`,
      risk: "low",
      requestedBy,
    }));
    if (audit.decision !== "approved") return;
    try {
      await invoke("focus_pane", { paneId });
      const root = workspacePathRef.current;
      const sessionId = activeSessionForProject(root);
      const contextKey = paneContextKey(root, sessionId);
      if (contextKey) activeTerminalPaneByContextRef.current = { ...activeTerminalPaneByContextRef.current, [contextKey]: paneId };
      setFocusedTerminalPane(paneId);
      const cached = terminalSnapshotsRef.current[paneId];
      if (cached) {
        latest.current = cached;
        selection.current = null;
        requestTerminalPaintRef.current();
      }
      setTimeout(sendTerminalResize, 0);
    } catch (err) {
      setLaunchError(String(err));
    }
  };

  const createTerminalPane = async (
    profile: LaunchProfile = terminalLaunchProfileRef.current,
    requestedBy: "user" | "agent" = "user",
  ) => {
    const root = workspacePathRef.current ?? workspacePath;
    const sessionId = activeSessionForProject(root);
    if (!root || !sessionId || launchProfileChanging) return false;
    const audit = await gateAppAction(createAppAction({
      kind: "create-pane",
      label: "Create pane",
      target: `${profile.label} in ${root}`,
      risk: "medium",
      requestedBy,
      undoHint: "Close the new pane.",
    }));
    if (audit.decision !== "approved") return false;
    setLaunchProfileChanging(true);
    try {
      const result = await invoke<OpenPaneResponse>("create_pane", { path: root, profile, environment: connectionEnvironmentInputs(aiConnectionSettingsRef.current, root) });
      const existingPanes = terminalPanesForSession(root, sessionId);
      const slot = existingPanes.length;
      const pane = buildCreatedTerminalPane({
        createdAt: Date.now(),
        existingPanes,
        paneId: result.paneId,
        profile,
        root,
        savedLabel: savedPaneLabelForSlot(root, slot),
      });
      const nextPanes = [...existingPanes, pane];
      setSessionTerminalPanes(root, sessionId, nextPanes, result.paneId);
      recordCreatedPaneActivity(pane, root, sessionId);
      await finalizeCreatedTerminalPane(root, nextPanes, profile);
      return true;
    } catch (err) {
      setLaunchError(String(err));
      await updateOpenProjectStatus(root, "attention");
      await updateActiveSessionStatus(root, "attention");
      return false;
    } finally {
      setLaunchProfileChanging(false);
    }
  };

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
    const created = await createTerminalPane(resolveLaunchProfile(providerId));
    if (!created) return;
    setUtilityTrayMode("terminal");
    setAgentSurfaceMode("terminal");
  };

  const closeTerminalPane = async (paneId: number) => {
    const root = workspacePathRef.current;
    const sessionId = activeSessionForProject(root);
    if (!root || !sessionId) return false;
    const pane = terminalPanesForSession(root, sessionId).find((item) => item.id === paneId);
    if (!pane) return false;
    return executeTerminalPaneClose({
      clearPaneSnapshot: (id) => { delete terminalSnapshotsRef.current[id]; },
      closePane: async (id) => (await invoke<{ activePaneId: number | null }>("close_pane", { paneId: id })).activePaneId,
      currentPanes: () => terminalPanesForSession(root, sessionId),
      focusPane: (id) => invoke("focus_pane", { paneId: id }),
      gateAction: async (action) => (await gateAppAction(action, activeAgentSessionDescriptor)).decision,
      markIntentionallyTerminated: (id) => intentionallyTerminatedPaneIdsRef.current.add(id),
      pane,
      projectStatus: () => projectStatusForRoot(root),
      requestPaint: () => requestTerminalPaintRef.current(),
      scheduleResize: () => setTimeout(sendTerminalResize, 0),
      sessionStatus: terminalPaneProjectStatus,
      setError: setLaunchError,
      setLatestSnapshot: (id) => { latest.current = id == null ? null : terminalSnapshotsRef.current[id] ?? null; },
      setSessionPanes: (panes, activeId) => setSessionTerminalPanes(root, sessionId, panes, activeId),
      unmarkIntentionallyTerminated: (id) => intentionallyTerminatedPaneIdsRef.current.delete(id),
      updateProjectStatus: (status) => updateOpenProjectStatus(root, status),
      updateSessionStatus: (status) => updateActiveSessionStatus(root, status),
    });
  };

  const createWorktreePane = async (profile: LaunchProfile = terminalLaunchProfileRef.current) => {
    const root = workspacePathRef.current ?? workspacePath;
    const sessionId = activeSessionForProject(root);
    if (!root || !sessionId || launchProfileChanging) return;
    const rawLabel = window.prompt("Worktree label (used for the branch name)");
    const label = rawLabel?.trim();
    if (!label) return;
    const audit = await gateAppAction(createAppAction({
      kind: "create-worktree",
      label: "Create worktree",
      target: `${label} in ${root}`,
      risk: "medium",
      requestedBy: "user",
      undoHint: "Remove the worktree from the pane's context menu.",
    }));
    if (audit.decision !== "approved") return;
    setLaunchProfileChanging(true);
    try {
      const worktree = await invoke<WorktreeResponse>("create_project_worktree", { root, label });
      const result = await invoke<OpenPaneResponse>("create_pane", { path: worktree.path, profile, environment: connectionEnvironmentInputs(aiConnectionSettingsRef.current, root) });
      const existingPanes = terminalPanesForSession(root, sessionId);
      const { pane, record } = buildCreatedWorktreePaneState({
        branch: worktree.branch,
        createdAt: Date.now(),
        existingPanes,
        label,
        paneId: result.paneId,
        path: worktree.path,
        profile,
        projectRoot: root,
      });
      const nextPanes = [...existingPanes, pane];
      setSessionTerminalPanes(root, sessionId, nextPanes, result.paneId);
      setWorktrees((current) => {
        const next = addWorktree(current, record);
        void storeRef.current?.set("worktrees", next);
        void storeRef.current?.save();
        return next;
      });
      recordCreatedWorktreePaneActivity(pane, root, sessionId, worktree.branch);
      await finalizeCreatedTerminalPane(root, nextPanes, profile);
    } catch (err) {
      setLaunchError(String(err));
      await updateOpenProjectStatus(root, "attention");
      await updateActiveSessionStatus(root, "attention");
    } finally {
      setLaunchProfileChanging(false);
    }
  };

  const closeWorktreePane = async (paneId: number) => {
    const root = workspacePathRef.current;
    if (!root) return;
    const worktree = worktreeForPaneId(worktrees, String(paneId));
    if (!worktree) return;
    const audit = await gateAppAction(createAppAction({
      kind: "remove-worktree",
      label: "Remove worktree",
      target: worktree.branch,
      risk: "destructive",
      requestedBy: "user",
      undoHint: "The worktree branch and files are deleted; recreate from the context menu if needed.",
    }), activeAgentSessionDescriptor);
    if (audit.decision !== "approved") return;
    const closed = await closeTerminalPane(paneId);
    if (!closed) return;
    try {
      await invoke("remove_project_worktree", { root, worktreePath: worktree.path, branch: worktree.branch });
    } catch (err) {
      setLaunchError(String(err));
    }
    setWorktrees((current) => {
      const next = removeWorktreeByPaneId(current, String(paneId));
      void storeRef.current?.set("worktrees", next);
      void storeRef.current?.save();
      return next;
    });
  };

  const activeAgentSessionHandle: AgentSessionHandle | null = activeAgentSessionDescriptor
    ? {
        ...activeAgentSessionDescriptor,
        send: async (text: string) => {
          if (activeTerminalPaneIdRef.current !== activeAgentSessionDescriptor.paneId) {
            await focusTerminalPane(activeAgentSessionDescriptor.paneId);
          }
          await invoke("paste", { text });
          await invoke("send_key", { code: "Enter", text: null, shift: false, alt: false, ctrl: false, sup: false });
        },
        interrupt: async () => {
          if (activeTerminalPaneIdRef.current !== activeAgentSessionDescriptor.paneId) {
            await focusTerminalPane(activeAgentSessionDescriptor.paneId);
          }
          await invoke("send_key", { code: "KeyC", text: null, shift: false, alt: false, ctrl: true, sup: false });
        },
        readTail: async (lines: number) =>
          readTailFromSnapshot(
            terminalSnapshotsRef.current[activeAgentSessionDescriptor.paneId] ??
              (activeTerminalPaneIdRef.current === activeAgentSessionDescriptor.paneId ? latest.current : null),
            lines,
          ),
        close: async () => {
          const closed = await closeTerminalPane(activeAgentSessionDescriptor.paneId);
          if (closed) {
            recordAgentActivity(activeAgentSessionDescriptor, {
              kind: "process",
              label: "Closed pane",
              detail: activeAgentSessionDescriptor.label,
              status: "exited",
            });
          }
        },
      }
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

  const reloadSelectedFileFromDisk = async () => {
    if (!selectedFile) return;
    await openEditorFileDirect(selectedFile, { focusEditor: true });
  };

  const overwriteSelectedFile = async () => {
    await saveEditorFile({ force: true });
  };

  const openSelectedFileExternally = async () => {
    if (!selectedFile) return;
    setEditorRecoveryError(null);
    try {
      await openPath(selectedFile.path);
    } catch (err) {
      setEditorRecoveryError(`Could not open ${selectedFile.name} externally: ${err}`);
    }
  };

  const revealSelectedFile = async () => {
    if (!selectedFile) return;
    setEditorRecoveryError(null);
    try {
      await revealItemInDir(selectedFile.path);
    } catch (err) {
      setEditorRecoveryError(`Could not reveal ${selectedFile.name}: ${err}`);
    }
  };

  const copyPathToClipboard = async (path: string) => {
    await writeText(path);
    setActionNotice(`Copied ${basename(path)} path`);
  };

  const openEditorSearch = () => {
    const view = editorViewRef.current;
    if (!view) return;
    openSearchPanel(view);
    requestAnimationFrame(() => view.focus());
  };

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

  const terminalSelectedText = () => {
    const snap = latest.current;
    return snap && selection.current ? selectionToText(snap.cells, snap.cols, selection.current) : "";
  };

  const copyTerminalSelection = async () => {
    const selectedText = terminalSelectedText();
    if (!selectedText) return;
    await writeText(selectedText);
  };

  const copyActivePaneTail = async () => {
    const tail = await activeAgentSessionHandle?.readTail(20);
    if (!tail) return;
    await writeText(tail);
    recordAgentActivity(activeAgentSessionHandle ?? null, {
      kind: "app",
      label: "Copied output",
      detail: "Last 20 lines",
      status: "complete",
    });
  };

  const pasteIntoTerminal = async () => {
    if (activeTerminalPaneIdRef.current == null) return;
    const text = await readText();
    if (!text) return;
    selection.current = null;
    await invoke("paste", { text });
  };

  const clearActiveTerminal = async () => {
    if (activeTerminalPaneIdRef.current == null) return;
    selection.current = null;
    await invoke("send_key", { code: "KeyL", text: null, shift: false, alt: false, ctrl: true, sup: false });
  };

  const openContextMenu = (event: ReactMouseEvent, items: ContextMenuItem[]) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, items });
  };



  const gitFileContextMenuItems = (file: GitStatusFile): ContextMenuItem[] => [
    menuItem("git.diff", "Open Diff", () => openGitDiff(file), { icon: "git" }),
    menuItem("git.stage", "Stage File", () => runGitFileAction("stage", file), {
      icon: "git",
      disabled: !(file.index === "?" || file.worktree !== " "),
    }),
    menuItem("git.unstage", "Unstage File", () => runGitFileAction("unstage", file), {
      icon: "git",
      disabled: file.index === " " || file.index === "?",
    }),
    menuItem("git.discard", "Discard Unstaged Changes", () => runGitFileAction("discard", file), {
      icon: "error",
      danger: true,
      disabled: !(file.index === "?" || file.worktree !== " "),
    }),
  ];

  const fileNodeContextMenuItems = (node: FileTreeNode): ContextMenuItem[] => {
    const items = node.gitStatus
      ? gitFileContextMenuItems({
          path: node.gitStatus.relativePath,
          index: node.gitStatus.index,
          worktree: node.gitStatus.worktree,
        })
      : [];
    return [
      ...items,
      menuItem("file.new", "New File", () => createFileInRail(node), { icon: "filePlus" }),
      menuItem("folder.new", "New Folder", () => createFolderInRail(node), { icon: "folderPlus" }),
      menuItem("file.rename", "Rename", () => renameRailNode(node), { icon: "file" }),
      menuItem("file.duplicate", "Duplicate", () => duplicateRailNode(node), { icon: "file" }),
      menuItem("file.reveal", "Reveal in Finder", () => revealRailNode(node), { icon: "folderOpen" }),
      menuItem("file.copy-path", "Copy Path", () => copyPathToClipboard(node.path), { icon: "file" }),
      menuItem("file.delete", "Delete", () => deleteRailNode(node), { icon: "error", danger: true }),
    ];
  };
  fileNodeContextMenuItemsRef.current = fileNodeContextMenuItems;

  const workspaceContextMenuItems = (): ContextMenuItem[] => [
    menuItem("workspace.open", "Open Folder", () => pickWorkspace(), { icon: "folderOpen", shortcut: shortcutKeys("workspace.open") }),
    menuItem("workspace.new-file", "New File", () => createFileInRail(), { icon: "filePlus", disabled: !workspacePath }),
    menuItem("workspace.new-folder", "New Folder", () => createFolderInRail(), { icon: "folderPlus", disabled: !workspacePath }),
    menuItem("workspace.reveal", "Reveal in Finder", () => workspacePath ? revealItemInDir(workspacePath) : undefined, {
      icon: "folderOpen",
      disabled: !workspacePath,
    }),
    menuItem("workspace.copy-path", "Copy Workspace Path", () => workspacePath ? copyPathToClipboard(workspacePath) : undefined, {
      icon: "workspace",
      disabled: !workspacePath,
    }),
  ];

  const projectRailContextMenuItems = (project: OpenProject): ContextMenuItem[] => [
    menuItem("project.switch", "Switch to Project", () => requestOpenWorkspace(project.path), {
      icon: "workspace",
      disabled: project.path === workspacePath,
    }),
    menuItem("project.reveal", "Reveal in Finder", () => revealItemInDir(project.path), { icon: "folderOpen" }),
    menuItem("project.copy-path", "Copy Path", () => copyPathToClipboard(project.path), { icon: "file" }),
    menuItem(
      "project.close",
      "Close Project",
      () => requestCloseProject(project),
      { icon: "close", danger: true },
    ),
  ];

  const updateProjectSessionMetadata = async (
    projectPath: string,
    sessionId: string,
    metadata: Partial<ProjectSession>,
  ) => {
    const next = {
      ...projectSessionsRef.current,
      [projectPath]: (projectSessionsRef.current[projectPath] ?? []).map((session) =>
        session.id === sessionId ? { ...session, ...metadata, updatedAt: Date.now() } : session,
      ),
    };
    await persistProjectSessions(next, activeSessionByProjectRef.current);
  };

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

  const archiveProjectSession = async (projectPath: string, session: ProjectSession, archived: boolean) => {
    const next = setProjectSessionArchived(projectSessionsRef.current, projectPath, session.id, archived);
    if (next === projectSessionsRef.current) return;
    await persistProjectSessions(next, activeSessionByProjectRef.current);
  };

  const pinProjectSession = async (projectPath: string, session: ProjectSession, pinned: boolean) => {
    const next = setProjectSessionPinned(projectSessionsRef.current, projectPath, session.id, pinned);
    if (next === projectSessionsRef.current) return;
    await persistProjectSessions(next, activeSessionByProjectRef.current);
    setActionNotice(pinned ? `Pinned ${session.title}` : `Unpinned ${session.title}`);
  };

  const editorTabContextMenuItems = (tab: FileTreeNode): ContextMenuItem[] => [
    menuItem("tab.open", "Open", () => requestOpenEditorFile(tab, { focusEditor: true }), { icon: "file" }),
    menuItem("tab.close", "Close Tab", () => closeEditorTab(tab), { icon: "close", shortcut: shortcutKeys("editor.close-tab") }),
    menuItem("tab.reveal", "Reveal in Finder", () => revealRailNode(tab), { icon: "folderOpen" }),
    menuItem("tab.copy-path", "Copy Path", () => copyPathToClipboard(tab.path), { icon: "file" }),
  ];

  const editorContextMenuItems = (): ContextMenuItem[] => [
    menuItem("editor.save", "Save", () => saveEditorFile(), {
      icon: "save",
      shortcut: shortcutKeys("editor.save"),
      disabled: !editorDirty || editorSaving || editorLoading,
    }),
    menuItem("editor.find", "Find and Replace", openEditorSearch, {
      icon: "search",
      shortcut: shortcutKeys("editor.find"),
      disabled: !selectedFile || editorLoading,
    }),
    menuItem("editor.open-external", "Open Externally", () => openSelectedFileExternally(), { icon: "file", disabled: !selectedFile }),
    menuItem("editor.reveal", "Reveal in Finder", () => revealSelectedFile(), { icon: "folderOpen", disabled: !selectedFile }),
    menuItem("editor.copy-path", "Copy File Path", () => selectedFile ? copyPathToClipboard(selectedFile.path) : undefined, { icon: "file", disabled: !selectedFile }),
  ];

  const diffContextMenuItems = (): ContextMenuItem[] => {
    if (!diffReview) return [];
    return [
      menuItem("diff.stage", "Stage File", () => runGitFileAction("stage", diffReview.file), {
        icon: "git",
        disabled: !diffReviewCanStage || diffReviewLoading,
      }),
      menuItem("diff.unstage", "Unstage File", () => runGitFileAction("unstage", diffReview.file), {
        icon: "git",
        disabled: !diffReviewCanUnstage || diffReviewLoading,
      }),
      menuItem("diff.discard", "Discard Unstaged Changes", () => runGitFileAction("discard", diffReview.file), {
        icon: "error",
        danger: true,
        disabled: !diffReviewCanDiscard || diffReviewLoading,
      }),
      menuItem("diff.copy", "Copy Shown Diff", () => copyShownDiff(), {
        icon: "copy",
        disabled: diffReview.response.diff.length === 0,
      }),
      menuItem("diff.open", "Open File", () => openDiffFile(), { icon: "file", disabled: !diffReviewCanOpenFile }),
      menuItem("diff.close", "Close Diff", closeDiffReview, { icon: "close" }),
    ];
  };

  const persistPaneTranscript = (
    projectId: string,
    projectSessionId: string,
    pane: { label?: string | null; profile: { label: string } },
    paneIndex: number,
    text: string,
    savedAt: number,
  ) => {
    const transcript = buildPaneTranscript({
      id: `transcript-${savedAt.toString(36)}-${Math.max(0, paneIndex)}`,
      projectId,
      projectSessionId,
      paneLabel: terminalPaneLabelForDisplay(pane.label, pane.profile.label, paneIndex),
      profileLabel: pane.profile.label,
      savedAt,
      text,
    });
    setPaneTranscripts((current) => {
      const next = addPaneTranscript(current, transcript);
      void storeRef.current?.set("paneTranscripts", next);
      void storeRef.current?.save();
      return next;
    });
  };

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
    launchProfileChanging,
    launchProfileLabel: terminalLaunchProfile.label,
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
      createPane: () => createTerminalPane(terminalLaunchProfile),
      createWorktreePane: () => createWorktreePane(terminalLaunchProfile),
      interrupt: () => interruptActivePane(),
      killPane: () => activeTerminalPane ? terminateTerminalPane(activeTerminalPane) : undefined,
      paste: () => pasteIntoTerminal(),
      removeWorktree: () => activeTerminalPane ? closeWorktreePane(activeTerminalPane.id) : undefined,
      renamePane: () => activeTerminalPane ? renameTerminalPane(activeTerminalPane) : undefined,
      restartPane: () => activeTerminalPane ? restartTerminalPane(activeTerminalPane) : undefined,
      saveTranscript: saveActivePaneTranscript,
    },
  });

  const terminalPaneContextMenuItems = (pane: ManagedTerminalPane): ContextMenuItem[] => [
    menuItem("pane.focus", "Focus Pane", () => focusTerminalPane(pane.id), {
      icon: "terminal",
      disabled: pane.id === activeTerminalPaneId,
    }),
    menuItem("pane.rename", "Rename Pane", () => renameTerminalPane(pane), { icon: "terminal" }),
    menuItem("pane.restart", "Restart Process", () => restartTerminalPane(pane), {
      icon: "reload",
      disabled: launchProfileChanging,
    }),
    menuItem("pane.kill", "Kill Process", () => terminateTerminalPane(pane), {
      icon: "stop",
      danger: true,
      disabled: pane.state === "exited",
    }),
    menuItem("pane.close", "Close Pane", () => closeTerminalPane(pane.id), {
      icon: "close",
      danger: true,
    }),
    menuItem("pane.remove-worktree", "Remove Worktree", () => closeWorktreePane(pane.id), {
      icon: "close",
      danger: true,
      disabled: !worktreeForPaneId(worktrees, String(pane.id)),
    }),
    menuItem("pane.copy-cwd", "Copy Working Directory", () => copyPathToClipboard(pane.cwd), { icon: "workspace" }),
  ];

  const copySelectedActivityLog = async () => {
    const text = selectedAgentActivityLog.map((event) => [
      new Date(event.timestamp).toISOString(),
      event.kind,
      event.label,
      event.detail ?? event.target ?? "",
      event.status,
    ].join("\t")).join("\n");
    if (!text) return;
    await writeText(text);
    setActionNotice("Copied activity log");
  };

  const utilityTrayTabContextMenuItems = (mode: UtilityTrayMode): ContextMenuItem[] => {
    const label = mode.charAt(0).toUpperCase() + mode.slice(1);
    const modeItems: ContextMenuItem[] = mode === "terminal"
      ? [
          menuItem("utility.terminal.new-shell", "New Shell Pane", () => createTerminalPane(defaultTerminalLaunchProfile()), {
            icon: "terminal",
            disabled: !workspacePath || launchProfileChanging,
          }),
          menuItem("utility.terminal.close-pane", "Close Selected Pane", () => activeTerminalPane ? closeTerminalPane(activeTerminalPane.id) : undefined, {
            icon: "close",
            danger: true,
            disabled: !activeTerminalPane,
          }),
        ]
      : mode === "processes"
        ? [
            menuItem("utility.processes.restart", "Restart Selected Process", () => activeTerminalPane ? restartTerminalPane(activeTerminalPane) : undefined, {
              icon: "reload",
              disabled: !activeTerminalPane || launchProfileChanging,
            }),
            menuItem("utility.processes.kill", "Kill Selected Process", () => activeTerminalPane ? terminateTerminalPane(activeTerminalPane) : undefined, {
              icon: "stop",
              danger: true,
              disabled: !activeTerminalPane || activeTerminalPane.state === "exited",
            }),
          ]
        : [
            menuItem("utility.logs.copy", "Copy Activity Log", copySelectedActivityLog, {
              icon: "logs",
              disabled: selectedAgentActivityLog.length === 0,
            }),
          ];
    return [
      {
        id: `utility.${mode}.show`,
        label: `Show ${label}`,
        icon: mode === "terminal" ? "terminal" : mode === "processes" ? "waiting" : "logs",
        disabled: agentSurfaceMode === "terminal" && utilityTrayMode === mode,
        onSelect: () => {
          setUtilityTrayMode(mode);
          setAgentSurfaceMode("terminal");
        },
      },
      ...modeItems,
      menuItem("utility.hide", "Hide Bottom Panel", () => setAgentSurfaceMode("chat"), {
        icon: "chevronDown",
        disabled: agentSurfaceMode !== "terminal",
      }),
    ];
  };

  const browserContextMenuItems = (): ContextMenuItem[] => buildBrowserContextMenuItems({
    canGoBack: browserCanGoBack,
    canGoForward: browserCanGoForward,
    actions: {
      back: () => goBrowserHistory(-1),
      copyUrl: async () => { await writeText(browserUrl); setActionNotice("Copied browser URL"); },
      forward: () => goBrowserHistory(1),
      openExternal: () => openUrl(browserUrl),
      reload: reloadBrowserPreview,
    },
  });

  const composerMenuInput = () => ({
    activeRun: Boolean(activeChatConversation.activeRunId),
    canAttachCurrent: Boolean(selectedFile),
    canRunParallel: Boolean(workspacePath && activeSessionId && !activeChatConversation.activeRunId),
    draft: composerDraft,
    hasWorkspace: Boolean(workspacePath),
    sending: composerSending,
    shortcut: shortcutKeys("composer.send"),
    actions: {
      attachCurrent: () => attachSelectedFileToComposer(),
      attachLocal: () => attachLocalFileToComposer(),
      attachPreview: () => attachPreviewToComposer(),
      clearDraft: () => setComposerLocalState(activeComposerHarnessKey, "", composerHistory),
      copyWorkspace: () => workspacePath ? copyPathToClipboard(workspacePath) : undefined,
      parallel: () => { setOrchestrationError(null); setOrchestrationOpen(true); },
      send: () => submitComposerDraft(),
      stop: () => stopActiveChatRun(),
    },
  });
  const composerContextMenuItems = (): ContextMenuItem[] => buildComposerContextMenuItems(composerMenuInput());
  const composerAddMenuItems = (): ContextMenuItem[] => buildComposerAddMenuItems(composerMenuInput());

  const openComposerAddMenu = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.currentTarget.closest(".agent-composer__bar")
      ?.querySelectorAll<HTMLDetailsElement>("details.agent-composer__menu[open]")
      .forEach((menu) => menu.removeAttribute("open"));
    const items = composerAddMenuItems();
    const rect = event.currentTarget.getBoundingClientRect();
    setContextMenu({ x: rect.left, y: rect.top - (items.length * 28 + 20), items });
  };

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
    launchProfileChanging,
    onClear: () => void clearActiveTerminal(),
    onClose: () => { if (activeAgentSessionHandle) void activeAgentSessionHandle.close(); },
    onCreatePane: (profile: LaunchProfile) => void createTerminalPane(profile),
    onCreateWorktreePane: (profile: LaunchProfile) => void createWorktreePane(profile),
    onFind: () => terminalFind.setOpen(true),
    onKill: (pane: ManagedTerminalPane) => void terminateTerminalPane(pane),
    onRemoveWorktree: (paneId: number) => void closeWorktreePane(paneId),
    onRestart: (pane: ManagedTerminalPane) => void restartTerminalPane(pane),
    shortcut: shortcutKeys,
    terminalProfile: terminalLaunchProfile,
    workspacePath,
    worktrees,
  };
  const commandPaletteWorkbench = {
    activeComposerHarnessKey,
    browserUrl,
    detectedBrowserUrl: activeDetectedLocalDevServer?.url ?? null,
    editorDirty,
    editorLoading,
    editorSaving,
    onAttachCurrentFile: () => void attachSelectedFileToComposer(),
    onAttachPreview: () => void attachPreviewToComposer(),
    onCloseEditorTab: () => { if (selectedFile) void closeEditorTab(selectedFile); },
    onExportPerformance: () => void exportRenderPerfSnapshot(),
    onFindEditor: openEditorSearch,
    onOpenDetectedBrowser: () => void openDetectedLocalDevServer(),
    onOpenSettings: () => setSettingsOpen(true),
    onOpenTranscripts: () => setTranscriptsOpen(true),
    onOpenWorkspace: () => void pickWorkspace(),
    onQuickOpen: quickOpen.openDialog,
    onReloadBrowser: reloadBrowserPreview,
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
  const commandPaletteCommands: CommandPaletteCommand[] = [
    ...buildChatPaletteCommands(commandPaletteChats),
    ...buildWorkspaceOpenCommands(commandPaletteWorkbench),
    ...COMPOSER_APP_COMMANDS.map((info) => ({
      id: `composer.${info.command}`,
      label: `App Command ${info.label}`,
      detail: info.detail,
      icon: "send" as AppIconName,
      keywords: ["composer", "app command", ...info.aliases],
      run: () => void runComposerAppCommand(info.command),
    })),
    ...buildChromeCommands(commandPaletteWorkbench),
    ...buildTerminalFindCommands(commandPaletteTerminal),
    ...buildWorkspaceCommands(commandPaletteWorkbench),
    ...buildEditorCommands(commandPaletteWorkbench),
    ...buildTerminalLifecycleCommands(commandPaletteTerminal),
    ...buildBrowserCommands(commandPaletteWorkbench),
    ...buildCommandPaletteLayoutCommands(commandPaletteNavigation),
    ...buildComposerAttachmentCommands(commandPaletteWorkbench),
    ...buildCommandPaletteResourceCommands(commandPaletteNavigation),
  ];
  const filteredCommandPaletteCommands = filterCommandPaletteCommands(commandPaletteCommands, commandPalette.query, commandPaletteSources);
  const visibleCommandPaletteCommands = commandPalette.query.trim()
    ? filteredCommandPaletteCommands.slice(0, 120)
    : [
        ...filteredCommandPaletteCommands.filter((command) => command.source === "chats").slice(0, 6),
        ...filteredCommandPaletteCommands.filter((command) => command.source !== "chats").slice(0, 6),
      ];
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
      snapshot: {
        projects: openProjects.map((project) => ({ path: project.path, status: project.status })),
        activeProjectPath: workspacePath,
        activeChatId: activeSessionId,
        panes: terminalPanes.map((pane, index) => ({
          id: pane.id,
          label: terminalPaneLabelForDisplay(pane.label, pane.profile.label, index),
          state: pane.state,
          cwd: pane.cwd,
        })),
        openFiles: editorTabs.map((file) => file.path),
        selectedFile: selectedFile?.path ?? null,
      },
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
    recordReport: (report) => recordAgentActivity(activeChatActivityHandle(), {
      kind: report.runCardKind === "file" ? "file" : report.runCardKind === "approval" ? "approval" : "tool",
      label: report.status,
      detail: report.detail || "Reported through the Keelhouse agent hook.",
      status: report.runCardStatus,
      provenance: "agent-hook",
      runCardKind: report.runCardKind,
      targets: report.targets,
    }),
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

  const handleEditorUpdate = (update: ViewUpdate) => {
    const file = selectedFileRef.current;
    if (!file) return;
    const { anchor, head } = update.state.selection.main;
    editorViewStatesRef.current[file.path] = {
      anchor,
      head,
      scrollTop: update.view.scrollDOM.scrollTop,
      focused: update.view.hasFocus,
    };
    const line = update.state.doc.lineAt(head);
    setEditorCursor({ line: line.number, column: head - line.from + 1 });
  };

  const restoreEditorView = (view: EditorView) => {
    editorViewRef.current = view;
    const file = selectedFileRef.current;
    if (!file) return;
    const restored = clampEditorViewState(editorViewStatesRef.current[file.path], view.state.doc.length);
    if (restored) {
      view.dispatch({
        selection: { anchor: restored.anchor, head: restored.head },
        scrollIntoView: false,
      });
    }
    requestAnimationFrame(() => {
      if (restored) view.scrollDOM.scrollTop = restored.scrollTop;
      if (pendingEditorFocusRef.current || restored?.focused) view.focus();
      pendingEditorFocusRef.current = false;
    });
  };

  useWorkspaceTreeWatcher({
    getActiveRoot: () => workspacePathRef.current,
    onChange: refreshFileTree,
    onError: (error) => setFileTreeError(`Live file watcher unavailable: ${error}`),
    workspacePath,
  });

  const applyBootstrapRefs = (data: WorkspaceBootstrapSnapshot) => {
    storeRef.current = data.store;
    recentProjectsRef.current = data.recentProjects;
    openProjectsRef.current = data.openProjects;
    projectSessionsRef.current = data.projectSessions;
    activeSessionByProjectRef.current = data.activeSessions;
    browserPreviewByProjectRef.current = data.browserProjects;
    browserPreviewBySessionRef.current = data.browserSessions;
    composerHarnessBySessionRef.current = data.composerHarness;
    scopedSettingsRef.current = data.scopedSettings;
    chatConversationsRef.current = data.chatConversations;
    paneLabelsBySessionRef.current = data.paneLabels;
    sessionEditorSnapshotsRef.current = data.sessionSnapshots;
    paneLayoutsBySessionRef.current = data.paneLayouts;
    launchProfileRef.current = data.launchProfile;
    terminalLaunchProfileRef.current = data.terminalProfile;
    customLaunchProfilesRef.current = data.customProfiles;
    aiConnectionSettingsRef.current = data.aiConnectionSettings;
    activeFilesByWorkspaceRef.current = data.activeFiles;
  };

  const applyBootstrapState = (data: WorkspaceBootstrapSnapshot) => {
    setLaunchProfile(data.launchProfile);
    setTerminalLaunchProfile(data.terminalProfile);
    setCustomLaunchProfiles(data.customProfiles);
    setAiConnectionSettings(data.aiConnectionSettings);
    void refreshConnectionSecretPresence(data.aiConnectionSettings);
    setRecentProjects(data.recentProjects);
    setOpenProjects(data.openProjects);
    setProjectSessions(data.projectSessions);
    setActiveSessionByProjectState(data.activeSessions);
    setBrowserPreviewByProject(data.browserProjects);
    setBrowserPreviewBySession(data.browserSessions);
    setComposerHarnessBySession(data.composerHarness);
    setScopedSettings(data.scopedSettings);
    setChatConversations(data.chatConversations);
    setPaneLabelsBySession(data.paneLabels);
    setAgentActivityEvents(data.agentActivity);
    setActiveKeybindingOverrides(data.keybindings);
    setKeybindingOverrides(data.keybindings);
    setCommandPaletteSources(data.commandPaletteSources);
    if (data.theme) setAppTheme(data.theme);
    if (data.notificationsEnabled) setNotificationsEnabled(true);
    setPaneTranscripts(data.paneTranscripts);
    setWorktrees(data.worktrees);
  };

  // Reopen the last folder on startup, otherwise ask for a workspace.
  const initWorkspace = async () => {
    const data = await loadWorkspaceBootstrap();
    applyBootstrapRefs(data);
    applyBootstrapState(data);
    if (data.lastFolder) await openWorkspaceDirect(data.lastFolder, data.launchProfile);
    else await pickWorkspace();
    sendTerminalResize();
  };

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

  const handleGridPayload = (payload: GridPayload) => {
    ipcSampleCounter.current += 1;
    if (ipcSampleCounter.current % 20 === 0) {
      recordIpcPayloadBytes(renderPerfRef.current, JSON.stringify(payload).length);
    }
    terminalSnapshotsRef.current[payload.paneId] = payload.snapshot;
    detectLocalDevServerFromSnapshot(payload.paneId, payload.snapshot);
    if (payload.paneId === activeTerminalPaneIdRef.current) {
      latest.current = payload.snapshot;
      requestTerminalPaintRef.current();
    }
  };

  const handlePaneExit = (payload: PaneExit) => {
      const intentionallyTerminated = intentionallyTerminatedPaneIdsRef.current.delete(payload.paneId);
      const context = paneContextForPaneId(payload.paneId);
      const root = context?.projectRoot ?? workspacePathRef.current;
      const sessionId = context?.sessionId ?? activeSessionForProject(root);
      const plan = planPaneExit({
        ...payload,
        intentionallyTerminated,
        contextRoot: root,
        contextSessionId: sessionId,
        workspaceRoot: workspacePathRef.current,
        activePaneId: activeTerminalPaneIdRef.current,
        activeSessionId: activeSessionForProject(root),
        panes: setPaneState(payload.paneId, "exited", payload.code),
      });
      if (plan.root && plan.sessionId && plan.pane) {
        recordAgentActivity(
          buildAgentSessionHandleDescriptor({
            pane: plan.pane,
            projectId: plan.root,
            projectSessionId: plan.sessionId,
            label: terminalPaneLabelForDisplay(plan.pane.label, plan.pane.profile.label, plan.paneIndex),
            approvalMode: agentApprovalMode,
          }),
          {
            ...plan.activity,
            target: plan.root,
            outputRef: "terminal",
          },
        );
      }
      if (plan.showLaunchError) setLaunchError(plan.launchError);
      void updateOpenProjectStatus(plan.root, projectStatusForRoot(plan.root));
      void updateSessionStatus(plan.root, plan.sessionId, plan.status);
      if (plan.root && plan.sessionId && plan.pane) {
        const snapshot = terminalSnapshotsRef.current[payload.paneId];
        if (snapshot) persistPaneTranscript(plan.root, plan.sessionId, plan.pane, plan.paneIndex, terminalSnapshotText(snapshot), Date.now());
      }
      if (plan.backgroundExit) {
        setBackgroundExits((exits) => addBackgroundExit(exits, plan.backgroundExit!));
        if (notificationsEnabledRef.current) {
          void notifyBackgroundExit(plan.backgroundExit).catch(() => {});
        }
      }
  };

  useNativeAppEvents<GridPayload, PaneExit>({
    onGrid: handleGridPayload,
    onOpenFolder: () => { void pickWorkspace(); },
    onSaveFile: () => { void saveEditorFileRef.current(); },
    onFindInFile: () => openEditorSearchRef.current(),
    onCloseEditorTab: () => { void closeActiveEditorTabRef.current(); },
    onPaneExit: handlePaneExit,
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
    resolveLaunchProfile,
    restoreBrowserPreview: () => restoreBrowserPreview(
      workspacePathRef.current, activeSessionForProject(workspacePathRef.current),
    ),
    setBrowserLocation,
    setComposerApprovalMode,
    switchLaunchProfile,
    updateScopedSetting,
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
      <aside className={`file-rail ${sideDrawerCollapsed ? "file-rail--collapsed" : ""}`} aria-label={`${sideDrawerMode === "projects" ? "Project threads" : drawerActiveTitle} drawer`}>
        <div className="drawer-toolbar">
          <span>{sideDrawerMode === "projects" ? "Threads" : drawerActiveTitle}</span>
        </div>
        <div className="drawer-mode-switcher" role="tablist" aria-label="Side drawer">
          {DRAWER_MODES.map((mode) => (
            <button
              className={`drawer-mode-switcher__button ${sideDrawerMode === mode.id ? "drawer-mode-switcher__button--active" : ""}`}
              type="button"
              role="tab"
              key={mode.id}
              aria-selected={sideDrawerMode === mode.id}
              title={mode.label}
              onClick={() => {
                if (mode.id === "settings") {
                  setSettingsOpen(true);
                  return;
                }
                setSideDrawerMode(mode.id);
              }}
            >
              <AppIcon name={mode.icon} />
              <span>{mode.label}</span>
            </button>
          ))}
        </div>
        {!sideDrawerCollapsed && sideDrawerMode === "projects" ? (
          <ProjectThreadsDrawer
            activeProjectPath={workspacePath}
            activeSessionId={activeSessionId}
            backgroundExits={backgroundExits}
            expandedProjects={expandedSessionProjects}
            projects={visibleOpenProjects}
            sessionsByProject={projectSessions}
            showArchived={showArchivedSessions}
            projectStatus={projectRailStatus}
            sessionStatus={projectSessionStatus}
            onProjectContextMenu={(event, project) => openContextMenu(event, projectRailContextMenuItems(project))}
            onSelectProject={(path) => void requestOpenWorkspace(path)}
            onSelectSession={(path, sessionId) => void switchProjectSession(path, sessionId)}
            onSessionContextMenu={(event, path, session) => openContextMenu(event, projectSessionContextMenuItems(path, session))}
            onToggleArchived={() => setShowArchivedSessions((show) => !show)}
            onToggleExpanded={(path) => setExpandedSessionProjects((expanded) => ({ ...expanded, [path]: !(expanded[path] ?? false) }))}
          />
        ) : null}
        {!sideDrawerCollapsed && sideDrawerMode === "git" ? (
          <SourceControlDrawer
            error={gitStatusError}
            hasWorkspace={Boolean(workspacePath)}
            loading={gitStatusLoading}
            status={gitStatus}
            onOpenDiff={(file) => void openGitDiff(file)}
            onRefresh={() => void refreshGitStatus()}
          />
        ) : null}
        {!sideDrawerCollapsed && sideDrawerMode === "browser" ? (
          <BrowserToolsDrawer
            address={browserAddress}
            canGoBack={browserCanGoBack}
            canGoForward={browserCanGoForward}
            detectedPaneLabel={activeDetectedLocalDevServer?.paneLabel ?? null}
            detectedUrl={activeDetectedLocalDevServer?.url ?? null}
            error={browserError}
            url={browserUrl}
            onAddressChange={(address) => { setBrowserAddress(address); setBrowserError(null); }}
            onBack={() => goBrowserHistory(-1)}
            onForward={() => goBrowserHistory(1)}
            onOpenDetected={() => void openDetectedLocalDevServer()}
            onOpenExternal={() => void openUrl(browserUrl)}
            onReload={reloadBrowserPreview}
            onShow={() => setWorkbenchLayout(workbenchLayout === "hidden" ? "right" : workbenchLayout)}
            onSubmit={submitBrowserAddress}
          />
        ) : null}
        {!sideDrawerCollapsed && sideDrawerMode === "settings" ? (
          <QuickSettingsDrawer
            approvalMode={activeComposerHarness.approvalMode}
            canSetApproval={Boolean(activeComposerHarnessKey)}
            hasWorkspace={Boolean(workspacePath)}
            launchProfile={terminalLaunchProfile}
            launchProfileChanging={launchProfileChanging}
            launchProfiles={allLaunchProfiles}
            terminalOpen={agentSurfaceMode === "terminal"}
            toolMode={toolTrayMode}
            workbenchLayout={renderedWorkbenchLayout}
            onApprovalChange={(mode) => void setComposerApprovalMode(mode)}
            onBottomTrayChange={(open) => open ? void toggleRawTerminal() : setAgentSurfaceMode("chat")}
            onLayoutChange={setWorkbenchLayout}
            onOpenFolder={() => void pickWorkspace()}
            onProfileChange={(profileId) => void switchTerminalLaunchProfile(resolveLaunchProfile(profileId))}
            onRefreshFiles={refreshFileTree}
            onToolModeChange={setToolTrayMode}
          />
        ) : null}
        {!sideDrawerCollapsed && sideDrawerMode === "files" ? (
          <FilesSideDrawer
            fileOpError={fileOpError}
            fileTree={fileTree}
            fileTreeError={fileTreeError}
            fileTreeLoading={fileTreeLoading}
            fileTreeTruncated={fileTreeTruncated}
            railBodyRef={railBodyRef}
            railHeight={railHeight}
            selectedFileId={selectedFile?.id}
            treeRef={treeRef}
            visibleFileTree={visibleFileTree}
            workspaceName={workspacePath ? basename(workspacePath) : null}
            workspacePath={workspacePath}
            onCreateFile={() => void createFileInRail()}
            onCreateFolder={() => void createFolderInRail()}
            onOpenFile={(file) => void requestOpenEditorFile(file, { focusEditor: true })}
            onOpenFolder={() => void pickWorkspace()}
            onWorkspaceContextMenu={(event) => openContextMenu(event, workspaceContextMenuItems())}
          />
        ) : null}
      </aside>
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
          onFileContextMenu={(event, file) => openContextMenu(event, gitFileContextMenuItems(file))}
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
          address={browserAddress}
          canGoBack={browserCanGoBack}
          canGoForward={browserCanGoForward}
          detectedPaneLabel={activeDetectedLocalDevServer?.paneLabel ?? null}
          detectedUrl={activeDetectedLocalDevServer?.url ?? null}
          error={browserError}
          onAddressChange={(address) => { setBrowserAddress(address); setBrowserError(null); }}
          onBack={() => goBrowserHistory(-1)}
          onContextMenu={(event) => openContextMenu(event, browserContextMenuItems())}
          onForward={() => goBrowserHistory(1)}
          onOpenDetected={() => void openDetectedLocalDevServer()}
          onOpenExternal={() => void openUrl(browserUrl)}
          onReload={reloadBrowserPreview}
          onSubmit={submitBrowserAddress}
          reloadNonce={browserReloadNonce}
          url={browserUrl}
        />

        <section className={`terminal-panel terminal-panel--${agentSurfaceMode}`} aria-label="Agent conversation">
          <div className={`agent-surface agent-surface--${agentSurfaceMode}`}>
            <ChatThreadSurface
              conversation={activeChatConversation}
              events={selectedAgentActivityLog}
              hidden={false}
              onSuggestion={(draft) => setComposerLocalState(activeComposerHarnessKey, draft, composerHistory)}
              onRetry={(prompt) => void submitComposerDraft(prompt)}
              onApprovalDecision={(message, decision) => void resolveChatApproval(message, decision)}
              onToggleBookmark={toggleChatMessageBookmark}
              onForkMessage={(message) => void forkChatFromMessage(message)}
              onReviewFile={(path) => void reviewRunCardFile(path)}
              focusMessageId={focusedChatMessageId}
            />
          </div>
          <AgentComposerSurface
            activeRun={Boolean(activeChatConversation.activeRunId)}
            approvalMode={activeComposerHarness.approvalMode}
            attachments={activeComposerHarness.attachments}
            configuredModels={aiConnectionSettings.providerModels}
            draft={composerDraft}
            error={composerError}
            goal={activeComposerHarness.goal}
            hasHarness={Boolean(activeComposerHarnessKey)}
            hasHistory={composerHistory.length > 0}
            historyCursorActive={composerHistoryIndex != null}
            mentionResults={composerMentionQuery != null ? composerMentionResults : []}
            model={activeComposerHarness.model}
            notice={composerNotice}
            provider={activeComposerProvider}
            reasoningEffort={activeComposerHarness.reasoningEffort}
            sending={composerSending}
            onApprovalChange={(mode) => void setComposerApprovalMode(mode)}
            onAttachMention={(file) => {
              setComposerLocalState(activeComposerHarnessKey, composerDraft.replace(/@[^\s@]*$/, ""), composerHistory);
              void attachWorkspaceFileToComposer(file);
            }}
            onClearGoal={() => void setComposerGoal("")}
            onContextMenu={(event) => openContextMenu(event, composerContextMenuItems())}
            onDismissNotice={() => setComposerNotice(null)}
            onDraftChange={(draft) => {
              setComposerLocalState(activeComposerHarnessKey, draft, composerHistory);
              setComposerHistoryIndex(null);
            }}
            onGoalChange={(goal) => void setComposerGoal(goal)}
            onGoalCommit={() => void setComposerGoal(activeComposerHarness.goal, { log: true })}
            onManageModels={() => setSettingsOpen(true)}
            onNextHistory={showNextComposerHistory}
            onOpenAddMenu={openComposerAddMenu}
            onPasteImage={() => void pasteComposerImage()}
            onPreviousHistory={showPreviousComposerHistory}
            onReasoningChange={setComposerReasoningEffort}
            onRemoveAttachment={(attachment) => void removeComposerAttachmentById(attachment)}
            onReviewContext={() => void reviewComposerContext()}
            onRuntimeChange={setComposerRuntime}
            onStop={() => void stopActiveChatRun()}
            onSubmit={() => void submitComposerDraft()}
          />
        </section>
        <BottomUtilityTray
          activePane={activeTerminalPane} activePaneId={activeTerminalPaneId}
          activeProfileLabel={activeTerminalProfile.label} canClose={Boolean(activeAgentSessionHandle)}
          canvasRef={canvasRef} events={selectedAgentActivityLog} find={terminalFind}
          hasWorkspace={Boolean(workspacePath)} imeInputRef={imeInputRef} launchProfile={terminalLaunchProfile}
          launchProfileChanging={launchProfileChanging} launchProfiles={allLaunchProfiles}
          mode={utilityTrayMode} open={agentSurfaceMode === "terminal"} panes={terminalPanes}
          terminalHostRef={terminalHostRef}
          onClose={() => { if (activeAgentSessionHandle) void activeAgentSessionHandle.close(); }}
          onCreate={(profile) => void createTerminalPane(profile)} onFocus={(paneId) => void focusTerminalPane(paneId)}
          onKill={() => { if (activeTerminalPane) void terminateTerminalPane(activeTerminalPane); }}
          onOpenFolder={() => void pickWorkspace({ openTerminal: true })}
          onOpenTab={(mode) => void openUtilityTray(mode)}
          onPaneContextMenu={(event, pane) => openContextMenu(event, terminalPaneContextMenuItems(pane))}
          onPaste={(text) => { invoke("paste", { text }).catch(() => {}); }}
          onProfileChange={(profileId) => void switchTerminalLaunchProfile(resolveLaunchProfile(profileId))}
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
          customTerminalProfiles={customLaunchProfiles}
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
          onValidateConnectionTarget={(server: McpServerConfig) => probeSettingsMcpServer({
            probe: (input) => invoke<ConnectionTargetStatus>("probe_mcp_server", input),
            server, settings: aiConnectionSettingsRef.current, workspacePath: workspacePath ?? "",
          })}
          onBeginMcpOAuth={(server: McpServerConfig) => beginSettingsMcpOAuth({
            recordStatus: (id, status) => setMcpOAuthStatuses((current) => ({ ...current, [id]: status })),
            server,
            start: (input) => invoke<McpOAuthStart>("begin_mcp_oauth", input),
          })}
          onDisconnectMcpOAuth={(server: McpServerConfig) => disconnectSettingsMcpOAuth({
            clearSecretPresence: (keys) => setConnectionSecretPresence((current) => ({
              ...current, ...Object.fromEntries(keys.map((key) => [key, false])),
            })),
            disconnect: (input) => invoke<McpOAuthStatus>("disconnect_mcp_oauth", input),
            recordStatus: (id, status) => setMcpOAuthStatuses((current) => ({ ...current, [id]: status })),
            server,
          })}
          onCommandPaletteSourceChange={settingsPreferenceActions.onCommandPaletteSourceChange}
          onAddCustomTerminalProfile={(label, command) => void addCustomTerminalProfile(label, command)}
          keybindingOverrides={keybindingOverrides}
          onResetLocalData={() => void resetSettingsLocalData({
            clearStore: async () => {
              const store = storeRef.current;
              if (store) { await store.clear(); await store.save(); }
            },
            confirmReset: (message) => confirmDialog(message),
            deleteSecret: (key) => invoke("delete_connection_secret", { key }),
            reload: () => window.location.reload(),
            resetDurableChats: resetDurableChatStore,
            resetNativeState: () => invoke("reset_local_state"),
            settings: aiConnectionSettings,
          })}
          notificationsEnabled={notificationsEnabled}
          onNotificationsChange={settingsPreferenceActions.onNotificationsChange}
          onRemoveCustomTerminalProfile={(profileId) => void removeCustomTerminalProfile(profileId)}
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
          actionNotice, canUseShellProfile: !launchProfileChanging && launchProfile.id !== "shell", crashNotice, launchError,
          onDismissAction: () => setActionNotice(null), onDismissCrash: () => setCrashNotice(null),
          onOpenFolder: () => void pickWorkspace(),
          onUseShellProfile: () => {
            const shell = LAUNCH_PROFILES.find((profile) => profile.id === "shell");
            if (shell) void switchLaunchProfile(shell);
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
      {contextMenu ? (
        <ContextMenu
          state={contextMenu}
          onDismiss={() => setContextMenu(null)}
          onActionError={(item, error) => setLaunchError(`${item.label} failed: ${String(error)}`)}
        />
      ) : null}
      {commandPalette.open ? (
        <SearchCommandDialog
          commands={visibleCommandPaletteCommands}
          activeIndex={commandPalette.activeIndex}
          query={commandPalette.query}
          shortcut={shortcutKeys("chrome.command-palette")}
          loading={chatSearchLoading}
          error={chatSearchError}
          inputRef={commandPalette.inputRef}
          onClose={commandPalette.close}
          onQueryChange={commandPalette.setQuery}
          onKeyDown={(event) => commandPalette.onKeyDown(event, visibleCommandPaletteCommands)}
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
