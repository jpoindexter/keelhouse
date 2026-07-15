import { type CSSProperties, type FormEvent, type MouseEvent as ReactMouseEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { readImage, readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
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
import { EditorChrome } from "./EditorChrome";
import { EditorDiffView } from "./EditorDiffView";
import { EditorCodeSurface } from "./EditorCodeSurface";
import { AgentComposerSurface } from "./AgentComposerSurface";
import { OrchestrationDialog } from "./OrchestrationDialog";
import {
  browserHistoryCanGoBack,
  browserHistoryCanGoForward,
  DEFAULT_BROWSER_PREVIEW_URL,
  detectLocalDevServerUrl,
  normalizeBrowserPreviewUrl,
  pushBrowserHistory,
} from "./browserPreview";
import type { BrowserPreviewRecords } from "./browserPreview";
import { selectionToText } from "./selection";
import type { SelectionRange } from "./selection";
import {
  activeProjectSessionId,
  forgetActiveFile,
  isMissingWorkspaceError,
  newProjectSession,
  planProjectClose,
  removeOpenProject,
  rememberActiveFile,
  setActiveProjectSession,
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
  fileTreeContainsPath,
  languageLabelForPath,
  pathBreadcrumbs,
  reconcileActiveFileNode,
} from "./editorState";
import type { CursorPosition, EditorViewState } from "./editorState";
import {
  editorLoadErrorState,
  editorLoadStateFromBuffer,
  editorLoadStateFromResponse,
  type EditorFileBuffer,
  type EditorFileLoadState,
} from "./editorFileLoadState";
import {
  discardDraftAndContinueNavigation,
  saveDraftAndContinueNavigation,
} from "./draftProtection";
import {
  dirtyEditorTabPaths,
  removeEditorBuffersWithin,
  removeEditorTab,
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
  launchProfileCommandLine,
} from "./launchProfiles";
import type { LaunchProfile } from "./launchProfiles";
import {
  defaultScopedSettings,
  resetScopedSetting,
  resolveScopedSetting,
  scopedSettingView,
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
import {
  createComposerAttachment,
  defaultComposerHarnessState,
  removeComposerAttachment,
  upsertComposerAttachment,
} from "./composerHarness";
import type { ComposerAttachment, ComposerHarnessRecords, ComposerHarnessState, ComposerReasoningEffort } from "./composerHarness";
import { prepareChatContext } from "./chatContext";
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
import { AppIcon } from "./icons";
import { AppNotices } from "./AppNotices";
import type { AppIconName } from "./icons";
import {
  setActiveKeybindingOverrides,
  shortcutKeys,
  type KeybindingOverrides,
} from "./shortcuts";
import { filterCommandPaletteCommands } from "./commandPalette";
import { SearchCommandDialog, type SearchDialogCommand } from "./SearchCommandDialog";
import { useCommandPalette } from "./useCommandPalette";
import { QuickOpenDialog } from "./QuickOpenDialog";
import { useQuickOpen } from "./useQuickOpen";
import {
  DEFAULT_COMMAND_PALETTE_SOURCES,
  type CommandPaletteSourceId,
} from "./commandPaletteSources";
import { filterWorkspaceFiles } from "./workspaceSearch";
import {
  MAX_AGENT_ACTIVITY_LOG_EVENTS,
  createAgentActivityEvent,
  filterAgentActivityEvents,
  pushAgentActivityEvent,
} from "./agentActivity";
import type { AgentActivityEvent, AgentActivityLogFilter } from "./agentActivity";
import {
  normalizeTerminalPaneLabel,
  terminalPaneLabelForDisplay,
  terminalPaneProjectStatus as projectStatusFromTerminalPanes,
} from "./terminalPane";
import type { TerminalPaneState } from "./terminalPane";
import {
  decorateFileTreeWithGitStatus,
  absolutePathForGitFile,
} from "./fileGitStatus";
import type { GitStatusFile } from "./fileGitStatus";
import { parseUnifiedDiff } from "./diffView";
import type { ParsedDiff } from "./diffView";
import {
  paneLayoutFromPanes,
} from "./sessionRestore";
import type { PaneLayoutsBySession } from "./sessionRestore";
import { useShellLayout, type SideDrawerMode } from "./useShellLayout";
import { useAppChromeState } from "./useAppChromeState";
import { useSettingsRuntimeStatus } from "./useSettingsRuntimeStatus";
import { loadWorkspaceBootstrap, type PaneLabelsBySession } from "./workspaceBootstrap";
import { applyWorkspaceCleanupRecord, planMissingWorkspaceCleanup } from "./workspaceOpenRecovery";
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
  structuredChatProviderId,
} from "./agentConnections";
import {
  CONNECTION_PROVIDER_IDS,
  DEFAULT_AI_CONNECTION_SETTINGS,
  connectionEnvironmentInputs,
  environmentSecretKey,
  mcpOauthClientSecretKey,
  mcpOauthTokenKey,
  mcpSecretKey,
  providerSecretKey,
  type AiConnectionSettings,
  type ConnectionSecretStatus,
  type ConnectionTargetStatus,
  type McpServerConfig,
  type McpOAuthStart,
  type McpOAuthStatus,
} from "./connectionSettings";
import { buildRepoUrl, sourceRepoStatusLabel, type RepoLocation } from "./sourceControlLinks";
import { buildSnapshot, createRenderPerfState, recordIpcPayloadBytes } from "./renderPerf";
import { useTerminalCanvasRuntime } from "./useTerminalCanvasRuntime";
import { useNativeAppEvents } from "./useNativeAppEvents";
import { useAgentHookRequests, type AgentHookStatus } from "./useAgentHookRequests";
import { buildTerminalContextMenuItems } from "./terminalContextMenu";
import { buildProjectSessionContextMenuItems } from "./projectSessionContextMenu";
import { planPaneExit } from "./paneExitPlan";
import { planProjectSessionDelete } from "./deleteProjectSessionPlan";
import { replaceRestartedPane } from "./terminalPaneRestart";
import { planCheckpointRestore } from "./checkpointRestorePlan";
import { buildCreatedTerminalPane } from "./terminalPaneCreate";
import { buildCreatedWorktreePaneState } from "./terminalWorktreePaneCreate";
import { openWorkspaceTerminalPanes } from "./workspaceOpenPanes";
import { prepareWorkspaceOpenSession } from "./workspaceOpenSession";
import { planWorkspaceOpenSuccess } from "./workspaceOpenSuccess";
import { planWorkspaceOpenFailure } from "./workspaceOpenFailure";
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
import type { ChatConversation, ChatConversationRecords, ChatMessage, ChatProvider, ChatRunEnvelope } from "./chatConversation";
import { createChatForkPlan } from "./chatForkPlan";
import {
  deleteDurableChatConversation,
  deleteDurableProjectChats,
  resetDurableChatStore,
  saveDurableChatConversation,
  searchDurableChatMessages,
} from "./chatStore";
import {
  checkpointPreviewMessage,
  createWorkspaceCheckpoint,
  previewWorkspaceCheckpoint,
  restoreWorkspaceCheckpoint,
} from "./workspaceCheckpoints";
import { mergeChatDiscoveryResults, type ChatSearchResult, type ChatSearchViewResult } from "./chatDiscovery";
import { ToolTrayTabs } from "./ToolTrayTabs";
import type { FileTreeNode, FileTreeResponse } from "./fileTreeTypes";
import { StatusBar } from "./StatusBar";
import {
  type OrchestrationChildDraft,
} from "./chatOrchestration";
import { launchOrchestration as launchOrchestrationWithContext } from "./orchestrationLaunch";
import { ContextMenu, type ContextMenuItem, type ContextMenuState } from "./ContextMenu";
import { paneContextBelongsToProject, paneContextKey, paneContextParts } from "./paneOwnership";
import { composerReasoningLabel } from "./ComposerReasoningPicker";
import { closeProjectResources as closeProjectResourcesWithContext } from "./projectResourceClose";
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
type ClosePaneResponse = { activePaneId: number | null };
type WorktreeResponse = { path: string; branch: string };
type TerminalPanesByContext = Record<string, ManagedTerminalPane[]>;
type ActiveTerminalPaneByContext = Record<string, number>;
type WorkspaceTreeChanged = { root: string; count: number };
type TextFileResponse = { path: string; content: string; bytes: number; modifiedMs: number | null };
type ChatImageResponse = { path: string; bytes: number; mimeType: string };
type FileOpResponse = { path: string };
type GitStatusResponse = {
  isRepository: boolean;
  branch: string | null;
  ahead: number;
  behind: number;
  staged: number;
  unstaged: number;
  untracked: number;
  files: GitStatusFile[];
};
type GitDiffResponse = { path: string; diff: string; source: string };
type GitFileAction = "stage" | "unstage" | "discard";
type ActiveDiffReview = {
  file: GitStatusFile;
  absolutePath: string;
  response: GitDiffResponse;
  parsed: ParsedDiff;
};
type OpenEditorFileOptions = { focusEditor?: boolean };
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
type PendingNavigation =
  | { kind: "file"; file: FileTreeNode; options: OpenEditorFileOptions }
  | { kind: "workspace"; path: string }
  | { kind: "close-project"; projectPath: string };
type CommandPaletteCommand = SearchDialogCommand;
type WorkspaceBootstrapSnapshot = Awaited<ReturnType<typeof loadWorkspaceBootstrap>>;

const basename = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? path;
const dirname = (path: string) => path.replace(/[\\/][^\\/]*$/, "") || path;
const formatBytes = (bytes: number | null) => {
  if (bytes == null) return "--";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
const DRAWER_MODES: { id: SideDrawerMode; label: string; icon: AppIconName }[] = [
  { id: "projects", label: "Projects", icon: "workspace" },
  { id: "files", label: "Files", icon: "file" },
  { id: "git", label: "Git", icon: "git" },
  { id: "browser", label: "Browser", icon: "browser" },
  { id: "settings", label: "Settings", icon: "settings" },
];

const menuItem = (
  id: string,
  label: string,
  onSelect: () => void,
  options: Pick<ContextMenuItem, "shortcut" | "icon" | "disabled" | "danger"> = {},
): ContextMenuItem => ({ id, label, onSelect, ...options });

const sourceRepoStatusTitleFor = (repoLocation: RepoLocation | null, toolStatus: SourceControlStatus["gh"] | undefined) =>
  repoLocation ? `${sourceRepoStatusLabel(repoLocation)} · ${toolStatus ? formatCliToolStatus(toolStatus) : "Checking authentication"}` : "";

const drawerTitleFor = (mode: SideDrawerMode) => mode === "projects"
  ? "Project chats"
  : DRAWER_MODES.find((candidate) => candidate.id === mode)?.label ?? DRAWER_MODES[0].label;

const markDirtyFile = (nodes: FileTreeNode[], dirtyPaths: Set<string>): FileTreeNode[] => {
  if (dirtyPaths.size === 0) return nodes;
  return nodes.map((node) => ({
    ...node,
    dirty: dirtyPaths.has(node.path),
    children: node.children ? markDirtyFile(node.children, dirtyPaths) : undefined,
  }));
};

const flattenFiles = (nodes: FileTreeNode[]): FileTreeNode[] =>
  nodes.flatMap((node) => [
    ...(node.kind === "file" ? [node] : []),
    ...(node.children ? flattenFiles(node.children) : []),
  ]);

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
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [fileTreeError, setFileTreeError] = useState<string | null>(null);
  const [fileOpError, setFileOpError] = useState<string | null>(null);
  const [fileTreeLoading, setFileTreeLoading] = useState(false);
  const [fileTreeTruncated, setFileTreeTruncated] = useState(false);
  const [treeRefreshNonce, setTreeRefreshNonce] = useState(0);
  const [railHeight, setRailHeight] = useState(240);
  const [selectedFile, setSelectedFile] = useState<FileTreeNode | null>(null);
  const [editorTabs, setEditorTabs] = useState<FileTreeNode[]>([]);
  const [editorBufferRevision, setEditorBufferRevision] = useState(0);
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
  const [browserUrl, setBrowserUrl] = useState(DEFAULT_BROWSER_PREVIEW_URL);
  const [browserAddress, setBrowserAddress] = useState(DEFAULT_BROWSER_PREVIEW_URL);
  const [browserHistory, setBrowserHistory] = useState([DEFAULT_BROWSER_PREVIEW_URL]);
  const [browserHistoryIndex, setBrowserHistoryIndex] = useState(0);
  const [browserReloadNonce, setBrowserReloadNonce] = useState(0);
  const [browserError, setBrowserError] = useState<string | null>(null);
  const [detectedLocalDevServer, setDetectedLocalDevServer] = useState<DetectedLocalDevServer | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null);
  const [draftDialogError, setDraftDialogError] = useState<string | null>(null);
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
  const [connectionSecretPresence, setConnectionSecretPresence] = useState<Record<string, boolean>>({});
  const [mcpOAuthStatuses, setMcpOAuthStatuses] = useState<Record<string, McpOAuthStatus>>({});
  const [worktrees, setWorktrees] = useState<WorktreeRecord[]>([]);
  const [backgroundExits, setBackgroundExits] = useState<BackgroundExit[]>([]);
  const [paneTranscripts, setPaneTranscripts] = useState<PaneTranscript[]>([]);
  const [transcriptsOpen, setTranscriptsOpen] = useState(false);
  const [openTranscriptId, setOpenTranscriptId] = useState<string | null>(null);
  const [keybindingOverrides, setKeybindingOverrides] = useState<KeybindingOverrides>({});
  const [composerDraft, setComposerDraft] = useState("");
  const [composerSending, setComposerSending] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [composerHistory, setComposerHistory] = useState<string[]>([]);
  const [composerHistoryIndex, setComposerHistoryIndex] = useState<number | null>(null);
  const composerLocalStateRef = useRef<{ key: string | null; draft: string; history: string[] }>({
    key: null,
    draft: "",
    history: [],
  });
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
  const [drawerSearchQuery, setDrawerSearchQuery] = useState("");
  const [chatSearchResults, setChatSearchResults] = useState<ChatSearchResult[]>([]);
  const [chatSearchLoading, setChatSearchLoading] = useState(false);
  const [chatSearchError, setChatSearchError] = useState<string | null>(null);
  const [chatSearchRevision, setChatSearchRevision] = useState(0);
  const [focusedChatMessageId, setFocusedChatMessageId] = useState<string | null>(null);
  const [gitStatus, setGitStatus] = useState<GitStatusResponse | null>(null);
  const [gitStatusRoot, setGitStatusRoot] = useState<string | null>(null);
  const [gitStatusLoading, setGitStatusLoading] = useState(false);
  const [gitStatusError, setGitStatusError] = useState<string | null>(null);
  const [diffReview, setDiffReview] = useState<ActiveDiffReview | null>(null);
  const [diffReviewLoading, setDiffReviewLoading] = useState(false);
  const [diffReviewError, setDiffReviewError] = useState<string | null>(null);
  const editorDirty = selectedFile != null && editorText !== savedEditorText;
  const dirtyTabPaths = useMemo(
    () => dirtyEditorTabPaths(editorTabs, editorBuffersRef.current, selectedFile?.path ?? null, editorDirty),
    [editorBufferRevision, editorDirty, editorTabs, selectedFile],
  );
  const dirtyTabPathSet = useMemo(() => new Set(dirtyTabPaths), [dirtyTabPaths]);
  const editorSaveConflict = editorError?.startsWith("File changed on disk since it was opened") ?? false;
  const activeFileMissing = useMemo(
    () => selectedFile != null && fileTree.length > 0 && !fileTreeContainsPath(fileTree, selectedFile.path),
    [fileTree, selectedFile],
  );
  const editorBreadcrumbs = useMemo(
    () => (selectedFile ? pathBreadcrumbs(workspacePath, selectedFile.path) : []),
    [selectedFile, workspacePath],
  );
  const editorLanguage = selectedFile ? languageLabelForPath(selectedFile.path) : "No file";
  const diffBreadcrumbs = useMemo(
    () => (diffReview ? pathBreadcrumbs(workspacePath, diffReview.absolutePath) : []),
    [diffReview, workspacePath],
  );
  const diffReviewCanOpenFile = Boolean(diffReview && diffReview.file.index !== "D" && diffReview.file.worktree !== "D");
  const diffReviewCanStage = Boolean(diffReview && (diffReview.file.index === "?" || diffReview.file.worktree !== " "));
  const diffReviewCanUnstage = Boolean(diffReview && diffReview.file.index !== " " && diffReview.file.index !== "?");
  const diffReviewCanDiscard = Boolean(diffReview && (diffReview.file.index === "?" || diffReview.file.worktree !== " "));
  const visibleFileTree = useMemo(
    () => {
      const dirtyTree = markDirtyFile(fileTree, dirtyTabPathSet);
      const files = workspacePath && gitStatusRoot === workspacePath && gitStatus?.isRepository ? gitStatus.files : [];
      return decorateFileTreeWithGitStatus(workspacePath, dirtyTree, files);
    },
    [dirtyTabPathSet, fileTree, gitStatus, gitStatusRoot, workspacePath],
  );
  const searchableFiles = useMemo(() => flattenFiles(visibleFileTree), [visibleFileTree]);
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
  const composerMentionQuery = composerDraft.match(/(?:^|\s)@([^\s@]*)$/)?.[1] ?? null;
  const composerMentionResults = useMemo(
    () => composerMentionQuery == null ? [] : filterWorkspaceFiles(searchableFiles, composerMentionQuery, 8),
    [composerMentionQuery, searchableFiles],
  );
  const activeSessionId = useMemo(
    () => activeProjectSessionId(activeSessionByProject, projectSessions, workspacePath),
    [activeSessionByProject, projectSessions, workspacePath],
  );
  const activeComposerHarnessKey = useMemo(
    () => (workspacePath && activeSessionId ? `${workspacePath}\n${activeSessionId}` : null),
    [activeSessionId, workspacePath],
  );
  const activeAgentProfileSetting = useMemo(
    () => scopedSettingView(scopedSettings, "agentProfileId", workspacePath, activeSessionId),
    [activeSessionId, scopedSettings, workspacePath],
  );
  const activeApprovalSetting = useMemo(
    () => scopedSettingView(scopedSettings, "approvalMode", workspacePath, activeSessionId),
    [activeSessionId, scopedSettings, workspacePath],
  );
  const activeBrowserSetting = useMemo(
    () => scopedSettingView(scopedSettings, "browserUrl", workspacePath, activeSessionId),
    [activeSessionId, scopedSettings, workspacePath],
  );
  const activeComposerHarness = useMemo<ComposerHarnessState>(
    () => {
      const stored = activeComposerHarnessKey
        ? composerHarnessBySession[activeComposerHarnessKey] ?? defaultComposerHarnessState(activeAgentProfileSetting.chat?.value ?? launchProfile.id)
        : defaultComposerHarnessState(activeAgentProfileSetting.global.value);
      return {
        ...stored,
        approvalMode: activeApprovalSetting.chat?.value ?? activeApprovalSetting.global.value,
        selectedProfileId: activeAgentProfileSetting.chat?.value ?? activeAgentProfileSetting.global.value,
      };
    },
    [activeAgentProfileSetting, activeApprovalSetting, activeComposerHarnessKey, composerHarnessBySession, launchProfile.id],
  );
  const activeChatConversation = useMemo<ChatConversation>(
    () => activeComposerHarnessKey
      ? chatConversations[activeComposerHarnessKey] ?? emptyChatConversation(0)
      : emptyChatConversation(0),
    [activeComposerHarnessKey, chatConversations],
  );
  const activeComposerProfile = resolveLaunchProfile(activeComposerHarness.selectedProfileId);
  const activeComposerProvider = structuredChatProviderId(activeComposerHarness.selectedProfileId);
  const activeComposerProviderLabel = activeComposerProvider
    ? chatProviderLabel(activeComposerProvider)
    : activeComposerProfile.label;
  const activeTerminalPane = useMemo(
    () => terminalPanes.find((pane) => pane.id === activeTerminalPaneId) ?? null,
    [activeTerminalPaneId, terminalPanes],
  );
  const terminalFind = useTerminalFind(activeTerminalPane != null);
  const agentApprovalMode: AgentApprovalMode = activeComposerHarness.approvalMode;
  const agentSessionDescriptors = useMemo<AgentSessionHandleDescriptor[]>(() => {
    if (!workspacePath || !activeSessionId) return [];
    return terminalPanes.map((pane, index) =>
      buildAgentSessionHandleDescriptor({
        pane,
        projectId: workspacePath,
        projectSessionId: activeSessionId,
        label: terminalPaneLabelForDisplay(pane.label, pane.profile.label, index),
        approvalMode: agentApprovalMode,
      }),
    );
  }, [activeSessionId, agentApprovalMode, terminalPanes, workspacePath]);
  const activeAgentSessionDescriptor = useMemo(
    () => agentSessionDescriptors.find((handle) => handle.paneId === activeTerminalPaneId) ?? null,
    [activeTerminalPaneId, agentSessionDescriptors],
  );
  useEffect(() => {
    activeAgentSessionDescriptorRef.current = activeAgentSessionDescriptor;
  }, [activeAgentSessionDescriptor]);
  const selectedAgentActivityLog = useMemo(() => {
    if (!workspacePath || !activeSessionId) return [];
    const paneIds = new Set([
      `chat:${activeSessionId}`,
      ...(activeAgentSessionDescriptor ? [activeAgentSessionDescriptor.id] : []),
    ]);
    return filterAgentActivityEvents(
      agentActivityEvents.filter(
        (event) =>
          event.projectId === workspacePath &&
          event.projectSessionId === activeSessionId &&
          paneIds.has(event.paneId),
      ),
      agentActivityFilter,
    );
  }, [activeAgentSessionDescriptor, activeSessionId, agentActivityEvents, agentActivityFilter, workspacePath]);
  const activeTerminalProfile = activeTerminalPane?.profile ?? terminalLaunchProfile;
  const primarySurfaceState: TerminalPaneState = activeChatConversation.activeRunId ? "starting" : "idle";
  const primarySurfaceLabel = "Codex";
  const primarySurfaceStatusLabel = activeChatConversation.activeRunId ? "Working" : "Ready";
  const utilityTrayStatusLabel = utilityTrayMode.charAt(0).toUpperCase() + utilityTrayMode.slice(1);
  const browserCanGoBack = browserHistoryCanGoBack(browserHistoryIndex);
  const browserCanGoForward = browserHistoryCanGoForward(browserHistory, browserHistoryIndex);
  const activeDetectedLocalDevServer =
    detectedLocalDevServer &&
    detectedLocalDevServer.projectId === workspacePath &&
    detectedLocalDevServer.projectSessionId === activeSessionId
      ? detectedLocalDevServer
      : null;

  const refreshFileTree = () => setTreeRefreshNonce((value) => value + 1);
  const refreshGitStatus = async () => {
    const root = workspacePathRef.current ?? workspacePath;
    if (!root) {
      setGitStatus(null);
      setGitStatusRoot(null);
      setGitStatusError(null);
      return;
    }
    setGitStatusLoading(true);
    setGitStatusError(null);
    try {
      setGitStatus(await invoke<GitStatusResponse>("git_status", { root }));
      setGitStatusRoot(root);
    } catch (err) {
      setGitStatusError(String(err));
      setGitStatus(null);
      setGitStatusRoot(root);
    } finally {
      setGitStatusLoading(false);
    }
  };

  useEffect(() => {
    if (!commandPalette.open) return;
    const query = commandPalette.query.trim();
    if (query.length < 2) {
      setChatSearchResults([]);
      setChatSearchError(null);
      setChatSearchLoading(false);
      return;
    }
    let cancelled = false;
    setChatSearchLoading(true);
    setChatSearchError(null);
    const timer = window.setTimeout(() => {
      searchDurableChatMessages(query, false, 80)
        .then((results) => {
          if (!cancelled) setChatSearchResults(results);
        })
        .catch((error) => {
          if (!cancelled) {
            setChatSearchResults([]);
            setChatSearchError(String(error));
          }
        })
        .finally(() => {
          if (!cancelled) setChatSearchLoading(false);
        });
    }, 140);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [chatSearchRevision, commandPalette.open, commandPalette.query]);

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

  const loadGitDiff = async (file: GitStatusFile, options: { gate?: boolean } = {}) => {
    const root = workspacePathRef.current ?? workspacePath;
    if (!root) return false;
    if (options.gate ?? true) {
      const audit = await gateAppAction(createAppAction({
        kind: "open-diff",
        label: "Open diff",
        target: file.path,
        risk: "low",
        requestedBy: "user",
      }));
      if (audit.decision !== "approved") return false;
    }
    setDiffReviewLoading(true);
    setDiffReviewError(null);
    setDiffReview(null);
    try {
      const response = await invoke<GitDiffResponse>("git_file_diff", { root, path: file.path });
      setDiffReview({
        file,
        response,
        absolutePath: absolutePathForGitFile(root, file.path),
        parsed: parseUnifiedDiff(response.diff),
      });
      return true;
    } catch (err) {
      setDiffReviewError(String(err));
      return false;
    } finally {
      setDiffReviewLoading(false);
    }
  };

  const openGitDiff = (file: GitStatusFile) => loadGitDiff(file, { gate: true });

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

  const gitActionLabel = (action: GitFileAction) => {
    if (action === "stage") return "Stage file";
    if (action === "unstage") return "Unstage file";
    return "Discard unstaged changes";
  };

  const gitActionKind = (action: GitFileAction) => {
    if (action === "stage") return "stage-file" as const;
    if (action === "unstage") return "unstage-file" as const;
    return "discard-file" as const;
  };

  const editorHasUnsavedBufferForPath = (path: string) => {
    if (selectedFileRef.current?.path === path && editorText !== savedEditorText) return true;
    const buffered = editorBuffersRef.current[path];
    return Boolean(buffered && buffered.text !== buffered.savedText);
  };

  const runGitFileAction = async (action: GitFileAction, file: GitStatusFile) => {
    const root = workspacePathRef.current ?? workspacePath;
    if (!root) return false;
    const absolutePath = absolutePathForGitFile(root, file.path);
    if (action === "discard" && editorHasUnsavedBufferForPath(absolutePath)) {
      setDiffReviewError("Save or close the unsaved editor draft before discarding Git changes.");
      return false;
    }
    const audit = await gateAppAction(createAppAction({
      kind: gitActionKind(action),
      label: gitActionLabel(action),
      target: file.path,
      risk: action === "discard" ? "destructive" : "medium",
      requestedBy: "user",
      undoHint: action === "discard" ? "Use Git history or editor undo if available." : "Use the opposite Git action.",
    }));
    if (audit.decision !== "approved") return false;
    setDiffReviewLoading(true);
    setDiffReviewError(null);
    try {
      const nextStatus = await invoke<GitStatusResponse>("git_file_action", { root, path: file.path, action });
      setGitStatus(nextStatus);
      setGitStatusRoot(root);
      refreshFileTree();
      const nextFile = nextStatus.files.find((item) => item.path === file.path);
      if (nextFile) {
        await loadGitDiff(nextFile, { gate: false });
      } else {
        closeDiffReview();
      }
      return true;
    } catch (err) {
      setDiffReviewError(String(err));
      return false;
    } finally {
      setDiffReviewLoading(false);
    }
  };

  const copyShownDiff = async () => {
    if (!diffReview) return false;
    const audit = await gateAppAction(createAppAction({
      kind: "copy-diff",
      label: "Copy shown diff",
      target: diffReview.response.path,
      risk: "low",
      requestedBy: "user",
    }));
    if (audit.decision !== "approved") return false;
    await writeText(diffReview.response.diff);
    return true;
  };

  const openDiffFile = async (line: number | null = null) => {
    if (!diffReview) return;
    const opened = await requestOpenEditorFile(fileNodeFromPath(diffReview.absolutePath, "file"), { focusEditor: true });
    if (opened && line != null) focusEditorLine(line);
  };

  const closeDiffReview = () => {
    setDiffReview(null);
    setDiffReviewError(null);
  };

  useEffect(() => {
    recentProjectsRef.current = recentProjects;
  }, [recentProjects]);

  useEffect(() => {
    openProjectsRef.current = openProjects;
  }, [openProjects]);

  useEffect(() => {
    projectSessionsRef.current = projectSessions;
  }, [projectSessions]);

  useEffect(() => {
    activeSessionByProjectRef.current = activeSessionByProject;
  }, [activeSessionByProject]);

  useEffect(() => {
    paneLabelsBySessionRef.current = paneLabelsBySession;
  }, [paneLabelsBySession]);

  useEffect(() => {
    if (sideDrawerMode === "files" || sideDrawerMode === "git") {
      void refreshGitStatus();
    }
  }, [sideDrawerMode, workspacePath, treeRefreshNonce]);

  useEffect(() => {
    browserPreviewByProjectRef.current = browserPreviewByProject;
  }, [browserPreviewByProject]);

  useEffect(() => {
    browserPreviewBySessionRef.current = browserPreviewBySession;
  }, [browserPreviewBySession]);

  useEffect(() => {
    composerHarnessBySessionRef.current = composerHarnessBySession;
  }, [composerHarnessBySession]);

  useEffect(() => {
    scopedSettingsRef.current = scopedSettings;
  }, [scopedSettings]);

  useEffect(() => {
    browserUrlRef.current = browserUrl;
  }, [browserUrl]);

  useEffect(() => {
    terminalPanesRef.current = terminalPanes;
  }, [terminalPanes]);

  useEffect(() => {
    activeTerminalPaneIdRef.current = activeTerminalPaneId;
  }, [activeTerminalPaneId]);

  useEffect(() => {
    selectedFileRef.current = selectedFile;
  }, [selectedFile]);

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
    let disposed = false;
    let removeListener: (() => void) | null = null;
    void listen<McpOAuthStatus>("mcp-oauth-result", (event) => {
      setMcpOAuthStatuses((current) => ({ ...current, [event.payload.serverId]: event.payload }));
      if (event.payload.state === "connected" || event.payload.state === "idle") {
        setConnectionSecretPresence((current) => ({
          ...current,
          [mcpOauthTokenKey(event.payload.serverId)]: event.payload.state === "connected",
        }));
      }
    }).then((remove) => {
      if (disposed) remove();
      else removeListener = remove;
    });
    return () => {
      disposed = true;
      removeListener?.();
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

  const persistActiveFile = async (workspace: string, filePath: string) => {
    const store = storeRef.current;
    const next = rememberActiveFile(activeFilesByWorkspaceRef.current, workspace, filePath);
    activeFilesByWorkspaceRef.current = next;
    await store?.set("activeFileByWorkspace", next);
    await store?.save();
  };

  const clearPersistedActiveFile = async (workspace: string) => {
    const store = storeRef.current;
    const next = forgetActiveFile(activeFilesByWorkspaceRef.current, workspace);
    activeFilesByWorkspaceRef.current = next;
    await store?.set("activeFileByWorkspace", next);
    await store?.save();
  };

  const persistOpenProjects = async (projects: OpenProject[]) => {
    openProjectsRef.current = projects;
    setOpenProjects(projects);
    await storeRef.current?.set("openProjects", projects);
    await storeRef.current?.save();
  };

  const persistProjectSessions = async (sessions: ProjectSessionsByProject, activeByProject: ActiveSessionByProject) => {
    projectSessionsRef.current = sessions;
    activeSessionByProjectRef.current = activeByProject;
    setProjectSessions(sessions);
    setActiveSessionByProjectState(activeByProject);
    await storeRef.current?.set("projectSessions", sessions);
    await storeRef.current?.set("activeSessionByProject", activeByProject);
    await storeRef.current?.save();
  };

  const sessionSnapshotKey = (root: string, sessionId: string) => `${root}\n${sessionId}`;

  const paneLabelSessionKey = (root: string | null, sessionId = activeProjectSessionId(activeSessionByProjectRef.current, projectSessionsRef.current, root)) =>
    root && sessionId ? sessionSnapshotKey(root, sessionId) : null;

  const savedPaneLabelForSlot = (root: string | null, slot: number, sessionId?: string | null) => {
    const key = paneLabelSessionKey(root, sessionId);
    if (!key) return null;
    return paneLabelsBySessionRef.current[key]?.find((record) => record.slot === slot)?.label ?? null;
  };

  const persistSessionEditorSnapshots = (next: Record<string, ProjectEditorSnapshot>) => {
    sessionEditorSnapshotsRef.current = next;
    void storeRef.current?.set("sessionEditorSnapshots", next);
    void storeRef.current?.save();
  };

  const persistPaneLayoutsBySession = (next: PaneLayoutsBySession) => {
    paneLayoutsBySessionRef.current = next;
    void storeRef.current?.set("paneLayoutsBySession", next);
    void storeRef.current?.save();
  };

  const persistPaneLayoutForSession = (
    root: string | null,
    sessionId: string | null,
    panes: ManagedTerminalPane[] = terminalPanesForSession(root, sessionId),
  ) => {
    if (!root || !sessionId) return;
    const key = sessionSnapshotKey(root, sessionId);
    const records = paneLayoutFromPanes(panes);
    const next = { ...paneLayoutsBySessionRef.current };
    if (records.length > 0) next[key] = records;
    else delete next[key];
    persistPaneLayoutsBySession(next);
  };

  const removePersistedSessionRestore = (root: string, sessionId: string) => {
    const key = sessionSnapshotKey(root, sessionId);
    const nextSnapshots = { ...sessionEditorSnapshotsRef.current };
    const nextPaneLayouts = { ...paneLayoutsBySessionRef.current };
    delete nextSnapshots[key];
    delete nextPaneLayouts[key];
    persistSessionEditorSnapshots(nextSnapshots);
    persistPaneLayoutsBySession(nextPaneLayouts);
  };

  const persistPaneLabel = async (root: string, slot: number, label: string | null) => {
    const key = paneLabelSessionKey(root);
    if (!key) return;
    const existing = paneLabelsBySessionRef.current[key] ?? [];
    const normalized = normalizeTerminalPaneLabel(label);
    const nextRecords = normalized
      ? [
          ...existing.filter((record) => record.slot !== slot),
          { slot, label: normalized, updatedAt: Date.now() },
        ].sort((a, b) => a.slot - b.slot)
      : existing.filter((record) => record.slot !== slot);
    const next = { ...paneLabelsBySessionRef.current };
    if (nextRecords.length > 0) next[key] = nextRecords;
    else delete next[key];
    paneLabelsBySessionRef.current = next;
    setPaneLabelsBySession(next);
    await storeRef.current?.set("paneLabelsBySession", next);
    await storeRef.current?.save();
  };

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
    setChatSearchRevision((revision) => revision + 1);
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

  useEffect(() => {
    let disposed = false;
    let removeListener: (() => void) | null = null;
    void listen<ChatRunEnvelope>("chat-run-event", (event) => {
      updateChatConversation(event.payload.chatId, (conversation) =>
        applyChatRunEnvelope(conversation, event.payload)
      );
    }).then((remove) => {
      if (disposed) remove();
      else removeListener = remove;
    });
    return () => {
      disposed = true;
      removeListener?.();
    };
  }, []);

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

  const setComposerLocalState = (key: string | null, draft: string, history: string[]) => {
    composerLocalStateRef.current = { key, draft, history };
    setComposerDraft(draft);
    setComposerHistory(history);
  };

  const flushActiveComposerLocalState = async () => {
    const local = composerLocalStateRef.current;
    if (!local.key) return;
    const previous = composerHarnessBySessionRef.current[local.key] ?? defaultComposerHarnessState(launchProfileRef.current.id);
    if (previous.draft === local.draft && previous.history === local.history) return;
    await persistComposerHarnessRecords({
      ...composerHarnessBySessionRef.current,
      [local.key]: { ...previous, draft: local.draft, history: local.history },
    });
  };

  useLayoutEffect(() => {
    composerLocalStateRef.current = {
      key: activeComposerHarnessKey,
      draft: activeComposerHarness.draft,
      history: activeComposerHarness.history,
    };
    setComposerDraft(activeComposerHarness.draft);
    setComposerHistory(activeComposerHarness.history);
    setComposerHistoryIndex(null);
  }, [activeComposerHarness.draft, activeComposerHarness.history, activeComposerHarnessKey]);

  useEffect(() => {
    const key = activeComposerHarnessKey;
    const local = composerLocalStateRef.current;
    if (!key || local.key !== key || local.draft !== composerDraft || local.history !== composerHistory) return;
    const timer = window.setTimeout(() => {
      const current = composerLocalStateRef.current;
      if (current.key !== key || current.draft !== composerDraft || current.history !== composerHistory) return;
      const previous = composerHarnessBySessionRef.current[key] ?? defaultComposerHarnessState(launchProfileRef.current.id);
      if (previous.draft === composerDraft && previous.history === composerHistory) return;
      void persistComposerHarnessRecords({
        ...composerHarnessBySessionRef.current,
        [key]: { ...previous, draft: composerDraft, history: composerHistory },
      });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [activeComposerHarnessKey, composerDraft, composerHistory]);

  const updateActiveComposerHarness = async (updater: (state: ComposerHarnessState) => ComposerHarnessState) => {
    const key = activeComposerHarnessKey;
    if (!key) return null;
    const stored = composerHarnessBySessionRef.current[key] ?? defaultComposerHarnessState(launchProfileRef.current.id);
    const local = composerLocalStateRef.current;
    const previous = local.key === key ? { ...stored, draft: local.draft, history: local.history } : stored;
    const nextState = updater(previous);
    const next = { ...composerHarnessBySessionRef.current, [key]: nextState };
    await persistComposerHarnessRecords(next);
    return nextState;
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

  const setBrowserLocation = (url: string, options: { pushHistory?: boolean } = {}) => {
    browserUrlRef.current = url;
    setBrowserUrl(url);
    setBrowserAddress(url);
    setBrowserError(null);
    if (options.pushHistory ?? true) {
      const next = pushBrowserHistory(browserHistory, browserHistoryIndex, url);
      setBrowserHistory(next.history);
      setBrowserHistoryIndex(next.index);
    }
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
    browserUrlRef.current = nextUrl;
    setBrowserUrl(nextUrl);
    setBrowserAddress(nextUrl);
    setBrowserHistory([nextUrl]);
    setBrowserHistoryIndex(0);
    setBrowserError(null);
    setBrowserReloadNonce((value) => value + 1);
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

  const goBrowserHistory = (direction: -1 | 1) => {
    const nextIndex = browserHistoryIndex + direction;
    const nextUrl = browserHistory[nextIndex];
    if (!nextUrl) return;
    setBrowserHistoryIndex(nextIndex);
    setBrowserLocation(nextUrl, { pushHistory: false });
  };

  const reloadBrowserPreview = () => setBrowserReloadNonce((value) => value + 1);

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

  const setManagedTerminalPanes = (panes: ManagedTerminalPane[]) => {
    terminalPanesRef.current = panes;
    setTerminalPanes(panes);
  };

  const setFocusedTerminalPane = (paneId: number | null) => {
    activeTerminalPaneIdRef.current = paneId;
    setActiveTerminalPaneId(paneId);
  };

  const activeSessionForProject = (root: string | null) =>
    activeProjectSessionId(activeSessionByProjectRef.current, projectSessionsRef.current, root);

  const terminalPanesForSession = (
    root: string | null,
    sessionId: string | null = activeSessionForProject(root),
  ) => {
    const key = paneContextKey(root, sessionId);
    return key ? terminalPanesByContextRef.current[key] ?? [] : [];
  };

  const terminalPanesForProject = (root: string | null) => {
    if (!root) return [];
    return Object.entries(terminalPanesByContextRef.current)
      .filter(([key]) => paneContextBelongsToProject(key, root))
      .flatMap(([, panes]) => panes);
  };

  const paneContextForPaneId = (paneId: number) => {
    const entry = Object.entries(terminalPanesByContextRef.current).find(([, panes]) =>
      panes.some((pane) => pane.id === paneId)
    );
    if (!entry) return null;
    const parts = paneContextParts(entry[0]);
    return parts ? { key: entry[0], panes: entry[1], ...parts } : null;
  };

  const activePaneForSession = (
    root: string | null,
    sessionId: string | null = activeSessionForProject(root),
    panes: ManagedTerminalPane[] = terminalPanesForSession(root, sessionId),
  ) => {
    const key = paneContextKey(root, sessionId);
    if (!key) return null;
    const saved = activeTerminalPaneByContextRef.current[key];
    return panes.some((pane) => pane.id === saved) ? saved : panes[0]?.id ?? null;
  };

  const setSessionTerminalPanes = (
    root: string,
    sessionId: string,
    panes: ManagedTerminalPane[],
    activePaneId: number | null = activePaneForSession(root, sessionId, panes),
  ) => {
    const key = paneContextKey(root, sessionId);
    if (!key) return;
    terminalPanesByContextRef.current = { ...terminalPanesByContextRef.current, [key]: panes };
    if (activePaneId == null) {
      const { [key]: _removedActive, ...nextActive } = activeTerminalPaneByContextRef.current;
      activeTerminalPaneByContextRef.current = nextActive;
    } else {
      activeTerminalPaneByContextRef.current = { ...activeTerminalPaneByContextRef.current, [key]: activePaneId };
    }
    if (workspacePathRef.current === root && activeSessionForProject(root) === sessionId) {
      setManagedTerminalPanes(panes);
      setFocusedTerminalPane(activePaneId);
    }
    persistPaneLayoutForSession(root, sessionId, panes);
  };

  const terminalPaneProjectStatus = (panes: ManagedTerminalPane[] = terminalPanesRef.current): ProjectRailStatus => {
    return projectStatusFromTerminalPanes(panes);
  };

  const projectStatusForRoot = (root: string | null): ProjectRailStatus =>
    terminalPaneProjectStatus(terminalPanesForProject(root));

  const activeSessionStatus = (): ProjectRailStatus => terminalPaneProjectStatus(terminalPanesRef.current);

  const activeProjectStatus = (): ProjectRailStatus => {
    return projectStatusForRoot(workspacePathRef.current);
  };

  const setPaneState = (paneId: number, state: TerminalPaneState, exitCode: number | null = null) => {
    const context = paneContextForPaneId(paneId);
    const currentPanes = context?.panes ?? terminalPanesRef.current;
    const next = currentPanes.map((pane) =>
      pane.id === paneId ? { ...pane, state, exitCode } : pane,
    );
    if (context) setSessionTerminalPanes(
      context.projectRoot,
      context.sessionId,
      next,
      activePaneForSession(context.projectRoot, context.sessionId, next),
    );
    else setManagedTerminalPanes(next);
    return next;
  };

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

  useEffect(() => {
    launchProfileRef.current = launchProfile;
  }, [launchProfile]);

  useEffect(() => {
    terminalLaunchProfileRef.current = terminalLaunchProfile;
  }, [terminalLaunchProfile]);

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
      const { activeSessions: preparedActiveSessions, fallbackLayout,
        layout: initialLayout, sessionId: requestedSessionId, sessions: preparedSessions } = prepareWorkspaceOpenSession({
        activeSessions: activeSessionByProjectRef.current, sessions: projectSessionsRef.current,
        paneLayouts: paneLayoutsBySessionRef.current, path, now: Date.now(),
        defaultProfileId: defaultTerminalLaunchProfile().id, savedLabel: savedPaneLabelForSlot(path, 0),
      });
      projectSessionsRef.current = preparedSessions;
      activeSessionByProjectRef.current = preparedActiveSessions;
      const existingPanes = terminalPanesForSession(path, requestedSessionId);
      let root = path;
      let nextProjectPanes = existingPanes;
      let nextActivePaneId = activePaneForSession(path, requestedSessionId, existingPanes);
      if (existingPanes.length > 0 && nextActivePaneId != null) {
        await invoke("focus_pane", { paneId: nextActivePaneId });
      } else if (agentSurfaceMode === "terminal") {
        const opened = await openWorkspaceTerminalPanes({
          createPane: (target, paneProfile) => invoke<OpenPaneResponse>("create_pane", {
            path: target, profile: paneProfile, environment: connectionEnvironmentInputs(aiConnectionSettingsRef.current, target),
          }),
          fallbackLayout, initialLayout, now: Date.now,
          openWorkspace: (target, firstProfile) => invoke<OpenWorkspaceResponse>("open_workspace", {
            path: target, profile: firstProfile, environment: connectionEnvironmentInputs(aiConnectionSettingsRef.current, target),
          }),
          paneLayouts: paneLayoutsBySessionRef.current, path, requestedSessionId, resolveProfile: resolveLaunchProfile,
          savedLabelForSlot: (target, slot) => savedPaneLabelForSlot(target, slot, requestedSessionId),
        });
        root = opened.root;
        nextProjectPanes = opened.panes;
        nextActivePaneId = opened.activePaneId;
      } else {
        const result = await invoke<ResolveWorkspaceResponse>("resolve_workspace", { path });
        root = result.root;
        nextProjectPanes = [];
        nextActivePaneId = null;
      }
      const contextKey = paneContextKey(root, requestedSessionId);
      if (!contextKey || !requestedSessionId) throw new Error("Workspace session context is unavailable");
      terminalPanesByContextRef.current = { ...terminalPanesByContextRef.current, [contextKey]: nextProjectPanes };
      if (nextActivePaneId != null) activeTerminalPaneByContextRef.current = { ...activeTerminalPaneByContextRef.current, [contextKey]: nextActivePaneId };
      setManagedTerminalPanes(nextProjectPanes);
      setFocusedTerminalPane(nextActivePaneId);
      const cached = nextActivePaneId == null ? null : terminalSnapshotsRef.current[nextActivePaneId];
      latest.current = cached ?? null;
      requestTerminalPaintRef.current();
      setLaunchError(null);
      restoredActiveFileWorkspaceRef.current = null;
      workspacePathRef.current = root;
      setWorkspacePath(root);
      resetEditor();
      setTimeout(sendTerminalResize, 0);
      const now = Date.now();
      const previousStatus = previousRoot ? projectStatusForRoot(previousRoot) : "exited";
      const { activeSessions: nextActiveSessions, openProjects: nextOpen, recentProjects: nextRecent,
        sessionId, sessions: nextSessions } = planWorkspaceOpenSuccess({
        activeSessions: activeSessionByProjectRef.current, sessions: projectSessionsRef.current,
        openProjects: openProjectsRef.current, recentProjects: recentProjectsRef.current,
        previousRoot, previousStatus, root, now,
        projectStatus: projectStatusForRoot(root), sessionStatus: terminalPaneProjectStatus(nextProjectPanes),
      });
      persistPaneLayoutForSession(root, sessionId, nextProjectPanes);
      recentProjectsRef.current = nextRecent;
      openProjectsRef.current = nextOpen;
      projectSessionsRef.current = nextSessions;
      activeSessionByProjectRef.current = nextActiveSessions;
      setRecentProjects(nextRecent);
      setOpenProjects(nextOpen);
      setProjectSessions(nextSessions);
      setActiveSessionByProjectState(nextActiveSessions);
      await persistWorkspaceOpenSuccess({
        activeSessions: nextActiveSessions, launchProfile: profile, openProjects: nextOpen,
        recentProjects: nextRecent, root, sessions: nextSessions, store,
      });
      restoreSessionEditorSnapshot(root, sessionId);
      restoreBrowserPreview(root, sessionId);
      return true;
    } catch (err) {
      const message = String(err);
      setLaunchError(message);
      void invoke("log_health_event", { message: `open_workspace failed: ${message}` }).catch(() => {});
      setManagedTerminalPanes(previousPanes);
      setFocusedTerminalPane(previousActivePaneId);
      if (isMissingWorkspaceError(message)) {
        const cleanup = planMissingWorkspaceCleanup({
          path,
          recentProjects: recentProjectsRef.current,
          openProjects: openProjectsRef.current,
          sessions: projectSessionsRef.current,
          activeSessions: activeSessionByProjectRef.current,
          projectPanes: terminalPanesByContextRef.current,
          activePanes: activeTerminalPaneByContextRef.current,
          browserProjects: browserPreviewByProjectRef.current,
          browserSessions: browserPreviewBySessionRef.current,
          harnessRecords: composerHarnessBySessionRef.current,
          conversations: chatConversationsRef.current,
          editorSnapshots: sessionEditorSnapshotsRef.current,
          paneLayouts: paneLayoutsBySessionRef.current,
        });
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
        await persistMissingWorkspaceCleanup({
          beforeDeleteFolder: () => {
            if (workspacePathRef.current !== path) return;
            setManagedTerminalPanes([]);
            setFocusedTerminalPane(null);
            setWorkspacePath(null);
            setFileTree([]);
            resetEditor();
          },
          cleanup, deleteProjectChats: deleteDurableProjectChats, path, store,
          onDeleteError: (error) => {
            void invoke("log_health_event", { message: `delete project chats failed: ${String(error)}` }).catch(() => {});
          },
        });
      } else {
        const { activeSessions: nextActiveSessions, openProjects: nextOpen,
          sessions: nextSessions } = planWorkspaceOpenFailure({
          activeSessions: activeSessionByProjectRef.current, sessions: projectSessionsRef.current,
          openProjects: openProjectsRef.current, path, now: Date.now(),
        });
        openProjectsRef.current = nextOpen;
        projectSessionsRef.current = nextSessions;
        activeSessionByProjectRef.current = nextActiveSessions;
        setOpenProjects(nextOpen);
        setProjectSessions(nextSessions);
        setActiveSessionByProjectState(nextActiveSessions);
        await persistWorkspaceOpenFailure({
          activeSessions: nextActiveSessions, openProjects: nextOpen, sessions: nextSessions, store,
        });
      }
      return false;
    }
  };

  const requestOpenWorkspace = async (path: string) => {
    setBackgroundExits((exits) => clearBackgroundExitsForProject(exits, path));
    return requestWorkspaceOpen({
      confirmDiscard: (count) => confirmDialog(`Switch workspace and discard ${count} unsaved editor tabs?`),
      deferNavigation: () => {
        setDraftDialogError(null);
        setPendingNavigation({ kind: "workspace", path });
      },
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
    const runCount = Object.entries(chatConversationsRef.current)
      .filter(([key, conversation]) => key.startsWith(`${project.path}\n`) && conversation.activeRunId)
      .length;
    const paneCount = terminalPanesForProject(project.path).filter((pane) => pane.state !== "exited").length;
    if ((runCount > 0 || paneCount > 0) && !await confirmDialog(`Close ${basename(project.path)} and stop ${runCount + paneCount} running task${runCount + paneCount === 1 ? "" : "s"}?`)) {
      return false;
    }
    if (project.path === workspacePathRef.current && dirtyTabPaths.length === 1 && selectedFileRef.current) {
      setDraftDialogError(null);
      setPendingNavigation({ kind: "close-project", projectPath: project.path });
      return false;
    }
    if (project.path === workspacePathRef.current && dirtyTabPaths.length > 1 && !await confirmDialog(`Close ${basename(project.path)} with ${dirtyTabPaths.length} unsaved editor tabs?`)) {
      return false;
    }
    return closeProjectDirect(project.path);
  };

  const switchProjectSession = async (projectPath: string, sessionId: string) => {
    setFocusedChatMessageId(null);
    const currentRoot = workspacePathRef.current;
    const sameProject = currentRoot === projectPath;
    const now = Date.now();
    await flushActiveComposerLocalState();
    captureCurrentSessionSnapshot();
    let nextSessions = projectSessionsRef.current;
    let nextActiveSessions = setActiveProjectSession(activeSessionByProjectRef.current, projectPath, sessionId);
    const previousSessionId = activeProjectSessionId(activeSessionByProjectRef.current, projectSessionsRef.current, projectPath);
    if (sameProject && previousSessionId && previousSessionId !== sessionId) {
      nextSessions = setProjectSessionStatus(nextSessions, projectPath, previousSessionId, activeSessionStatus(), now);
    }
    const targetStatus = terminalPaneProjectStatus(terminalPanesForSession(projectPath, sessionId));
    nextSessions = setProjectSessionStatus(nextSessions, projectPath, sessionId, sameProject ? targetStatus : "exited", now);
    await persistProjectSessions(nextSessions, nextActiveSessions);
    if (sameProject) {
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
    const now = Date.now();
    captureCurrentSessionSnapshot();
    const existing = projectSessionsRef.current[projectPath] ?? [];
    const session = {
      ...newProjectSession(existing, now),
      status: "exited" as ProjectRailStatus,
    };
    const nextSessions = upsertProjectSession(projectSessionsRef.current, projectPath, session);
    const nextActiveSessions = setActiveProjectSession(activeSessionByProjectRef.current, projectPath, session.id);
    await persistProjectSessions(nextSessions, nextActiveSessions);
    await persistBrowserPreviewUrl(projectPath, session.id, sameProject ? browserUrlRef.current : browserPreviewByProjectRef.current[projectPath] ?? DEFAULT_BROWSER_PREVIEW_URL);
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
    if (plan.contextKey) {
      const { [plan.contextKey]: _removedPanes, ...nextPaneContexts } = terminalPanesByContextRef.current;
      const { [plan.contextKey]: _removedActive, ...nextActiveContexts } = activeTerminalPaneByContextRef.current;
      terminalPanesByContextRef.current = nextPaneContexts;
      activeTerminalPaneByContextRef.current = nextActiveContexts;
    }
    const nextBrowserSessions = { ...browserPreviewBySessionRef.current };
    delete nextBrowserSessions[plan.browserSessionKey];
    const nextComposerHarness = { ...composerHarnessBySessionRef.current };
    delete nextComposerHarness[plan.chatSessionKey];
    const nextChatConversations = { ...chatConversationsRef.current };
    delete nextChatConversations[plan.chatSessionKey];
    chatConversationsRef.current = nextChatConversations;
    setChatConversations(nextChatConversations);
    browserPreviewBySessionRef.current = nextBrowserSessions;
    setBrowserPreviewBySession(nextBrowserSessions);
    await storeRef.current?.set("browserPreviewBySession", nextBrowserSessions);
    await persistComposerHarnessRecords(nextComposerHarness);
  };

  const recordRestartedPaneActivity = (
    restarted: ManagedTerminalPane | undefined,
    previousPane: ManagedTerminalPane,
    projectId: string,
    projectSessionId: string,
    label: string,
  ) => {
    if (!restarted) return;
    recordAgentActivity(
      buildAgentSessionHandleDescriptor({
        pane: restarted,
        projectId,
        projectSessionId,
        label,
        approvalMode: agentApprovalMode,
      }),
      {
        kind: "process",
        label: "Restarted process",
        detail: launchProfileCommandLine(previousPane.profile),
        target: previousPane.cwd,
        status: "running",
      },
    );
  };

  const recordCreatedPaneActivity = (pane: ManagedTerminalPane, projectId: string, projectSessionId: string) => {
    recordAgentActivity(
      buildAgentSessionHandleDescriptor({
        pane,
        projectId,
        projectSessionId,
        label: terminalPaneLabelForDisplay(pane.label, pane.profile.label, pane.slot),
        approvalMode: agentApprovalMode,
      }),
      {
        kind: "process",
        label: "Created pane",
        detail: pane.profile.label,
        status: "running",
      },
    );
  };

  const recordCreatedWorktreePaneActivity = (
    pane: ManagedTerminalPane,
    projectId: string,
    projectSessionId: string,
    branch: string,
  ) => {
    recordAgentActivity(
      buildAgentSessionHandleDescriptor({
        pane,
        projectId,
        projectSessionId,
        label: terminalPaneLabelForDisplay(pane.label, pane.profile.label, pane.slot),
        approvalMode: agentApprovalMode,
      }),
      { kind: "process", label: "Created worktree pane", detail: branch, status: "running" },
    );
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
    const ok = await confirmDialog(`Delete chat "${session.title}"? Its messages and saved workspace context will be removed.`);
    if (!ok) return;
    try {
      await closeSessionTerminalPanes(projectPath, session.id);
    } catch (err) {
      setLaunchError(`Could not close this chat's terminal panes: ${String(err)}`);
      return;
    }
    try {
      await deleteDurableChatConversation(composerHarnessSessionKey(projectPath, session.id));
    } catch (err) {
      setLaunchError(`Could not delete this chat's history: ${String(err)}`);
      return;
    }
    removePersistedSessionRestore(projectPath, session.id);
    await removeSessionScopedRecords(plan);
    await persistProjectSessions(plan.nextSessions, plan.nextActiveSessions);
    if (plan.shouldReopenActiveWorkspace) {
      await openWorkspaceDirect(projectPath, launchProfileRef.current, { captureCurrentSession: false });
    }
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
    const audit = await gateAppAction(createAppAction({
      kind: "interrupt-process",
      label: "Interrupt process",
      target: activeAgentSessionHandle.label,
      risk: "high",
      requestedBy: "user",
      undoHint: "Restart or create a pane from the same profile.",
    }), activeAgentSessionHandle);
    if (audit.decision !== "approved") return;
    setComposerError(null);
    await activeAgentSessionHandle.interrupt();
    recordAgentActivity(activeAgentSessionHandle, {
      kind: "process",
      label: "Stop sent",
      detail: activeAgentSessionHandle.label,
      status: "waiting",
    });
  };

  const terminateTerminalPane = async (pane: ManagedTerminalPane | null = activeTerminalPane) => {
    const root = workspacePathRef.current;
    if (!root || !pane) return false;
    const label = terminalPaneLabelForDisplay(pane.label, pane.profile.label, pane.slot);
    const audit = await gateAppAction(createAppAction({
      kind: "terminate-process",
      label: "Terminate process",
      target: label,
      risk: "destructive",
      requestedBy: "user",
      undoHint: "Restart the pane from the same profile.",
    }), activeAgentSessionDescriptor);
    if (audit.decision !== "approved") return false;
    try {
      await invoke("terminate_pane", { paneId: pane.id });
      intentionallyTerminatedPaneIdsRef.current.add(pane.id);
      const nextPanes = setPaneState(pane.id, "exited", null);
      await updateOpenProjectStatus(root, projectStatusForRoot(root));
      await updateActiveSessionStatus(root, terminalPaneProjectStatus(nextPanes));
      recordAgentActivity(activeAgentSessionDescriptor, {
        kind: "process",
        label: "Terminate sent",
        detail: label,
        target: pane.cwd,
        status: "waiting",
      });
      setLaunchError(null);
      return true;
    } catch (err) {
      setLaunchError(String(err));
      await updateOpenProjectStatus(root, "attention");
      await updateActiveSessionStatus(root, "attention");
      return false;
    }
  };

  const restartTerminalPane = async (pane: ManagedTerminalPane | null = activeTerminalPane) => {
    const root = workspacePathRef.current;
    const sessionId = activeSessionForProject(root);
    if (!root || !sessionId || !pane || launchProfileChanging) return false;
    const label = terminalPaneLabelForDisplay(pane.label, pane.profile.label, pane.slot);
    const audit = await gateAppAction(createAppAction({
      kind: "restart-process",
      label: "Restart process",
      target: `${label} · ${launchProfileCommandLine(pane.profile)}`,
      risk: "high",
      requestedBy: "user",
      undoHint: "The previous live process is terminated; pane label and slot are preserved.",
    }), activeAgentSessionDescriptor);
    if (audit.decision !== "approved") return false;
    setLaunchProfileChanging(true);
    try {
      const result = await invoke<OpenPaneResponse>("restart_pane", { path: root, paneId: pane.id, profile: pane.profile, environment: connectionEnvironmentInputs(aiConnectionSettingsRef.current, root) });
      const nextPanes = replaceRestartedPane(terminalPanesForSession(root, sessionId), pane.id, result.paneId, Date.now());
      delete terminalSnapshotsRef.current[pane.id];
      latest.current = null;
      setSessionTerminalPanes(root, sessionId, nextPanes, result.paneId);
      requestTerminalPaintRef.current();
      setLaunchError(null);
      setTimeout(sendTerminalResize, 0);
      await updateOpenProjectStatus(root, projectStatusForRoot(root));
      await updateActiveSessionStatus(root, terminalPaneProjectStatus(nextPanes));
      const restarted = nextPanes.find((item) => item.id === result.paneId);
      recordRestartedPaneActivity(restarted, pane, root, sessionId, label);
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
    const metadata = session.orchestration;
    if (!metadata || metadata.returnedAt) return;
    const childConversation = chatConversationsRef.current[composerHarnessSessionKey(projectPath, session.id)];
    const result = [...(childConversation?.messages ?? [])].reverse().find((message) => message.role === "assistant");
    if (!result) {
      setActionNotice("This child has no assistant result yet");
      return;
    }
    const parentChatId = composerHarnessSessionKey(projectPath, metadata.parentSessionId);
    updateChatConversation(parentChatId, (conversation) => appendToolChatMessage(
      conversation,
      `${session.title} result`,
      result.text,
      `${metadata.dispatchId}:${session.id}:result`,
    ));
    await updateProjectSessionMetadata(projectPath, session.id, {
      orchestration: { ...metadata, returnedAt: Date.now() },
    });
    setActionNotice(`Returned ${session.title} to its parent chat`);
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

  const connectionSecretKeys = (settings: AiConnectionSettings) => [
    ...CONNECTION_PROVIDER_IDS.map(providerSecretKey),
    ...settings.mcpServers.filter((server) => server.authMode === "bearer").map((server) => mcpSecretKey(server.id)),
    ...settings.mcpServers.filter((server) => server.authMode === "oauth").flatMap((server) => [mcpOauthTokenKey(server.id), mcpOauthClientSecretKey(server.id)]),
    ...Object.values(settings.environmentByProject).flat().filter((variable) => variable.secret).map((variable) => environmentSecretKey(variable.id)),
  ];

  const refreshConnectionSecretPresence = async (settings: AiConnectionSettings) => {
    const statuses = await Promise.all(connectionSecretKeys(settings).map(async (key) => {
      try {
        return await invoke<ConnectionSecretStatus>("connection_secret_status", { key });
      } catch {
        return { key, present: false };
      }
    }));
    setConnectionSecretPresence(Object.fromEntries(statuses.map((status) => [status.key, status.present])));
  };

  const saveAiConnectionSettings = async (next: AiConnectionSettings) => {
    aiConnectionSettingsRef.current = next;
    setAiConnectionSettings(next);
    await storeRef.current?.set("aiConnectionSettings", next);
    await storeRef.current?.save();
  };

  const saveConnectionSecret = async (key: string, value: string) => {
    const status = await invoke<ConnectionSecretStatus>("set_connection_secret", { key, value });
    setConnectionSecretPresence((current) => ({ ...current, [status.key]: status.present }));
  };

  const deleteConnectionSecret = async (key: string) => {
    const status = await invoke<ConnectionSecretStatus>("delete_connection_secret", { key });
    setConnectionSecretPresence((current) => ({ ...current, [status.key]: false }));
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

  const addComposerAttachment = async (attachment: ComposerAttachment) => {
    const audit = await gateAppAction(createAppAction({
      kind: "attach-reference",
      label: "Attach reference",
      target: attachment.target,
      risk: "low",
      requestedBy: "user",
      undoHint: "Remove the attachment chip.",
    }));
    if (audit.decision !== "approved") return;
    await updateActiveComposerHarness((state) => ({
      ...state,
      attachments: upsertComposerAttachment(state.attachments, attachment),
    }));
    logComposerHarnessEvent("Attachment added", attachment.label);
  };

  const attachWorkspaceFileToComposer = async (file: Pick<FileTreeNode, "name" | "path"> | null) => {
    if (!file) {
      setComposerError("Open a file before attaching the current file.");
      return;
    }
    try {
      await invoke("read_chat_context_file", { root: workspacePathRef.current, path: file.path });
      await addComposerAttachment(createComposerAttachment({
        kind: "file",
        label: file.name,
        target: file.path,
      }));
    } catch (err) {
      setComposerError(String(err));
    }
  };

  const attachSelectedFileToComposer = async () => attachWorkspaceFileToComposer(selectedFile);

  const attachPreviewToComposer = async () => {
    await addComposerAttachment(createComposerAttachment({
      kind: "screenshot",
      label: "Browser preview",
      target: browserUrlRef.current,
    }));
  };

  const attachLocalFileToComposer = async () => {
    const picked = await open({ multiple: true });
    const paths = Array.isArray(picked) ? picked : typeof picked === "string" ? [picked] : [];
    for (const path of paths.slice(0, 6)) {
      try {
        if (/\.(png|jpe?g|webp|gif)$/i.test(path)) {
          await attachImagePathToComposer(path);
        } else {
          await invoke("read_chat_context_file", { root: workspacePathRef.current, path });
          await addComposerAttachment(createComposerAttachment({
            kind: "file",
            label: basename(path),
            target: path,
          }));
        }
      } catch (err) {
        setComposerError(String(err));
      }
    }
  };

  const attachImagePathToComposer = async (path: string) => {
    try {
      const image = await invoke<ChatImageResponse>("cache_chat_image", { path });
      await addComposerAttachment(createComposerAttachment({ kind: "image", label: basename(image.path), target: image.path }));
      setComposerError(null);
    } catch (err) {
      setComposerError(String(err));
    }
  };

  useEffect(() => {
    let disposed = false;
    let remove: (() => void) | null = null;
    void getCurrentWebview().onDragDropEvent((event) => {
      if (disposed || event.payload.type !== "drop" || agentSurfaceMode !== "chat") return;
      for (const path of event.payload.paths.slice(0, 6)) {
        if (/\.(png|jpe?g|webp|gif)$/i.test(path)) void attachImagePathToComposer(path);
      }
    }).then((unlisten) => { if (disposed) unlisten(); else remove = unlisten; });
    return () => { disposed = true; remove?.(); };
  }, [agentSurfaceMode, activeComposerHarnessKey]);

  const pasteComposerImage = async () => {
    try {
      const image = await readImage();
      const [{ width, height }, rgba] = await Promise.all([image.size(), image.rgba()]);
      const saved = await invoke<ChatImageResponse>("save_chat_clipboard_image", {
        rgba: Array.from(rgba),
        width,
        height,
      });
      await addComposerAttachment(createComposerAttachment({ kind: "image", label: basename(saved.path), target: saved.path }));
      setComposerError(null);
    } catch (err) {
      setComposerError(`Could not attach clipboard image: ${String(err)}`);
    }
  };

  const reviewComposerContext = async () => {
    try {
      const prepared = await prepareChatContext(composerDraft || "[No draft text]", activeComposerHarness, {
        readFile: (attachment) => invoke<TextFileResponse>("read_chat_context_file", {
          root: workspacePathRef.current,
          path: attachment.target,
        }),
        inspectImage: (attachment) => invoke<ChatImageResponse>("inspect_chat_image", { path: attachment.target }),
      });
      setComposerNotice(prepared.preview);
      setComposerError(null);
    } catch (err) {
      setComposerError(String(err));
    }
  };

  const removeComposerAttachmentById = async (attachment: ComposerAttachment) => {
    await updateActiveComposerHarness((state) => ({
      ...state,
      attachments: removeComposerAttachment(state.attachments, attachment.id),
    }));
    logComposerHarnessEvent("Attachment removed", attachment.label);
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
    const audit = await gateAppAction(createAppAction({
      kind: "close-pane",
      label: "Close pane",
      target: terminalPaneLabelForDisplay(pane.label, pane.profile.label, pane.slot),
      risk: "destructive",
      requestedBy: "user",
      undoHint: "Create a new pane from the same profile; live process state is not recoverable.",
    }), activeAgentSessionDescriptor);
    if (audit.decision !== "approved") return false;
    try {
      intentionallyTerminatedPaneIdsRef.current.add(paneId);
      let result: ClosePaneResponse;
      try {
        result = await invoke<ClosePaneResponse>("close_pane", { paneId });
      } catch (error) {
        intentionallyTerminatedPaneIdsRef.current.delete(paneId);
        throw error;
      }
      const remaining = terminalPanesForSession(root, sessionId).filter((item) => item.id !== paneId);
      const nextActive = result.activePaneId != null && remaining.some((item) => item.id === result.activePaneId)
        ? result.activePaneId
        : remaining[0]?.id ?? null;
      delete terminalSnapshotsRef.current[paneId];
      setSessionTerminalPanes(root, sessionId, remaining, nextActive);
      if (nextActive != null) await invoke("focus_pane", { paneId: nextActive });
      latest.current = nextActive == null ? null : terminalSnapshotsRef.current[nextActive] ?? null;
      requestTerminalPaintRef.current();
      setLaunchError(null);
      const status = terminalPaneProjectStatus(remaining);
      await updateOpenProjectStatus(root, projectStatusForRoot(root));
      await updateActiveSessionStatus(root, status);
      if (nextActive != null) setTimeout(sendTerminalResize, 0);
      return true;
    } catch (err) {
      setLaunchError(String(err));
      await updateOpenProjectStatus(root, "attention");
      await updateActiveSessionStatus(root, "attention");
      return false;
    }
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

  const applyEditorLoadState = (state: EditorFileLoadState) => {
    setEditorText(state.text);
    setSavedEditorText(state.savedText);
    setEditorBytes(state.bytes);
    setEditorModifiedMs(state.modifiedMs);
    setEditorError(state.error);
    setEditorRecoveryError(state.recoveryError);
    setEditorCursor(state.cursor);
  };

  const openEditorFileDirect = async (file: FileTreeNode, options: OpenEditorFileOptions = {}) => {
    const root = workspacePathRef.current ?? workspacePath;
    if (!root) return;
    closeDiffReview();
    captureCurrentEditorViewState();
    captureCurrentEditorBuffer();
    pendingEditorFocusRef.current = options.focusEditor ?? false;
    const seq = editorLoadSeq.current + 1;
    editorLoadSeq.current = seq;
    setEditorTabs((tabs) => upsertEditorTab(tabs, file));
    setSelectedFile(file);
    setEditorSaving(false);
    const buffered = editorBuffersRef.current[file.path];
    if (buffered) {
      setEditorLoading(false);
      applyEditorLoadState(editorLoadStateFromBuffer(buffered, editorViewStatesRef.current[file.path]));
      await persistActiveFile(root, file.path);
      if (options.focusEditor) requestAnimationFrame(() => editorViewRef.current?.focus());
      return;
    }
    setEditorLoading(true);
    setEditorError(null);
    setEditorRecoveryError(null);
    setEditorBytes(null);
    setEditorModifiedMs(null);
    setEditorCursor({ line: 1, column: 1 });
    try {
      const result = await invoke<TextFileResponse>("read_text_file", { root, path: file.path });
      if (editorLoadSeq.current !== seq || result.path !== file.path) return;
      const loaded = editorLoadStateFromResponse(result, editorViewStatesRef.current[file.path]);
      editorBuffersRef.current[file.path] = loaded.buffer;
      setEditorBufferRevision((value) => value + 1);
      applyEditorLoadState(loaded);
      await persistActiveFile(root, file.path);
      if (options.focusEditor) {
        requestAnimationFrame(() => {
          editorViewRef.current?.focus();
        });
      }
    } catch (err) {
      if (editorLoadSeq.current !== seq) return;
      const failed = editorLoadErrorState(err);
      editorBuffersRef.current[file.path] = failed.buffer;
      setEditorBufferRevision((value) => value + 1);
      applyEditorLoadState(failed);
    } finally {
      if (editorLoadSeq.current === seq) setEditorLoading(false);
    }
  };

  const requestOpenEditorFile = async (
    file: FileTreeNode,
    options: OpenEditorFileOptions = {},
    requestedBy: "user" | "agent" = "user",
  ) => {
    const currentPath = selectedFileRef.current?.path ?? null;
    if (currentPath === file.path) {
      closeDiffReview();
      if (options.focusEditor) requestAnimationFrame(() => editorViewRef.current?.focus());
      return true;
    }
    const audit = await gateAppAction(createAppAction({
      kind: "open-file",
      label: "Open file",
      target: file.path,
      risk: "low",
      requestedBy,
    }));
    if (audit.decision !== "approved") return false;
    await openEditorFileDirect(file, options);
    return true;
  };

  const saveEditorFile = async (options: SaveEditorFileOptions = {}) => {
    const root = workspacePathRef.current ?? workspacePath;
    if (!root || !selectedFile || editorSaving) return false;
    if (!editorDirty) return true;
    setEditorSaving(true);
    setEditorError(null);
    setEditorRecoveryError(null);
    try {
      const result = await invoke<TextFileResponse>("write_text_file", {
        root,
        path: selectedFile.path,
        content: editorText,
        expectedModifiedMs: options.force ? null : editorModifiedMs,
      });
      editorBuffersRef.current[selectedFile.path] = {
        text: result.content,
        savedText: result.content,
        bytes: result.bytes,
        modifiedMs: result.modifiedMs,
        error: null,
        recoveryError: null,
      };
      setEditorBufferRevision((value) => value + 1);
      setSavedEditorText(result.content);
      setEditorBytes(result.bytes);
      setEditorModifiedMs(result.modifiedMs);
      recordAgentActivity(activeAgentSessionDescriptor, {
        kind: "file",
        label: "Edited a file",
        detail: selectedFile.name,
        status: "complete",
      });
      return true;
    } catch (err) {
      const message = String(err);
      editorBuffersRef.current[selectedFile.path] = {
        text: editorText,
        savedText: savedEditorText,
        bytes: editorBytes,
        modifiedMs: editorModifiedMs,
        error: message,
        recoveryError: editorRecoveryError,
      };
      setEditorBufferRevision((value) => value + 1);
      setEditorError(message);
      return false;
    } finally {
      setEditorSaving(false);
    }
  };

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

  const fileOpParent = (node: FileTreeNode | null) => {
    if (!workspacePath) return null;
    if (!node) return workspacePath;
    return node.kind === "directory" ? node.path : dirname(node.path);
  };

  const fileNodeFromPath = (path: string, kind: FileTreeNode["kind"]): FileTreeNode => ({
    id: path,
    name: basename(path),
    path,
    kind,
  });

  const createFileInRail = async (node: FileTreeNode | null = null) => {
    const root = workspacePathRef.current ?? workspacePath;
    const parent = fileOpParent(node);
    if (!root || !parent) return;
    const name = window.prompt("New file name");
    if (!name) return;
    setFileOpError(null);
    try {
      const result = await invoke<FileOpResponse>("create_workspace_file", { root, parent, name });
      refreshFileTree();
      await requestOpenEditorFile(fileNodeFromPath(result.path, "file"), { focusEditor: true });
    } catch (err) {
      setFileOpError(String(err));
    }
  };

  const createFolderInRail = async (node: FileTreeNode | null = null) => {
    const root = workspacePathRef.current ?? workspacePath;
    const parent = fileOpParent(node);
    if (!root || !parent) return;
    const name = window.prompt("New folder name");
    if (!name) return;
    setFileOpError(null);
    try {
      await invoke<FileOpResponse>("create_workspace_folder", { root, parent, name });
      refreshFileTree();
    } catch (err) {
      setFileOpError(String(err));
    }
  };

  const renameRailNode = async (node: FileTreeNode) => {
    const root = workspacePathRef.current ?? workspacePath;
    if (!root) return;
    const affectedSelectedFile = selectedFileIsWithin(node);
    if (
      affectedSelectedFile &&
      editorDirty &&
      !await confirmDialog("Rename this item and discard the unsaved editor buffer?")
    ) {
      return;
    }
    const name = window.prompt("Rename to", node.name);
    if (!name || name === node.name) return;
    setFileOpError(null);
    try {
      const result = await invoke<FileOpResponse>("rename_workspace_path", { root, path: node.path, name });
      setEditorTabs((tabs) => retargetEditorTabs(tabs, node.path, result.path, basename));
      editorBuffersRef.current = retargetEditorBuffers(editorBuffersRef.current, node.path, result.path);
      editorViewStatesRef.current = retargetEditorBuffers(editorViewStatesRef.current, node.path, result.path);
      setEditorBufferRevision((value) => value + 1);
      refreshFileTree();
      if (affectedSelectedFile && selectedFile) {
        const nextSelectedPath =
          selectedFile.path === node.path ? result.path : `${result.path}${selectedFile.path.slice(node.path.length)}`;
        selectedFileRef.current = null;
        setSelectedFile(null);
        await openEditorFileDirect(fileNodeFromPath(nextSelectedPath, "file"), { focusEditor: true });
      }
    } catch (err) {
      setFileOpError(String(err));
    }
  };

  const selectedFileIsWithin = (node: FileTreeNode) =>
    selectedFile != null && (selectedFile.path === node.path || selectedFile.path.startsWith(`${node.path}/`));

  const deleteRailNode = async (node: FileTreeNode) => {
    const root = workspacePathRef.current ?? workspacePath;
    if (!root) return;
    const affectedSelectedFile = selectedFileIsWithin(node);
    const message = `Delete ${node.kind === "directory" ? "folder" : "file"} "${node.name}"? This cannot be undone.`;
    if (!await confirmDialog(message)) return;
    if (affectedSelectedFile && editorDirty && !await confirmDialog("The selected file has unsaved changes. Delete anyway?")) return;
    setFileOpError(null);
    try {
      await invoke("delete_workspace_path", { root, path: node.path });
      const nextTabs = removeEditorTabsWithin(editorTabs, node.path);
      editorBuffersRef.current = removeEditorBuffersWithin(editorBuffersRef.current, node.path);
      editorViewStatesRef.current = removeEditorBuffersWithin(editorViewStatesRef.current, node.path);
      setEditorTabs(nextTabs);
      setEditorBufferRevision((value) => value + 1);
      if (affectedSelectedFile) {
        const nextTab = nextTabs[0] ?? null;
        if (nextTab) {
          selectedFileRef.current = null;
          setSelectedFile(null);
          await openEditorFileDirect(nextTab, { focusEditor: true });
        } else {
          if (workspacePathRef.current) void clearPersistedActiveFile(workspacePathRef.current);
          resetEditor();
        }
      }
      refreshFileTree();
    } catch (err) {
      setFileOpError(String(err));
    }
  };

  const duplicateRailNode = async (node: FileTreeNode) => {
    const root = workspacePathRef.current ?? workspacePath;
    if (!root) return;
    setFileOpError(null);
    try {
      await invoke<FileOpResponse>("duplicate_workspace_path", { root, path: node.path });
      refreshFileTree();
    } catch (err) {
      setFileOpError(String(err));
    }
  };

  const revealRailNode = async (node: FileTreeNode) => {
    setFileOpError(null);
    try {
      await revealItemInDir(node.path);
    } catch (err) {
      setFileOpError(`Could not reveal ${node.name}: ${err}`);
    }
  };

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

  const captureSessionCheckpoint = async (projectPath: string, session: ProjectSession) => {
    if (projectPath !== workspacePathRef.current) {
      setLaunchError("Switch to this project before capturing its workspace checkpoint.");
      return;
    }
    try {
      const checkpoint = await createWorkspaceCheckpoint(projectPath, `Chat checkpoint: ${session.title}`);
      await updateProjectSessionMetadata(projectPath, session.id, {
        checkpointId: checkpoint.id,
        checkpointCreatedAt: checkpoint.createdAt,
      });
      setActionNotice(`Captured ${checkpoint.fileCount} changed file${checkpoint.fileCount === 1 ? "" : "s"}`);
    } catch (error) {
      setLaunchError(`Could not capture workspace checkpoint: ${String(error)}`);
    }
  };

  const reconcileRestoredActiveFile = async (
    activeFile: FileTreeNode | null,
    action: "write" | "delete" | null,
  ) => {
    if (!activeFile || !action) return;
    if (action === "delete") {
      setSelectedFile(null);
      setEditorText("");
      setSavedEditorText("");
      return;
    }
    await openEditorFileDirect(activeFile);
  };

  const approveCheckpointRestore = async (projectPath: string, fileCount: number) => gateAppAction(createAppAction({
    kind: "restore-checkpoint",
    label: "Restore workspace checkpoint",
    target: `${fileCount} files in ${projectPath}`,
    risk: "high",
    requestedBy: "user",
    undoHint: "Restore the recovery checkpoint created before this operation.",
  }));

  const restoreSessionCheckpoint = async (
    projectPath: string,
    session: ProjectSession,
    checkpointId: string,
  ) => {
    if (projectPath !== workspacePathRef.current) {
      setLaunchError("Switch to this project before restoring its workspace checkpoint.");
      return;
    }
    try {
      const preview = await previewWorkspaceCheckpoint(projectPath, checkpointId);
      if (preview.files.length === 0) {
        setActionNotice("Workspace already matches this checkpoint");
        return;
      }
      const plan = planCheckpointRestore({
        dirtyTabPaths,
        preview,
        projectPath,
        selectedFilePath: selectedFileRef.current?.path ?? null,
      });
      if (plan.protectedDirtyPath) {
        setLaunchError(`Save or discard the dirty editor buffer before restore: ${plan.protectedDirtyPath}`);
        return;
      }
      if (!await confirmDialog(checkpointPreviewMessage(preview))) return;
      const audit = await approveCheckpointRestore(projectPath, preview.files.length);
      if (audit.decision !== "approved") return;
      const result = await restoreWorkspaceCheckpoint(
        projectPath,
        checkpointId,
        preview.previewToken,
        plan.relativeDirtyPaths,
      );
      for (const path of plan.affectedAbsolutePaths) delete editorBuffersRef.current[path];
      setEditorBufferRevision((revision) => revision + 1);
      await reconcileRestoredActiveFile(selectedFileRef.current, plan.activeFileAction);
      await updateProjectSessionMetadata(projectPath, session.id, {
        recoveryCheckpointId: result.recoveryCheckpointId,
      });
      refreshFileTree();
      await refreshGitStatus();
      setActionNotice(`Restored ${result.restoredFiles} files; recovery checkpoint is ready`);
    } catch (error) {
      setLaunchError(`Could not restore workspace checkpoint: ${String(error)}`);
    }
  };

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

  const browserContextMenuItems = (): ContextMenuItem[] => [
    menuItem("browser.back", "Back", () => goBrowserHistory(-1), {
      icon: "back",
      disabled: !browserCanGoBack,
    }),
    menuItem("browser.forward", "Forward", () => goBrowserHistory(1), {
      icon: "forward",
      disabled: !browserCanGoForward,
    }),
    menuItem("browser.reload", "Reload", reloadBrowserPreview, { icon: "reload" }),
    menuItem("browser.open-external", "Open Externally", () => openUrl(browserUrl), { icon: "openExternal" }),
    menuItem("browser.copy-url", "Copy URL", async () => { await writeText(browserUrl); setActionNotice("Copied browser URL"); }, { icon: "browser" }),
  ];

  const composerContextMenuItems = (): ContextMenuItem[] => [
    menuItem("composer.send", "Send Draft", () => submitComposerDraft(), {
      icon: "send",
      shortcut: shortcutKeys("composer.send"),
      disabled: composerSending || !composerDraft.trim(),
    }),
    menuItem("composer.clear", "Clear Draft", () => setComposerLocalState(activeComposerHarnessKey, "", composerHistory), { icon: "close", disabled: !composerDraft }),
    menuItem("composer.attach-file", "Attach Local File", () => attachLocalFileToComposer(), { icon: "filePlus" }),
    menuItem("composer.attach-current", "Attach Current File", () => attachSelectedFileToComposer(), {
      icon: "file",
      disabled: !selectedFile,
    }),
    menuItem("composer.attach-preview", "Attach Browser Preview", () => attachPreviewToComposer(), { icon: "browser" }),
    menuItem("composer.parallel", "Run Parallel Child Chats", () => {
      setOrchestrationError(null);
      setOrchestrationOpen(true);
    }, {
      icon: "agent",
      disabled: !workspacePath || !activeSessionId || Boolean(activeChatConversation.activeRunId),
    }),
    menuItem("composer.stop", "Stop Chat Run", () => stopActiveChatRun(), {
      icon: "stop",
      danger: true,
      disabled: !activeChatConversation.activeRunId,
    }),
    menuItem("composer.copy-cwd", "Copy Target Workspace", () => workspacePath ? copyPathToClipboard(workspacePath) : undefined, {
      icon: "workspace",
      disabled: !workspacePath,
    }),
  ];

  const composerAddMenuItems = (): ContextMenuItem[] => [
    menuItem("composer.add.files", "Files and folders", () => attachLocalFileToComposer(), { icon: "filePlus" }),
    menuItem("composer.add.current", "Current editor file", () => attachSelectedFileToComposer(), {
      icon: "file",
      disabled: !selectedFile,
    }),
    menuItem("composer.add.preview", "Browser preview", () => attachPreviewToComposer(), { icon: "browser" }),
    menuItem("composer.add.parallel", "Parallel child chats", () => {
      setOrchestrationError(null);
      setOrchestrationOpen(true);
    }, {
      icon: "agent",
      disabled: !workspacePath || !activeSessionId || Boolean(activeChatConversation.activeRunId),
    }),
  ];

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
  const commandPaletteCommands: CommandPaletteCommand[] = [
    ...visibleOpenProjects.flatMap((project) => projectSessionsFor(project.path).map((session): CommandPaletteCommand => ({
      id: `chat.${project.path}.${session.id}`,
      label: session.title,
      detail: `${basename(project.path)}${session.archived ? " · Archived" : ""}`,
      source: "chats",
      icon: session.pinnedAt ? "pin" : "newChat",
      keywords: ["chat", "task", "thread", project.path],
      run: () => void switchProjectSession(project.path, session.id),
    }))),
    ...chatSearchViewResults
      .filter((result) => result.role !== "title")
      .map((result): CommandPaletteCommand => ({
        id: `chat-message.${result.chatId}.${result.messageId ?? result.timestamp}`,
        label: result.title,
        detail: `${result.projectName} · ${result.snippet}`,
        source: "chats",
        icon: result.bookmarked ? "bookmark" : "newChat",
        keywords: ["chat", "message", "history", result.projectPath, result.snippet],
        run: () => void openChatSearchResult(result),
      })),
    {
      id: "chat.parallel",
      label: "Run Parallel Child Chats",
      detail: "Preview and launch 2-8 bounded child chats",
      icon: "agent",
      disabled: !workspacePath || !activeSessionId || Boolean(activeChatConversation.activeRunId),
      keywords: ["agents", "orchestration", "parallel", "children", "dispatch"],
      run: () => {
        setOrchestrationError(null);
        setOrchestrationOpen(true);
      },
    },
    {
      id: "workspace.open",
      label: "Open Folder",
      detail: "Choose a project folder",
      shortcut: shortcutKeys("workspace.open"),
      icon: "folderOpen",
      keywords: ["project", "workspace"],
      run: () => void pickWorkspace(),
    },
    ...COMPOSER_APP_COMMANDS.map((info) => ({
      id: `composer.${info.command}`,
      label: `App Command ${info.label}`,
      detail: info.detail,
      icon: "send" as AppIconName,
      keywords: ["composer", "app command", ...info.aliases],
      run: () => void runComposerAppCommand(info.command),
    })),
    {
      id: "transcripts.open",
      label: "Review Transcripts",
      detail: "Saved output from completed panes",
      icon: "file",
      keywords: ["transcript", "history", "output", "log"],
      run: () => setTranscriptsOpen(true),
    },
    {
      id: "settings.open",
      label: "Open Settings",
      detail: "Agent, layout, browser preview, and Git settings",
      shortcut: shortcutKeys("chrome.settings"),
      icon: "settings",
      keywords: ["preferences", "config", "permission", "profile"],
      run: () => setSettingsOpen(true),
    },
    {
      id: "terminal.find",
      label: "Find in Terminal",
      detail: activeTerminalPane ? "Search the selected pane's scrollback" : "Start a pane to search its output",
      icon: "search",
      disabled: !activeTerminalPane,
      keywords: ["scrollback", "search", "output", "terminal"],
      run: () => terminalFind.setOpen(true),
    },
    {
      id: "perf.snapshot-render-stats",
      label: "Copy Render Perf Snapshot",
      detail: "Write frame-time/IPC-payload/jank stats to docs/qa/perf-budget/render-perf-live.json",
      icon: "file",
      disabled: !workspacePath,
      keywords: ["perf", "performance", "frame", "jank", "render", "budget"],
      run: () => void exportRenderPerfSnapshot(),
    },
    {
      id: "layout.reset-demo",
      label: "Reset Layout to Demo Default",
      detail: "Threads visible, Files docked right, agent chat centered",
      icon: "workspace",
      keywords: ["layout", "tray", "dock", "first open", "demo"],
      run: resetInterface,
    },
    {
      id: "workspace.quick-open",
      label: "Quick Open",
      detail: workspacePath ? "Open files by name or path" : "Open a folder before quick open",
      shortcut: shortcutKeys("workspace.quick-open"),
      icon: "search",
      disabled: !workspacePath,
      keywords: ["file", "jump", "cmd p"],
      run: quickOpen.openDialog,
    },
    {
      id: "editor.save",
      label: "Save",
      detail: selectedFile ? selectedFile.path : "Save the active editor file",
      shortcut: shortcutKeys("editor.save"),
      icon: "save",
      disabled: !editorDirty || editorSaving || editorLoading,
      keywords: ["file", "write"],
      run: () => void saveEditorFile(),
    },
    {
      id: "editor.find",
      label: "Find and Replace",
      detail: selectedFile ? selectedFile.name : "Open a file to search inside it",
      shortcut: shortcutKeys("editor.find"),
      icon: "search",
      disabled: !selectedFile || editorLoading,
      keywords: ["search", "editor"],
      run: openEditorSearch,
    },
    {
      id: "editor.close-tab",
      label: "Close Tab",
      detail: selectedFile ? selectedFile.name : "No editor tab selected",
      shortcut: shortcutKeys("editor.close-tab"),
      icon: "close",
      disabled: !selectedFile,
      keywords: ["editor"],
      run: () => selectedFile && void closeEditorTab(selectedFile),
    },
    {
      id: "terminal.new-pane",
      label: `New ${terminalLaunchProfile.label} Pane`,
      detail: workspacePath ? basename(workspacePath) : "Open a folder before creating a pane",
      icon: "terminal",
      disabled: !workspacePath || launchProfileChanging,
      keywords: ["agent", "terminal", "claude", "codex"],
      run: () => void createTerminalPane(terminalLaunchProfile),
    },
    {
      id: "terminal.new-worktree-pane",
      label: "New Worktree Pane",
      detail: workspacePath ? `Disposable git worktree in ${basename(workspacePath)}` : "Open a folder before creating a worktree",
      icon: "terminal",
      disabled: !workspacePath || launchProfileChanging,
      keywords: ["worktree", "branch", "parallel", "agent", "terminal"],
      run: () => void createWorktreePane(terminalLaunchProfile),
    },
    {
      id: "terminal.remove-worktree",
      label: "Remove Worktree",
      detail: activeTerminalPane ? (worktreeForPaneId(worktrees, String(activeTerminalPane.id))?.branch ?? "Selected pane has no worktree") : "No pane selected",
      icon: "close",
      disabled: !activeTerminalPane || !worktreeForPaneId(worktrees, activeTerminalPane ? String(activeTerminalPane.id) : null),
      keywords: ["worktree", "branch", "cleanup", "delete"],
      run: () => activeTerminalPane && void closeWorktreePane(activeTerminalPane.id),
    },
    {
      id: "terminal.restart-pane",
      label: "Restart Selected Process",
      detail: activeTerminalPaneLabelForCommands ?? "No pane selected",
      icon: "reload",
      disabled: !activeTerminalPane || launchProfileChanging,
      keywords: ["agent", "terminal"],
      run: () => activeTerminalPane && void restartTerminalPane(activeTerminalPane),
    },
    {
      id: "terminal.kill-pane",
      label: "Kill Selected Process",
      detail: activeTerminalPaneLabelForCommands ?? "No pane selected",
      icon: "stop",
      disabled: !activeTerminalPane || activeTerminalPane.state === "exited",
      keywords: ["agent", "terminal", "stop"],
      run: () => activeTerminalPane && void terminateTerminalPane(activeTerminalPane),
    },
    {
      id: "terminal.close-pane",
      label: "Close Selected Pane",
      detail: activeTerminalPaneLabelForCommands ?? "No pane selected",
      icon: "close",
      disabled: !activeAgentSessionHandle,
      keywords: ["agent", "terminal"],
      run: () => activeAgentSessionHandle && void activeAgentSessionHandle.close(),
    },
    {
      id: "terminal.clear",
      label: "Clear Terminal",
      detail: activeTerminalPaneLabelForCommands ?? "No pane selected",
      shortcut: shortcutKeys("terminal.clear"),
      icon: "terminal",
      disabled: !activeTerminalPane,
      keywords: ["agent", "screen"],
      run: () => void clearActiveTerminal(),
    },
    {
      id: "browser.reload",
      label: "Reload Preview",
      detail: browserUrl,
      icon: "reload",
      keywords: ["browser", "preview"],
      run: reloadBrowserPreview,
    },
    {
      id: "browser.open-detected",
      label: "Open Detected Dev Server",
      detail: activeDetectedLocalDevServer?.url ?? "No detected local server",
      icon: "browser",
      disabled: !activeDetectedLocalDevServer,
      keywords: ["localhost", "preview", "vite", "next"],
      run: () => void openDetectedLocalDevServer(),
    },
    ...DRAWER_MODES.map((mode): CommandPaletteCommand => ({
      id: `drawer.${mode.id}`,
      label: `Show ${mode.label}`,
      detail: "Switch side drawer",
      icon: mode.icon,
      keywords: ["drawer", "sidebar", mode.id],
      run: () => {
        setSideDrawerCollapsed(false);
        setSideDrawerMode(mode.id);
      },
    })),
    ...([
      ["right", "Dock Tools Right"],
      ["left", "Dock Tools Left"],
      ["bottom", "Dock Tools Bottom"],
      ["hidden", "Hide Tool Tray"],
    ] as const).map(([mode, label]): CommandPaletteCommand => ({
      id: `layout.${mode}`,
      label,
      detail: "Move or hide the editor/browser tray",
      icon: mode === "hidden" ? "close" : "browser",
      keywords: ["layout", "tray", "dock"],
      run: () => setWorkbenchLayout(mode),
    })),
    ...([
      ["split", "Show Split Tools"],
      ["editor", "Show Editor Tray"],
      ["browser", "Show Browser Tray"],
    ] as const).map(([mode, label]): CommandPaletteCommand => ({
      id: `tool-tray.${mode}`,
      label,
      detail: "Choose visible tool tray content",
      icon: mode === "browser" ? "browser" : mode === "editor" ? "file" : "workspace",
      keywords: ["tray", "editor", "browser"],
      run: () => {
        if (workbenchLayout === "hidden") setWorkbenchLayout("right");
        setToolTrayMode(mode);
      },
    })),
    {
      id: "composer.attach-current",
      label: "Attach Current File",
      detail: selectedFile ? selectedFile.path : "Open a file first",
      icon: "file",
      disabled: !selectedFile || !activeComposerHarnessKey,
      keywords: ["composer", "context"],
      run: () => void attachSelectedFileToComposer(),
    },
    {
      id: "composer.attach-preview",
      label: "Attach Browser Preview",
      detail: browserUrl,
      icon: "browser",
      disabled: !activeComposerHarnessKey,
      keywords: ["composer", "context", "browser"],
      run: () => void attachPreviewToComposer(),
    },
    ...editorTabs.map((tab): CommandPaletteCommand => ({
      id: `tab.${tab.path}`,
      label: tab.name,
      detail: `Open tab · ${tab.path}`,
      source: "tabs",
      icon: "file",
      keywords: ["tab", "editor", tab.path],
      run: () => void requestOpenEditorFile(tab, { focusEditor: true }),
    })),
    ...worktrees
      .filter((worktree) => worktree.projectRoot === workspacePath)
      .map((worktree): CommandPaletteCommand => {
        const pane = terminalPanes.find((candidate) => String(candidate.id) === worktree.paneId);
        return {
          id: `worktree.${worktree.paneId}`,
          label: worktree.label,
          detail: `${worktree.branch} · ${worktree.path}`,
          source: "worktrees",
          icon: "terminal",
          disabled: !pane,
          keywords: ["worktree", "branch", "terminal", worktree.branch],
          run: () => {
            if (!pane) return;
            setAgentSurfaceMode("terminal");
            void focusTerminalPane(pane.id);
          },
        };
      }),
    ...searchableFiles.map((file): CommandPaletteCommand => ({
      id: `file.${file.path}`,
      label: file.name,
      detail: file.path,
      source: "files",
      icon: "file",
      keywords: ["file", "project", file.path],
      run: () => void requestOpenEditorFile(file, { focusEditor: true }),
    })),
  ];
  const filteredCommandPaletteCommands = filterCommandPaletteCommands(commandPaletteCommands, commandPalette.query, commandPaletteSources);
  const visibleCommandPaletteCommands = commandPalette.query.trim()
    ? filteredCommandPaletteCommands.slice(0, 120)
    : [
        ...filteredCommandPaletteCommands.filter((command) => command.source === "chats").slice(0, 6),
        ...filteredCommandPaletteCommands.filter((command) => command.source !== "chats").slice(0, 6),
      ];
  const tabIsDirty = (path: string) => dirtyTabPathSet.has(path);

  const closeEditorTab = async (tab: FileTreeNode) => {
    captureCurrentEditorViewState();
    captureCurrentEditorBuffer();
    if (tabIsDirty(tab.path) && !await confirmDialog(`Close ${tab.name} and discard unsaved changes?`)) return;
    const result = removeEditorTab(editorTabs, selectedFileRef.current?.path ?? null, tab.path);
    setEditorTabs(result.tabs);
    delete editorBuffersRef.current[tab.path];
    delete editorViewStatesRef.current[tab.path];
    setEditorBufferRevision((value) => value + 1);
    if (!result.nextActivePath) {
      if (workspacePathRef.current) void clearPersistedActiveFile(workspacePathRef.current);
      resetEditor();
      return;
    }
    if (result.nextActivePath !== selectedFileRef.current?.path) {
      const nextTab = result.tabs.find((candidate) => candidate.path === result.nextActivePath);
      if (nextTab) {
        selectedFileRef.current = null;
        setSelectedFile(null);
        await openEditorFileDirect(nextTab, { focusEditor: true });
      }
    }
  };

  const closeActiveEditorTab = async () => {
    const file = selectedFileRef.current;
    if (!file) return;
    await closeEditorTab(file);
  };

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

  const continuePendingNavigation = async (navigation: PendingNavigation) => {
    if (navigation.kind === "file") {
      await openEditorFileDirect(navigation.file, navigation.options);
    } else if (navigation.kind === "workspace") {
      await openWorkspaceDirect(navigation.path);
    } else {
      await closeProjectDirect(navigation.projectPath);
    }
  };

  const saveDraftAndContinue = async () => {
    await saveDraftAndContinueNavigation({
      pendingNavigation,
      saveEditorFile,
      continuePendingNavigation,
      setPendingNavigation,
      setDraftDialogError,
    });
  };

  const discardDraftAndContinue = async () => {
    await discardDraftAndContinueNavigation({
      pendingNavigation,
      continuePendingNavigation,
      setPendingNavigation,
      setDraftDialogError,
    });
  };

  useEffect(() => {
    workspacePathRef.current = workspacePath;
  }, [workspacePath]);

  useEffect(() => {
    if (sideDrawerMode !== "files") return;
    const el = railBodyRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setRailHeight(Math.max(120, Math.floor(rect.height)));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [sideDrawerMode]);

  useEffect(() => {
    if (!workspacePath) {
      setFileTree([]);
      setFileTreeError(null);
      setFileTreeTruncated(false);
      resetEditor();
      return;
    }
    let cancelled = false;
    setFileTreeLoading(true);
    setFileTreeError(null);
    invoke<FileTreeResponse>("list_workspace_tree", { path: workspacePath })
      .then((result) => {
        if (cancelled) return;
        workspacePathRef.current = result.root;
        setFileTree(result.nodes);
        setFileTreeTruncated(result.truncated);
      })
      .catch((err) => {
        if (cancelled) return;
        setFileTree([]);
        setFileTreeError(String(err));
        setFileTreeTruncated(false);
      })
      .finally(() => {
        if (!cancelled) setFileTreeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspacePath, treeRefreshNonce]);

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

  useEffect(() => {
    if (!workspacePath) return;
    let cancelled = false;
    invoke("watch_workspace_tree", { path: workspacePath }).catch((err) => {
      if (!cancelled) setFileTreeError(`Live file watcher unavailable: ${err}`);
    });
    return () => {
      cancelled = true;
    };
  }, [workspacePath]);

  useEffect(() => {
    const unlisten = listen<WorkspaceTreeChanged>("workspace-tree-changed", (event) => {
      if (workspacePathRef.current && event.payload.root === workspacePathRef.current) {
        setTreeRefreshNonce((value) => value + 1);
      }
    });
    return () => {
      unlisten.then((stop) => stop());
    };
  }, []);

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

        {renderedWorkbenchLayout !== "hidden" ? (
          <>
            <button
              className={`workbench-resizer workbench-resizer--tray workbench-resizer--${renderedWorkbenchLayout}`}
              type="button"
              role="separator"
              aria-label="Resize tool tray"
              aria-orientation={renderedWorkbenchLayout === "bottom" ? "horizontal" : "vertical"}
              aria-valuemin={18}
              aria-valuemax={54}
              aria-valuenow={Math.round(workbenchSizing.trayPercent)}
              title="Drag to resize tool tray"
              onPointerDown={(event) => beginWorkbenchResize("tray", event)}
              onKeyDown={(event) => nudgeWorkbenchResize("tray", event)}
            />
            {toolTrayMode === "split" ? (
              <button
                className={`workbench-resizer workbench-resizer--tools workbench-resizer--${renderedWorkbenchLayout}`}
                type="button"
                role="separator"
                aria-label="Resize editor and browser trays"
                aria-orientation={renderedWorkbenchLayout === "bottom" ? "vertical" : "horizontal"}
                aria-valuemin={25}
                aria-valuemax={75}
                aria-valuenow={Math.round(workbenchSizing.toolSplitPercent)}
                title="Drag to resize editor and browser trays"
                onPointerDown={(event) => beginWorkbenchResize("tools", event)}
                onKeyDown={(event) => nudgeWorkbenchResize("tools", event)}
              />
            ) : null}
          </>
        ) : null}

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
          onApprovalModeChange={(scope, mode) => {
            if (scope === "chat") void setComposerApprovalMode(mode);
            else void updateScopedSetting(scope, "approvalMode", mode);
          }}
          onOpenAgentConnection={(providerId) => void openAgentConnection(providerId)}
          onRefreshAgentConnections={refreshAgentConnections}
          onBrowserUrlCommit={(scope, url) => {
            const normalized = normalizeBrowserPreviewUrl(url);
            if (!normalized) return;
            void (async () => {
              await updateScopedSetting(scope, "browserUrl", normalized);
              const effective = resolveScopedSetting(
                scopedSettingsRef.current,
                "browserUrl",
                workspacePathRef.current,
                activeSessionForProject(workspacePathRef.current),
              ).value;
              setBrowserLocation(effective);
            })();
          }}
          onAiConnectionSettingsChange={(next) => void saveAiConnectionSettings(next)}
          onDeleteConnectionSecret={deleteConnectionSecret}
          onSaveConnectionSecret={saveConnectionSecret}
          onValidateConnectionTarget={(server: McpServerConfig) => invoke<ConnectionTargetStatus>("probe_mcp_server", {
            request: {
              ...server,
              environment: connectionEnvironmentInputs(aiConnectionSettingsRef.current, workspacePath ?? ""),
            },
          })}
          onBeginMcpOAuth={(server: McpServerConfig) => invoke<McpOAuthStart>("begin_mcp_oauth", {
            request: {
              id: server.id,
              target: server.target,
              oauthIssuer: server.oauthIssuer,
              oauthClientId: server.oauthClientId,
              oauthScopes: server.oauthScopes,
            },
          }).then((start) => {
            setMcpOAuthStatuses((current) => ({
              ...current,
              [server.id]: { serverId: server.id, state: "pending", message: start.message },
            }));
            return start;
          })}
          onDisconnectMcpOAuth={(server: McpServerConfig) => invoke<McpOAuthStatus>("disconnect_mcp_oauth", {
            serverId: server.id,
          }).then((status) => {
            setMcpOAuthStatuses((current) => ({ ...current, [server.id]: status }));
            setConnectionSecretPresence((current) => ({
              ...current,
              [mcpOauthTokenKey(server.id)]: false,
              [mcpOauthClientSecretKey(server.id)]: false,
            }));
            return status;
          })}
          onCommandPaletteSourceChange={(source: CommandPaletteSourceId, enabled) => {
            const next = { ...commandPaletteSources, [source]: enabled };
            setCommandPaletteSources(next);
            void storeRef.current?.set("commandPaletteSources", next);
            void storeRef.current?.save();
          }}
          onAddCustomTerminalProfile={(label, command) => void addCustomTerminalProfile(label, command)}
          keybindingOverrides={keybindingOverrides}
          onResetLocalData={() => {
            void (async () => {
              if (!await confirmDialog("Reset all local data? This clears saved projects, chats, transcripts, layout, and local state files. This cannot be undone.")) return;
              await Promise.all(connectionSecretKeys(aiConnectionSettings).map((key) =>
                invoke("delete_connection_secret", { key }).catch(() => null)
              ));
              const store = storeRef.current;
              if (store) {
                await store.clear();
                await store.save();
              }
              await resetDurableChatStore();
              await invoke("reset_local_state").catch(() => {});
              window.location.reload();
            })();
          }}
          notificationsEnabled={notificationsEnabled}
          onNotificationsChange={(enabled) => {
            setNotificationsEnabled(enabled);
            void storeRef.current?.set("notificationsEnabled", enabled);
            void storeRef.current?.save();
            if (enabled) void requestPermission().catch(() => {});
          }}
          onRemoveCustomTerminalProfile={(profileId) => void removeCustomTerminalProfile(profileId)}
          theme={appTheme}
          onThemeChange={(theme) => {
            setAppTheme(theme);
            void storeRef.current?.set("appTheme", theme);
            void storeRef.current?.save();
          }}
          onKeybindingOverrideChange={(id, keys) => {
            const next = { ...keybindingOverrides };
            if (keys) next[id] = keys;
            else delete next[id];
            setActiveKeybindingOverrides(next);
            setKeybindingOverrides(next);
            void storeRef.current?.set("keybindingOverrides", next);
            void storeRef.current?.save();
          }}
          onClose={() => setSettingsOpen(false)}
          onLayoutChange={setWorkbenchLayout}
          onProfileChange={(scope, profileId) => {
            const profile = resolveLaunchProfile(profileId);
            if (!profile) return;
            if (scope === "global") void switchLaunchProfile(profile);
            else void updateScopedSetting(scope, "agentProfileId", profile.id);
          }}
          onScopedSettingReset={(rowId, scope) => {
            const key = rowId === "agents.profile"
              ? "agentProfileId"
              : rowId === "agents.permission"
                ? "approvalMode"
                : "browserUrl";
            void (async () => {
              await clearScopedSetting(scope, key);
              if (key === "browserUrl") {
                restoreBrowserPreview(workspacePathRef.current, activeSessionForProject(workspacePathRef.current));
              }
            })();
          }}
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
      <AppNotices
        actionNotice={actionNotice}
        canUseShellProfile={!launchProfileChanging && launchProfile.id !== "shell"}
        crashNotice={crashNotice}
        launchError={launchError}
        onDismissAction={() => setActionNotice(null)}
        onDismissCrash={() => setCrashNotice(null)}
        onOpenFolder={() => void pickWorkspace()}
        onUseShellProfile={() => {
          const shell = LAUNCH_PROFILES.find((profile) => profile.id === "shell");
          if (shell) void switchLaunchProfile(shell);
        }}
      />
      <OrchestrationDialog
        open={orchestrationOpen}
        projectPath={workspacePath ?? ""}
        parentTitle={projectSessions[workspacePath ?? ""]?.find((session) => session.id === activeSessionId)?.title ?? "Current chat"}
        provider={activeComposerProvider ?? activeChatConversation.provider}
        approvalMode={activeComposerHarness.approvalMode}
        activeRunCount={Object.values(chatConversations).filter((conversation) => conversation.activeRunId).length}
        launching={orchestrationLaunching}
        error={orchestrationError}
        onClose={() => {
          if (orchestrationLaunching) return;
          setOrchestrationOpen(false);
          setOrchestrationError(null);
        }}
        onLaunch={(children) => void launchOrchestration(children)}
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
          onCancel={() => setPendingNavigation(null)}
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
