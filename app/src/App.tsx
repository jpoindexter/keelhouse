import { type CSSProperties, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { readImage, readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath, openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { load } from "@tauri-apps/plugin-store";
import { EditorView, type ViewUpdate } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { oneDark } from "@codemirror/theme-one-dark";
import { openSearchPanel } from "@codemirror/search";
import { Tree } from "react-arborist";
import type { NodeRendererProps, TreeApi } from "react-arborist";
import { DraftNavigationDialog } from "./DraftNavigationDialog";
import { EditorSaveError } from "./EditorSaveError";
import {
  browserHistoryCanGoBack,
  browserHistoryCanGoForward,
  DEFAULT_BROWSER_PREVIEW_URL,
  detectLocalDevServerUrl,
  normalizeBrowserPreviewRecords,
  normalizeBrowserPreviewUrl,
  pushBrowserHistory,
} from "./browserPreview";
import type { BrowserPreviewRecords } from "./browserPreview";
import { editorExtensionsFor } from "./editorLanguages";
import { isCellSelected, pointFromMouse, selectionToText } from "./selection";
import type { SelectionRange } from "./selection";
import {
  activeProjectSessionId,
  ensureProjectSessions,
  forgetActiveFile,
  isMissingWorkspaceError,
  normalizeActiveFileByWorkspace,
  normalizeActiveSessionByProject,
  normalizeOpenProjects,
  normalizeProjectSessionsByProject,
  normalizeRecentProjects,
  newProjectSession,
  openProjectsFromRecent,
  planProjectClose,
  pushRecentProject,
  removeProjectSession,
  removeOpenProject,
  rememberActiveFile,
  removeRecentProject,
  sessionRecencyLabel,
  setActiveProjectSession,
  setOpenProjectStatus,
  setProjectSessionStatus,
  setProjectSessionArchived,
  setProjectSessionPinned,
  activeSessionsForRail,
  archivedSessionCount,
  upsertOpenProject,
  upsertProjectSession,
} from "./workspaceState";
import type { ActiveFileByWorkspace, ActiveSessionByProject, OpenProject, ProjectRailStatus, ProjectSession, ProjectSessionsByProject } from "./workspaceState";
import {
  clampEditorViewState,
  cursorFromText,
  findFileTreeNode,
  fileTreeContainsPath,
  languageLabelForPath,
  pathBreadcrumbs,
  reconcileActiveFileNode,
} from "./editorState";
import type { CursorPosition, EditorViewState } from "./editorState";
import {
  discardDraftAndContinueNavigation,
  saveDraftAndContinueNavigation,
  shouldPromptForDirtyDraft,
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
import type { EditorBufferSnapshot } from "./editorTabs";
import {
  LAUNCH_PROFILES,
  createCustomLaunchProfile,
  defaultLaunchProfile,
  defaultTerminalLaunchProfile,
  launchProfileById,
  launchProfileCommandLine,
  launchProfileMode,
  normalizeLaunchProfile,
  normalizeCustomLaunchProfiles,
  normalizeTerminalLaunchProfile,
} from "./launchProfiles";
import type { LaunchProfile } from "./launchProfiles";
import {
  defaultScopedSettings,
  migrateLegacyScopedSettings,
  normalizeScopedSettings,
  resetScopedSetting,
  resolveScopedSetting,
  scopedSettingView,
  setScopedSetting,
} from "./scopedSettings";
import type { ScopedSettingKey, ScopedSettingsState, SettingsScope } from "./scopedSettings";
import {
  composerHistoryAfterSubmit,
  composerHistoryAt,
  nextComposerHistoryIndex,
  previousComposerHistoryIndex,
  routeComposerDraft,
  composerHelpText,
  COMPOSER_APP_COMMANDS,
} from "./agentComposer";
import type { ComposerAppCommand } from "./agentComposer";
import {
  createComposerAttachment,
  defaultComposerHarnessState,
  normalizeComposerHarnessRecords,
  removeComposerAttachment,
  upsertComposerAttachment,
} from "./composerHarness";
import type { ComposerAttachment, ComposerHarnessRecords, ComposerHarnessState, ComposerReasoningEffort } from "./composerHarness";
import { prepareChatContext } from "./chatContext";
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
import { AppIcon, paneStateAccessibleLabel, paneStateIconName } from "./icons";
import type { AppIconName } from "./icons";
import {
  comboMatches,
  normalizeKeybindingOverrides,
  setActiveKeybindingOverrides,
  shortcutKeys,
  shortcutTitle,
  type KeybindingOverrides,
} from "./shortcuts";
import { filterCommandPaletteCommands, type CommandPaletteCommand as CommandPaletteCommandBase } from "./commandPalette";
import {
  DEFAULT_COMMAND_PALETTE_SOURCES,
  normalizeCommandPaletteSources,
  type CommandPaletteSourceId,
} from "./commandPaletteSources";
import { filterWorkspaceFiles } from "./workspaceSearch";
import {
  MAX_AGENT_ACTIVITY_LOG_EVENTS,
  createAgentActivityEvent,
  filterAgentActivityEvents,
  normalizeAgentActivityEvents,
  pushAgentActivityEvent,
} from "./agentActivity";
import type { AgentActivityEvent, AgentActivityLogFilter } from "./agentActivity";
import {
  normalizeTerminalPaneLabel,
  terminalPaneCwdLabel,
  terminalPaneLabelForDisplay,
  terminalPaneProjectStatus as projectStatusFromTerminalPanes,
  terminalPaneStateLabel,
} from "./terminalPane";
import type { TerminalPaneState } from "./terminalPane";
import {
  decorateFileTreeWithGitStatus,
  absolutePathForGitFile,
  gitStatusLabel,
} from "./fileGitStatus";
import type { FileGitStatus, GitStatusFile } from "./fileGitStatus";
import { parseUnifiedDiff } from "./diffView";
import type { ParsedDiff } from "./diffView";
import {
  normalizePaneLayoutsBySession,
  normalizeSessionEditorSnapshots,
  paneLayoutFromPanes,
} from "./sessionRestore";
import type { PaneLayoutsBySession } from "./sessionRestore";
import type { ToolTrayMode, WorkbenchLayoutMode } from "./workbenchLayout";
import { useWorkbenchLayout } from "./useWorkbenchLayout";
import { terminalSnapshotText } from "./terminalTranscript";
import { migrateWorkspaceStore } from "./workspaceMigrations";
import { SettingsModal } from "./SettingsModal";
import { crashRecoveryMessage, deriveCrashRecovery } from "./crashRecovery";
import {
  addWorktree,
  normalizeWorktrees,
  removeWorktreeByPaneId,
  worktreeForPaneId,
  type WorktreeRecord,
} from "./worktrees";
import { normalizeSourceControlStatus, type SourceControlStatus } from "./sourceControl";
import {
  normalizeAgentConnectionsStatus,
  structuredChatProviderId,
  type AgentConnectionsStatus,
} from "./agentConnections";
import {
  CONNECTION_PROVIDER_IDS,
  DEFAULT_AI_CONNECTION_SETTINGS,
  environmentSecretKey,
  mcpSecretKey,
  normalizeAiConnectionSettings,
  providerSecretKey,
  type AiConnectionSettings,
  type ConnectionSecretStatus,
  type ConnectionTargetStatus,
  type McpServerConfig,
} from "./connectionSettings";
import { parseRemoteUrl, type RepoLocation } from "./sourceControlLinks";
import { imeCaretStyle } from "./terminalIme";
import { buildSnapshot, createRenderPerfState, recordFrameTime, recordIpcPayloadBytes } from "./renderPerf";
import {
  addBackgroundExit,
  backgroundExitCountForProject,
  clearBackgroundExitsForProject,
  isBackgroundExit,
  notificationBody,
  type BackgroundExit,
} from "./backgroundExits";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import {
  addPaneTranscript,
  buildPaneTranscript,
  normalizePaneTranscripts,
  transcriptsForSession,
  transcriptTimeLabel,
  type PaneTranscript,
} from "./paneTranscripts";
import { nextTerminalFindIndex, terminalFindCountLabel, terminalFindHitLabel } from "./terminalFind";
import type { TerminalFindHit } from "./terminalFind";
import { ChatThreadSurface } from "./ChatThreadSurface";
import {
  appendUserChatMessage,
  applyChatRunEnvelope,
  chatTitleFromPrompt,
  emptyChatConversation,
  normalizeChatConversationRecords,
  startChatRun,
} from "./chatConversation";
import type { ChatConversation, ChatConversationRecords, ChatMessage, ChatRunEnvelope } from "./chatConversation";
import {
  deleteDurableChatConversation,
  deleteDurableProjectChats,
  loadDurableChatConversations,
  migrateLegacyChatConversations,
  resetDurableChatStore,
  saveDurableChatConversation,
  searchDurableChatMessages,
} from "./chatStore";
import { mergeChatDiscoveryResults, type ChatSearchResult, type ChatSearchViewResult } from "./chatDiscovery";
import { ToolDockMenu } from "./ToolDockMenu";
import { ToolTrayTabs } from "./ToolTrayTabs";
import { ContextMenu, type ContextMenuItem, type ContextMenuState } from "./ContextMenu";
import { paneContextBelongsToProject, paneContextKey, paneContextParts, removeProjectPaneContexts } from "./paneOwnership";
import "./App.css";

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
type ManagedTerminalPane = {
  id: number;
  profile: LaunchProfile;
  cwd: string;
  slot: number;
  label: string | null;
  state: TerminalPaneState;
  exitCode: number | null;
  createdAt: number;
};
type TerminalPanesByContext = Record<string, ManagedTerminalPane[]>;
type ActiveTerminalPaneByContext = Record<string, number>;
type PaneLabelRecord = { slot: number; label: string; updatedAt: number };
type PaneLabelsBySession = Record<string, PaneLabelRecord[]>;
type FileTreeNode = {
  id: string;
  name: string;
  path: string;
  kind: "directory" | "file";
  dirty?: boolean;
  gitStatus?: FileGitStatus;
  children?: FileTreeNode[];
};
type FileTreeResponse = { root: string; nodes: FileTreeNode[]; truncated: boolean };
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
type WorkspaceTextSearchMatch = {
  path: string;
  relativePath: string;
  line: number;
  column: number;
  lineText: string;
};
type GitFileAction = "stage" | "unstage" | "discard";
type ActiveDiffReview = {
  file: GitStatusFile;
  absolutePath: string;
  response: GitDiffResponse;
  parsed: ParsedDiff;
};
type OpenEditorFileOptions = { focusEditor?: boolean };
type SaveEditorFileOptions = { force?: boolean };
type AgentSurfaceMode = "chat" | "terminal";
type UtilityTrayMode = "terminal" | "processes" | "logs";
type SideDrawerMode = "projects" | "files" | "search" | "git" | "browser" | "settings";
type DrawerSearchScope = "chats" | "files" | "text";
type DetectedLocalDevServer = {
  url: string;
  paneId: number;
  projectId: string;
  projectSessionId: string;
  paneLabel: string;
  detectedAt: number;
};
type EditorBuffer = EditorBufferSnapshot & {
  bytes: number | null;
  modifiedMs: number | null;
  error: string | null;
  recoveryError: string | null;
};
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
type CommandPaletteCommand = CommandPaletteCommandBase & {
  icon: AppIconName;
  run: () => void;
};

const FONT_SIZE = 15;
// JetBrains Mono has no CJK glyphs; chain macOS's bundled CJK system fonts
// ahead of the generic monospace fallback so unmatched glyphs (e.g. agent
// output containing Chinese/Japanese/Korean text) render instead of tofu.
const FONT_FAMILY = '"JetBrains Mono", "PingFang SC", "Hiragino Sans", "Apple SD Gothic Neo", monospace';
const LINE_HEIGHT = 1.25;
const COMPOSER_REASONING_OPTIONS: { value: ComposerReasoningEffort; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Extra high" },
];

const composerApprovalLabel = (mode: AgentApprovalMode) =>
  mode === "fullAccess" ? "Full access" : mode === "approveSafe" ? "Approve" : "Ask";

const composerReasoningLabel = (effort: ComposerReasoningEffort) =>
  COMPOSER_REASONING_OPTIONS.find((option) => option.value === effort)?.label ?? "Default";
const rgb = (c: [number, number, number]) => `rgb(${c[0]},${c[1]},${c[2]})`;
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
  { id: "search", label: "Search", icon: "search" },
  { id: "git", label: "Git", icon: "git" },
  { id: "browser", label: "Browser", icon: "browser" },
  { id: "settings", label: "Settings", icon: "settings" },
];
const normalizePaneLabelsBySession = (value: unknown): PaneLabelsBySession => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, rawRecords]) => {
        if (!Array.isArray(rawRecords)) return [key, []] as const;
        const records = rawRecords.flatMap((record): PaneLabelRecord[] => {
          if (!record || typeof record !== "object") return [];
          const data = record as { slot?: unknown; label?: unknown; updatedAt?: unknown };
          const slot = typeof data.slot === "number" && Number.isInteger(data.slot) && data.slot >= 0 ? data.slot : null;
          const label = normalizeTerminalPaneLabel(data.label);
          if (slot == null || !label) return [];
          return [{ slot, label, updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : 0 }];
        });
        return [key, records] as const;
      })
      .filter(([, records]) => records.length > 0),
  );
};

const menuItem = (
  id: string,
  label: string,
  onSelect: () => void,
  options: Pick<ContextMenuItem, "shortcut" | "icon" | "disabled" | "danger"> = {},
): ContextMenuItem => ({ id, label, onSelect, ...options });

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

function FileTreeRow({ node, style, dragHandle }: NodeRendererProps<FileTreeNode>) {
  const isDirectory = node.data.kind === "directory";
  const gitStatus = node.data.gitStatus;
  const isDeleted = gitStatus?.code === "deleted";
  const title = [node.data.path, node.data.dirty ? "Unsaved changes" : null, gitStatus ? `Git: ${gitStatus.label}` : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <div
      ref={dragHandle}
      style={style}
      className={`file-node ${node.isSelected ? "file-node--selected" : ""} ${gitStatus ? `file-node--git-${gitStatus.code}` : ""}`}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        if (isDirectory) {
          node.toggle();
        } else if (isDeleted) {
          node.select();
        } else {
          node.select();
          node.activate();
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        window.dispatchEvent(
          new CustomEvent("file-tree-context-menu", {
            detail: { node: node.data, x: event.clientX, y: event.clientY },
          }),
        );
      }}
    >
      <span className="file-node__twisty" aria-hidden="true">
        {isDirectory ? <AppIcon name={node.isOpen ? "chevronDown" : "chevronRight"} /> : null}
      </span>
      <span className={`file-node__icon file-node__icon--${node.data.kind}`} aria-hidden="true">
        <AppIcon name={isDirectory ? (node.isOpen ? "folderOpen" : "folder") : "file"} />
      </span>
      <span className="file-node__name" title={title}>
        {node.data.name}
      </span>
      {gitStatus ? (
        <span className={`file-node__git file-node__git--${gitStatus.code}`} aria-label={`Git status: ${gitStatus.label}`}>
          {gitStatus.token}
        </span>
      ) : null}
      {node.data.dirty ? <span className="file-node__dirty" aria-label="Unsaved changes" /> : null}
    </div>
  );
}

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
  const intentionallyTerminatedPaneIdsRef = useRef<Set<number>>(new Set());
  const terminalPanesRef = useRef<ManagedTerminalPane[]>([]);
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
  const commandPaletteInputRef = useRef<HTMLInputElement | null>(null);
  const quickOpenInputRef = useRef<HTMLInputElement | null>(null);
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
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandPaletteQuery, setCommandPaletteQuery] = useState("");
  const [commandPaletteActiveIndex, setCommandPaletteActiveIndex] = useState(0);
  const [commandPaletteSources, setCommandPaletteSources] = useState({ ...DEFAULT_COMMAND_PALETTE_SOURCES });
  const [terminalFindOpen, setTerminalFindOpen] = useState(false);
  const [terminalFindQuery, setTerminalFindQuery] = useState("");
  const [terminalFindHits, setTerminalFindHits] = useState<TerminalFindHit[]>([]);
  const [terminalFindIndex, setTerminalFindIndex] = useState<number | null>(null);
  const [terminalFindBusy, setTerminalFindBusy] = useState(false);
  const [terminalFindError, setTerminalFindError] = useState<string | null>(null);
  const [terminalFindLastQuery, setTerminalFindLastQuery] = useState("");
  const [composerNotice, setComposerNotice] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sourceControlStatus, setSourceControlStatus] = useState<SourceControlStatus | null>(null);
  const [agentConnectionsStatus, setAgentConnectionsStatus] = useState<AgentConnectionsStatus | null>(null);
  const [agentConnectionsRefreshing, setAgentConnectionsRefreshing] = useState(false);
  const [aiConnectionSettings, setAiConnectionSettings] = useState<AiConnectionSettings>(DEFAULT_AI_CONNECTION_SETTINGS);
  const [connectionSecretPresence, setConnectionSecretPresence] = useState<Record<string, boolean>>({});
  const [repoLocation, setRepoLocation] = useState<RepoLocation | null>(null);
  const [crashNotice, setCrashNotice] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [worktrees, setWorktrees] = useState<WorktreeRecord[]>([]);
  const [backgroundExits, setBackgroundExits] = useState<BackgroundExit[]>([]);
  const [paneTranscripts, setPaneTranscripts] = useState<PaneTranscript[]>([]);
  const [transcriptsOpen, setTranscriptsOpen] = useState(false);
  const [openTranscriptId, setOpenTranscriptId] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const notificationsEnabledRef = useRef(false);
  useEffect(() => {
    notificationsEnabledRef.current = notificationsEnabled;
  }, [notificationsEnabled]);
  const [keybindingOverrides, setKeybindingOverrides] = useState<KeybindingOverrides>({});
  const [appTheme, setAppTheme] = useState<"graphite" | "mono-ghost">("graphite");

  useEffect(() => {
    if (appTheme === "mono-ghost") {
      document.documentElement.dataset.theme = "mono-ghost";
    } else {
      delete document.documentElement.dataset.theme;
    }
  }, [appTheme]);

  useEffect(() => {
    if (!actionNotice) return;
    const timeout = window.setTimeout(() => setActionNotice(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [actionNotice]);

  useEffect(() => {
    if (!settingsOpen) return;
    let cancelled = false;
    invoke<unknown>("source_control_status")
      .then((result) => {
        if (!cancelled) setSourceControlStatus(normalizeSourceControlStatus(result));
      })
      .catch(() => {
        if (!cancelled) setSourceControlStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, [settingsOpen]);

  const refreshAgentConnections = () => {
    setAgentConnectionsRefreshing(true);
    invoke<unknown>("agent_connections_status")
      .then((result) => setAgentConnectionsStatus(normalizeAgentConnectionsStatus(result)))
      .catch(() => setAgentConnectionsStatus(null))
      .finally(() => setAgentConnectionsRefreshing(false));
  };

  useEffect(() => {
    if (settingsOpen) refreshAgentConnections();
  }, [settingsOpen]);

  useEffect(() => {
    if (!settingsOpen || !workspacePath) {
      setRepoLocation(null);
      return;
    }
    let cancelled = false;
    invoke<string | null>("git_remote_url", { root: workspacePath })
      .then((url) => {
        if (!cancelled) setRepoLocation(url ? parseRemoteUrl(url) : null);
      })
      .catch(() => {
        if (!cancelled) setRepoLocation(null);
      });
    return () => {
      cancelled = true;
    };
  }, [settingsOpen, workspacePath]);
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
    appShellStyle,
    beginSideDrawerResize,
    beginWorkbenchResize,
    nudgeSideDrawerResize,
    nudgeWorkbenchResize,
    resetWorkbenchLayout,
    renderedWorkbenchLayout,
    setSideDrawerCollapsed,
    setToolTrayMode,
    setWorkbenchLayout,
    sideDrawerCollapsed,
    toolTrayMode,
    workbenchLayout,
    workbenchRef,
    workbenchSizing,
    workbenchStyle,
  } = useWorkbenchLayout();
  const [agentSurfaceMode, setAgentSurfaceMode] = useState<AgentSurfaceMode>("chat");
  const [utilityTrayMode, setUtilityTrayMode] = useState<UtilityTrayMode>("terminal");
  const [utilityTrayHeight, setUtilityTrayHeight] = useState(260);
  const [sideDrawerMode, setSideDrawerMode] = useState<SideDrawerMode>("projects");
  const resetInterface = () => {
    resetWorkbenchLayout();
    setSideDrawerMode("projects");
    setAgentSurfaceMode("chat");
    setUtilityTrayMode("terminal");
    setUtilityTrayHeight(260);
    setSettingsOpen(false);
  };
  const beginUtilityTrayResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.classList.add("is-resizing-workbench");
    const move = (pointerEvent: PointerEvent) => {
      const rect = workbenchRef.current?.getBoundingClientRect();
      if (!rect) return;
      setUtilityTrayHeight(Math.round(Math.max(150, Math.min(rect.height * 0.65, rect.bottom - pointerEvent.clientY))));
    };
    const stop = () => {
      document.body.classList.remove("is-resizing-workbench");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };
  const [drawerSearchQuery, setDrawerSearchQuery] = useState("");
  const [drawerSearchScope, setDrawerSearchScope] = useState<DrawerSearchScope>("files");
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [chatSearchBookmarksOnly, setChatSearchBookmarksOnly] = useState(false);
  const [chatSearchResults, setChatSearchResults] = useState<ChatSearchResult[]>([]);
  const [chatSearchLoading, setChatSearchLoading] = useState(false);
  const [chatSearchError, setChatSearchError] = useState<string | null>(null);
  const [chatSearchRevision, setChatSearchRevision] = useState(0);
  const [focusedChatMessageId, setFocusedChatMessageId] = useState<string | null>(null);
  const [textSearchResults, setTextSearchResults] = useState<WorkspaceTextSearchMatch[]>([]);
  const [textSearchLoading, setTextSearchLoading] = useState(false);
  const [textSearchError, setTextSearchError] = useState<string | null>(null);
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);
  const [quickOpenQuery, setQuickOpenQuery] = useState("");
  const [quickOpenActiveIndex, setQuickOpenActiveIndex] = useState(0);
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
      chatSearchQuery,
      chatSearchBookmarksOnly,
    ),
    [chatConversations, chatSearchBookmarksOnly, chatSearchQuery, chatSearchResults, projectSessions],
  );
  const quickOpenResults = useMemo(() => filterWorkspaceFiles(searchableFiles, quickOpenQuery, 80), [quickOpenQuery, searchableFiles]);
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
  const activeTerminalPane = useMemo(
    () => terminalPanes.find((pane) => pane.id === activeTerminalPaneId) ?? null,
    [activeTerminalPaneId, terminalPanes],
  );
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
  const selectedAgentActivityLog = useMemo(() => {
    if (!activeAgentSessionDescriptor) return [];
    return filterAgentActivityEvents(
      agentActivityEvents.filter(
        (event) =>
          event.projectId === activeAgentSessionDescriptor.projectId &&
          event.projectSessionId === activeAgentSessionDescriptor.projectSessionId &&
          event.paneId === activeAgentSessionDescriptor.id,
      ),
      agentActivityFilter,
    );
  }, [activeAgentSessionDescriptor, agentActivityEvents, agentActivityFilter]);
  const activeTerminalProfile = activeTerminalPane?.profile ?? terminalLaunchProfile;
  const terminalPaneState = activeTerminalPane?.state ?? "idle";
  const terminalExitCode = activeTerminalPane?.exitCode ?? null;
  const terminalStatusLabel = terminalPaneStateLabel(terminalPaneState, terminalExitCode);
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
    if (drawerSearchScope !== "chats") return;
    const query = chatSearchQuery.trim();
    if (!chatSearchBookmarksOnly && query.length < 2) {
      setChatSearchResults([]);
      setChatSearchError(null);
      setChatSearchLoading(false);
      return;
    }
    let cancelled = false;
    setChatSearchLoading(true);
    setChatSearchError(null);
    const timer = window.setTimeout(() => {
      searchDurableChatMessages(query, chatSearchBookmarksOnly, 80)
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
  }, [chatSearchBookmarksOnly, chatSearchQuery, chatSearchRevision, drawerSearchScope]);

  useEffect(() => {
    if (drawerSearchScope !== "text") return;
    const root = workspacePathRef.current ?? workspacePath;
    const query = drawerSearchQuery.trim();
    if (!root || query.length < 2) {
      setTextSearchResults([]);
      setTextSearchError(null);
      setTextSearchLoading(false);
      return;
    }
    let cancelled = false;
    setTextSearchLoading(true);
    setTextSearchError(null);
    const timer = window.setTimeout(() => {
      invoke<WorkspaceTextSearchMatch[]>("search_workspace_text", { root, query, maxMatches: 80 })
        .then((results) => {
          if (!cancelled) setTextSearchResults(results);
        })
        .catch((err) => {
          if (!cancelled) {
            setTextSearchResults([]);
            setTextSearchError(String(err));
          }
        })
        .finally(() => {
          if (!cancelled) setTextSearchLoading(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [drawerSearchQuery, drawerSearchScope, workspacePath]);

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

  const openTextSearchResult = (match: WorkspaceTextSearchMatch) => {
    void requestOpenEditorFile(fileNodeFromPath(match.path, "file"), { focusEditor: true }).then(() => {
      focusEditorLine(match.line);
    });
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
    if (sideDrawerMode === "files" || sideDrawerMode === "search" || sideDrawerMode === "git") {
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
    handle: AgentSessionHandleDescriptor | null = activeAgentSessionDescriptor,
  ) => {
    const audit = await resolveAppAction(action, agentApprovalMode, (_action, message) => window.confirm(message));
    if (shouldLogAppActionAudit(audit)) {
      recordAgentActivity(handle, {
        kind: "approval",
        label: appActionAuditLabel(audit),
        detail: audit.label,
        target: audit.target,
        undoHint: audit.undoHint,
        status: audit.decision === "approved" ? "complete" : "error",
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
      const preparedSessions = ensureProjectSessions(projectSessionsRef.current, path, Date.now());
      const requestedSessionId = activeProjectSessionId(activeSessionByProjectRef.current, preparedSessions, path);
      const preparedActiveSessions = requestedSessionId
        ? setActiveProjectSession(activeSessionByProjectRef.current, path, requestedSessionId)
        : activeSessionByProjectRef.current;
      projectSessionsRef.current = preparedSessions;
      activeSessionByProjectRef.current = preparedActiveSessions;
      const existingPanes = terminalPanesForSession(path, requestedSessionId);
      const requestedLayout = requestedSessionId ? paneLayoutsBySessionRef.current[sessionSnapshotKey(path, requestedSessionId)] : null;
      const fallbackLayout = [{ slot: 0, profileId: defaultTerminalLaunchProfile().id, label: savedPaneLabelForSlot(path, 0, requestedSessionId) }];
      const initialLayout = requestedLayout && requestedLayout.length > 0 ? requestedLayout : fallbackLayout;
      let root = path;
      let nextProjectPanes = existingPanes;
      let nextActivePaneId = activePaneForSession(path, requestedSessionId, existingPanes);
      if (existingPanes.length > 0 && nextActivePaneId != null) {
        await invoke("focus_pane", { paneId: nextActivePaneId });
      } else if (agentSurfaceMode === "terminal") {
        const firstLayout = initialLayout[0] ?? fallbackLayout[0];
        const firstProfile = resolveLaunchProfile(firstLayout.profileId);
        const result = await invoke<OpenWorkspaceResponse>("open_workspace", { path, profile: firstProfile });
        root = result.root;
        const layout = requestedSessionId
          ? paneLayoutsBySessionRef.current[sessionSnapshotKey(root, requestedSessionId)] ?? initialLayout
          : initialLayout;
        const [firstRecord, ...restRecords] = layout.length > 0 ? layout : fallbackLayout;
        const pane = {
          id: result.paneId,
          profile: firstProfile,
          cwd: root,
          slot: firstRecord.slot,
          label: firstRecord.label ?? savedPaneLabelForSlot(root, firstRecord.slot, requestedSessionId),
          state: "running" as TerminalPaneState,
          exitCode: null,
          createdAt: Date.now(),
        };
        nextProjectPanes = [pane];
        nextActivePaneId = result.paneId;
        for (const record of restRecords) {
          const paneProfile = resolveLaunchProfile(record.profileId);
          const nextPane = await invoke<OpenPaneResponse>("create_pane", { path: root, profile: paneProfile });
          nextProjectPanes = [
            ...nextProjectPanes,
            {
              id: nextPane.paneId,
              profile: paneProfile,
              cwd: root,
              slot: record.slot,
              label: record.label ?? savedPaneLabelForSlot(root, record.slot, requestedSessionId),
              state: "running" as TerminalPaneState,
              exitCode: null,
              createdAt: Date.now(),
            },
          ];
        }
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
      const nextRecent = pushRecentProject(recentProjectsRef.current, root);
      const previousStatus = previousRoot ? projectStatusForRoot(previousRoot) : "exited";
      const nextOpen = upsertOpenProject(
        previousRoot && previousRoot !== root ? setOpenProjectStatus(openProjectsRef.current, previousRoot, previousStatus) : openProjectsRef.current,
        root,
        projectStatusForRoot(root),
      );
      let nextSessions = projectSessionsRef.current;
      let nextActiveSessions = activeSessionByProjectRef.current;
      if (previousRoot && previousRoot !== root) {
        const previousSessionId = activeProjectSessionId(nextActiveSessions, nextSessions, previousRoot);
        if (previousSessionId) nextSessions = setProjectSessionStatus(nextSessions, previousRoot, previousSessionId, previousStatus, now);
      }
      nextSessions = ensureProjectSessions(nextSessions, root, now);
      const sessionId = activeProjectSessionId(nextActiveSessions, nextSessions, root);
      if (sessionId) {
        nextActiveSessions = setActiveProjectSession(nextActiveSessions, root, sessionId);
        nextSessions = setProjectSessionStatus(nextSessions, root, sessionId, terminalPaneProjectStatus(nextProjectPanes), now);
      }
      persistPaneLayoutForSession(root, sessionId, nextProjectPanes);
      recentProjectsRef.current = nextRecent;
      openProjectsRef.current = nextOpen;
      projectSessionsRef.current = nextSessions;
      activeSessionByProjectRef.current = nextActiveSessions;
      setRecentProjects(nextRecent);
      setOpenProjects(nextOpen);
      setProjectSessions(nextSessions);
      setActiveSessionByProjectState(nextActiveSessions);
      await store?.set("launchProfile", profile);
      await store?.set("folder", root);
      await store?.set("recentFolders", nextRecent);
      await store?.set("openProjects", nextOpen);
      await store?.set("projectSessions", nextSessions);
      await store?.set("activeSessionByProject", nextActiveSessions);
      await store?.save();
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
        const nextRecent = removeRecentProject(recentProjectsRef.current, path);
        const nextOpen = removeOpenProject(openProjectsRef.current, path);
        const { [path]: _removedSessions, ...nextSessions } = projectSessionsRef.current;
        const { [path]: _removedActiveSession, ...nextActiveSessions } = activeSessionByProjectRef.current;
        const nextProjectPanesByContext = removeProjectPaneContexts(terminalPanesByContextRef.current, path);
        const nextActivePanesByContext = removeProjectPaneContexts(activeTerminalPaneByContextRef.current, path);
        const { [path]: _removedBrowserProject, ...nextBrowserProjects } = browserPreviewByProjectRef.current;
        const nextBrowserSessions = Object.fromEntries(
          Object.entries(browserPreviewBySessionRef.current).filter(([key]) => !key.startsWith(`${path}\n`)),
        );
        const nextComposerHarness = Object.fromEntries(
          Object.entries(composerHarnessBySessionRef.current).filter(([key]) => !key.startsWith(`${path}\n`)),
        );
        const nextChatConversations = Object.fromEntries(
          Object.entries(chatConversationsRef.current).filter(([key]) => !key.startsWith(`${path}\n`)),
        );
        const nextSessionSnapshots = Object.fromEntries(
          Object.entries(sessionEditorSnapshotsRef.current).filter(([key]) => !key.startsWith(`${path}\n`)),
        );
        const nextPaneLayouts = Object.fromEntries(
          Object.entries(paneLayoutsBySessionRef.current).filter(([key]) => !key.startsWith(`${path}\n`)),
        );
        recentProjectsRef.current = nextRecent;
        openProjectsRef.current = nextOpen;
        projectSessionsRef.current = nextSessions;
        activeSessionByProjectRef.current = nextActiveSessions;
        terminalPanesByContextRef.current = nextProjectPanesByContext;
        activeTerminalPaneByContextRef.current = nextActivePanesByContext;
        browserPreviewByProjectRef.current = nextBrowserProjects;
        browserPreviewBySessionRef.current = nextBrowserSessions;
        composerHarnessBySessionRef.current = nextComposerHarness;
        chatConversationsRef.current = nextChatConversations;
        sessionEditorSnapshotsRef.current = nextSessionSnapshots;
        paneLayoutsBySessionRef.current = nextPaneLayouts;
        setRecentProjects(nextRecent);
        setOpenProjects(nextOpen);
        setProjectSessions(nextSessions);
        setActiveSessionByProjectState(nextActiveSessions);
        setBrowserPreviewByProject(nextBrowserProjects);
        setBrowserPreviewBySession(nextBrowserSessions);
        setComposerHarnessBySession(nextComposerHarness);
        setChatConversations(nextChatConversations);
        await store?.set("recentFolders", nextRecent);
        await store?.set("openProjects", nextOpen);
        await store?.set("projectSessions", nextSessions);
        await store?.set("activeSessionByProject", nextActiveSessions);
        await store?.set("browserPreviewByProject", nextBrowserProjects);
        await store?.set("browserPreviewBySession", nextBrowserSessions);
        await store?.set("composerHarnessBySession", nextComposerHarness);
        await deleteDurableProjectChats(path).catch((error) => {
          void invoke("log_health_event", { message: `delete project chats failed: ${String(error)}` }).catch(() => {});
        });
        await store?.set("sessionEditorSnapshots", nextSessionSnapshots);
        await store?.set("paneLayoutsBySession", nextPaneLayouts);
        if (workspacePathRef.current === path) {
          setManagedTerminalPanes([]);
          setFocusedTerminalPane(null);
          setWorkspacePath(null);
          setFileTree([]);
          resetEditor();
        }
        await store?.delete("folder");
        await store?.save();
      } else {
        const nextOpen = upsertOpenProject(openProjectsRef.current, path, "attention");
        const now = Date.now();
        let nextSessions = ensureProjectSessions(projectSessionsRef.current, path, now);
        let nextActiveSessions = activeSessionByProjectRef.current;
        const sessionId = activeProjectSessionId(nextActiveSessions, nextSessions, path);
        if (sessionId) {
          nextActiveSessions = setActiveProjectSession(nextActiveSessions, path, sessionId);
          nextSessions = setProjectSessionStatus(nextSessions, path, sessionId, "attention", now);
        }
        openProjectsRef.current = nextOpen;
        projectSessionsRef.current = nextSessions;
        activeSessionByProjectRef.current = nextActiveSessions;
        setOpenProjects(nextOpen);
        setProjectSessions(nextSessions);
        setActiveSessionByProjectState(nextActiveSessions);
        await store?.set("openProjects", nextOpen);
        await store?.set("projectSessions", nextSessions);
        await store?.set("activeSessionByProject", nextActiveSessions);
        await store?.save();
      }
      return false;
    }
  };

  const requestOpenWorkspace = async (path: string) => {
    setBackgroundExits((exits) => clearBackgroundExitsForProject(exits, path));
    if (dirtyTabPaths.length > 1) {
      const ok = window.confirm(`Switch workspace and discard ${dirtyTabPaths.length} unsaved editor tabs?`);
      if (!ok) return false;
    } else if (dirtyTabPaths.length === 1) {
      const dirtyTab = editorTabs.find((tab) => tab.path === dirtyTabPaths[0]);
      if (dirtyTab && dirtyTab.path !== selectedFileRef.current?.path) {
        await openEditorFileDirect(dirtyTab);
      }
      setDraftDialogError(null);
      setPendingNavigation({ kind: "workspace", path });
      return false;
    } else if (shouldPromptForDirtyDraft(editorDirty, selectedFileRef.current?.path ?? null, { kind: "workspace", path })) {
      setDraftDialogError(null);
      setPendingNavigation({ kind: "workspace", path });
      return false;
    }
    return openWorkspaceDirect(path);
  };

  const closeProjectResources = async (projectPath: string) => {
    const activeRunIds = Object.entries(chatConversationsRef.current)
      .filter(([key, conversation]) => key.startsWith(`${projectPath}\n`) && conversation.activeRunId)
      .map(([, conversation]) => conversation.activeRunId as string);
    for (const runId of activeRunIds) await invoke("stop_chat_run", { runId });

    for (const pane of terminalPanesForProject(projectPath)) {
      intentionallyTerminatedPaneIdsRef.current.add(pane.id);
      try {
        await invoke("close_pane", { paneId: pane.id });
      } catch (error) {
        intentionallyTerminatedPaneIdsRef.current.delete(pane.id);
        throw error;
      }
      delete terminalSnapshotsRef.current[pane.id];
    }
    terminalPanesByContextRef.current = removeProjectPaneContexts(terminalPanesByContextRef.current, projectPath);
    activeTerminalPaneByContextRef.current = removeProjectPaneContexts(activeTerminalPaneByContextRef.current, projectPath);
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
    if ((runCount > 0 || paneCount > 0) && !window.confirm(`Close ${basename(project.path)} and stop ${runCount + paneCount} running task${runCount + paneCount === 1 ? "" : "s"}?`)) {
      return false;
    }
    if (project.path === workspacePathRef.current && dirtyTabPaths.length === 1 && selectedFileRef.current) {
      setDraftDialogError(null);
      setPendingNavigation({ kind: "close-project", projectPath: project.path });
      return false;
    }
    if (project.path === workspacePathRef.current && dirtyTabPaths.length > 1 && !window.confirm(`Close ${basename(project.path)} with ${dirtyTabPaths.length} unsaved editor tabs?`)) {
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

  const deleteProjectSession = async (projectPath: string, session: ProjectSession) => {
    const existing = projectSessionsRef.current[projectPath] ?? [];
    if (existing.length <= 1) return;
    const ok = window.confirm(`Delete chat "${session.title}"? Its messages and saved workspace context will be removed.`);
    if (!ok) return;
    const contextKey = paneContextKey(projectPath, session.id);
    const ownedPanes = terminalPanesForSession(projectPath, session.id);
    try {
      for (const pane of ownedPanes) {
        intentionallyTerminatedPaneIdsRef.current.add(pane.id);
        try {
          await invoke("close_pane", { paneId: pane.id });
        } catch (error) {
          intentionallyTerminatedPaneIdsRef.current.delete(pane.id);
          throw error;
        }
        delete terminalSnapshotsRef.current[pane.id];
      }
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
    if (contextKey) {
      const { [contextKey]: _removedPanes, ...nextPaneContexts } = terminalPanesByContextRef.current;
      const { [contextKey]: _removedActive, ...nextActiveContexts } = activeTerminalPaneByContextRef.current;
      terminalPanesByContextRef.current = nextPaneContexts;
      activeTerminalPaneByContextRef.current = nextActiveContexts;
    }
    const nextSessions = removeProjectSession(projectSessionsRef.current, projectPath, session.id);
    const fallbackSessionId = activeProjectSessionId(activeSessionByProjectRef.current, nextSessions, projectPath);
    const nextActiveSessions = fallbackSessionId
      ? setActiveProjectSession(activeSessionByProjectRef.current, projectPath, fallbackSessionId)
      : activeSessionByProjectRef.current;
    removePersistedSessionRestore(projectPath, session.id);
    const nextBrowserSessions = { ...browserPreviewBySessionRef.current };
    delete nextBrowserSessions[browserPreviewSessionKey(projectPath, session.id)];
    const nextComposerHarness = { ...composerHarnessBySessionRef.current };
    delete nextComposerHarness[composerHarnessSessionKey(projectPath, session.id)];
    const nextChatConversations = { ...chatConversationsRef.current };
    delete nextChatConversations[composerHarnessSessionKey(projectPath, session.id)];
    chatConversationsRef.current = nextChatConversations;
    setChatConversations(nextChatConversations);
    browserPreviewBySessionRef.current = nextBrowserSessions;
    setBrowserPreviewBySession(nextBrowserSessions);
    await storeRef.current?.set("browserPreviewBySession", nextBrowserSessions);
    await persistComposerHarnessRecords(nextComposerHarness);
    await persistProjectSessions(nextSessions, nextActiveSessions);
    if (workspacePathRef.current === projectPath && activeSessionId === session.id) {
      await openWorkspaceDirect(projectPath, launchProfileRef.current, { captureCurrentSession: false });
    }
  };

  const pickWorkspace = async () => {
    const dir = await open({ directory: true });
    if (typeof dir !== "string") return;
    await requestOpenWorkspace(dir);
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
      const result = await invoke<OpenPaneResponse>("restart_pane", { path: root, paneId: pane.id, profile: pane.profile });
      const nextPanes = terminalPanesForSession(root, sessionId).map((item) =>
        item.id === pane.id
          ? { ...item, id: result.paneId, state: "running" as TerminalPaneState, exitCode: null, createdAt: Date.now() }
          : item,
      );
      delete terminalSnapshotsRef.current[pane.id];
      latest.current = null;
      setSessionTerminalPanes(root, sessionId, nextPanes, result.paneId);
      requestTerminalPaintRef.current();
      setLaunchError(null);
      setTimeout(sendTerminalResize, 0);
      await updateOpenProjectStatus(root, projectStatusForRoot(root));
      await updateActiveSessionStatus(root, terminalPaneProjectStatus(nextPanes));
      const restarted = nextPanes.find((item) => item.id === result.paneId);
      if (restarted && sessionId) {
        recordAgentActivity(
          buildAgentSessionHandleDescriptor({
            pane: restarted,
            projectId: root,
            projectSessionId: sessionId,
            label,
            approvalMode: agentApprovalMode,
          }),
          {
            kind: "process",
            label: "Restarted process",
            detail: launchProfileCommandLine(pane.profile),
            target: pane.cwd,
            status: "running",
          },
        );
      }
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

  const composerAppAction = (command: ComposerAppCommand): AppActionDescriptor => {
    if (command === "save") {
      return createAppAction({
        kind: "save-file",
        label: "Save file",
        target: selectedFileRef.current?.path,
        risk: "high",
        requestedBy: "composer",
        undoHint: "Use editor undo or revert the file from source control.",
      });
    }
    if (command === "find") {
      return createAppAction({
        kind: "find-in-file",
        label: "Find in file",
        target: selectedFileRef.current?.path,
        risk: "low",
        requestedBy: "composer",
      });
    }
    if (command === "open-folder") {
      return createAppAction({
        kind: "open-folder",
        label: "Open folder picker",
        risk: "medium",
        requestedBy: "composer",
      });
    }
    return createAppAction({
      kind: "clear-terminal",
      label: "Clear terminal",
      target: activeTerminalPaneLabel ?? undefined,
      risk: "medium",
      requestedBy: "composer",
      undoHint: "Terminal scrollback is not restored by the app.",
    });
  };

  const runComposerAppCommand = async (command: ComposerAppCommand): Promise<boolean> => {
    if (command === "save") {
      if (!selectedFile) {
        setComposerError("No editor file is selected.");
        return false;
      }
      const audit = await gateAppAction(composerAppAction(command), activeAgentSessionHandle);
      if (audit.decision !== "approved") {
        setComposerError(`${audit.label} was ${audit.decision}.`);
        return false;
      }
      const ok = await saveEditorFile();
      if (!ok) {
        setComposerError("Save failed. The editor recovery panel has the details.");
        return false;
      }
      return true;
    }
    if (command === "find") {
      if (!selectedFile) {
        setComposerError("Open a file before using Find.");
        return false;
      }
      const audit = await gateAppAction(composerAppAction(command), activeAgentSessionHandle);
      if (audit.decision !== "approved") {
        setComposerError(`${audit.label} was ${audit.decision}.`);
        return false;
      }
      openEditorSearch();
      return true;
    }
    if (command === "open-folder") {
      const audit = await gateAppAction(composerAppAction(command), activeAgentSessionHandle);
      if (audit.decision !== "approved") {
        setComposerError(`${audit.label} was ${audit.decision}.`);
        return false;
      }
      await pickWorkspace();
      return true;
    }
    if (command === "clear-terminal") {
      const audit = await gateAppAction(composerAppAction(command), activeAgentSessionHandle);
      if (audit.decision !== "approved") {
        setComposerError(`${audit.label} was ${audit.decision}.`);
        return false;
      }
      await clearActiveTerminal();
      return true;
    }
    if (command === "help") {
      setComposerNotice(composerHelpText());
      return true;
    }
    return false;
  };

  const submitComposerDraft = async (draftOverride?: string) => {
    if (composerSending || activeChatConversation.activeRunId) return;
    const submittedDraft = draftOverride ?? composerDraft;
    const route = routeComposerDraft(submittedDraft);
    if (route.kind === "empty") return;
    if (route.kind === "unknown-app") {
      setComposerError(`Unknown app command ${route.input}. Try >help for the list.`);
      return;
    }
    setComposerSending(true);
    setComposerError(null);
    setComposerNotice(null);
    try {
      if (route.kind === "chat") {
        if (!workspacePathRef.current) {
          setComposerError("Open a workspace before starting a chat.");
          return;
        }
        const chatId = activeComposerHarnessKey;
        if (!chatId) {
          setComposerError("Create or select a chat before sending.");
          return;
        }
        const provider = structuredChatProviderId(activeComposerHarness.selectedProfileId);
        if (!provider) {
          const profile = resolveLaunchProfile(activeComposerHarness.selectedProfileId);
          setComposerError(`${profile.label} structured chat is not available yet. Open Raw terminal and select ${profile.label} to use its native CLI.`);
          return;
        }
        const preparedContext = await prepareChatContext(route.text, activeComposerHarness, {
          readFile: (attachment) => invoke<TextFileResponse>("read_chat_context_file", {
            root: workspacePathRef.current,
            path: attachment.target,
          }),
          inspectImage: (attachment) => invoke<ChatImageResponse>("inspect_chat_image", {
            path: attachment.target,
          }),
        });
        const previousConversation = chatConversationsRef.current[chatId] ?? emptyChatConversation();
        const runId = `chat-run-${crypto.randomUUID()}`;
        updateChatConversation(chatId, (conversation) =>
          startChatRun(appendUserChatMessage(conversation, route.text), runId)
        );
        const session = projectSessionsRef.current[workspacePathRef.current]?.find((item) => item.id === activeSessionId);
        if (session && (session.title === "Current work" || /^New (session|chat)( \d+)?$/.test(session.title))) {
          const title = chatTitleFromPrompt(route.text);
          const nextSessions = {
            ...projectSessionsRef.current,
            [workspacePathRef.current]: (projectSessionsRef.current[workspacePathRef.current] ?? []).map((item) =>
              item.id === session.id ? { ...item, title, updatedAt: Date.now() } : item
            ),
          };
          void persistProjectSessions(nextSessions, activeSessionByProjectRef.current);
        }
        await invoke("start_chat_run", {
          request: {
            runId,
            chatId,
            projectPath: workspacePathRef.current,
            provider,
            providerThreadId: previousConversation.providerThreadId ?? null,
            prompt: preparedContext.prompt,
            images: preparedContext.images,
            approvalMode: activeComposerHarness.approvalMode,
            model: activeComposerHarness.model.trim() || aiConnectionSettings.providerModels[provider].trim() || null,
            reasoningEffort: activeComposerHarness.reasoningEffort === "default" ? null : activeComposerHarness.reasoningEffort,
          },
        });
      } else {
        const ok = await runComposerAppCommand(route.command);
        if (!ok) {
          recordAgentActivity(activeAgentSessionHandle, {
            kind: "error",
            label: "Command failed",
            detail: route.command,
            status: "error",
          });
          return;
        }
        recordAgentActivity(activeAgentSessionHandle, {
          kind: "app",
          label: "Ran command",
          detail: route.command,
          status: "complete",
        });
      }
      const nextHistory = composerHistoryAfterSubmit(composerHistory, submittedDraft);
      setComposerLocalState(activeComposerHarnessKey, "", nextHistory);
      setComposerHistoryIndex(null);
      void updateActiveComposerHarness((state) => ({ ...state, draft: "", history: nextHistory }));
    } catch (err) {
      setComposerError(String(err));
      const chatId = activeComposerHarnessKey;
      if (chatId) {
        updateChatConversation(chatId, (conversation) => applyChatRunEnvelope(conversation, {
          runId: "launch-error",
          chatId,
          provider: "codex",
          stream: "lifecycle",
          event: { type: "run.completed", exitCode: 1, message: String(err) },
        }));
      }
    } finally {
      setComposerSending(false);
    }
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

  const setComposerModel = async (model: string, options: { log?: boolean } = {}) => {
    const next = await updateActiveComposerHarness((state) => ({ ...state, model: model.slice(0, 128) }));
    if (options.log && next?.model.trim()) logComposerHarnessEvent("Model override changed", next.model.trim());
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

  const focusTerminalPane = async (paneId: number) => {
    if (paneId === activeTerminalPaneIdRef.current) return;
    const pane = terminalPanesRef.current.find((item) => item.id === paneId);
    const audit = await gateAppAction(createAppAction({
      kind: "focus-pane",
      label: "Focus pane",
      target: pane ? terminalPaneLabelForDisplay(pane.label, pane.profile.label, pane.slot) : `pane:${paneId}`,
      risk: "low",
      requestedBy: "user",
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

  const createTerminalPane = async (profile: LaunchProfile = terminalLaunchProfileRef.current) => {
    const root = workspacePathRef.current ?? workspacePath;
    const sessionId = activeSessionForProject(root);
    if (!root || !sessionId || launchProfileChanging) return false;
    const audit = await gateAppAction(createAppAction({
      kind: "create-pane",
      label: "Create pane",
      target: `${profile.label} in ${root}`,
      risk: "medium",
      requestedBy: "user",
      undoHint: "Close the new pane.",
    }));
    if (audit.decision !== "approved") return false;
    setLaunchProfileChanging(true);
    try {
      const result = await invoke<OpenPaneResponse>("create_pane", { path: root, profile });
      const existingPanes = terminalPanesForSession(root, sessionId);
      const slot = existingPanes.length;
      const pane = {
        id: result.paneId,
        profile,
        cwd: root,
        slot,
        label: savedPaneLabelForSlot(root, slot),
        state: "running" as TerminalPaneState,
        exitCode: null,
        createdAt: Date.now(),
      };
      const nextPanes = [...existingPanes, pane];
      setSessionTerminalPanes(root, sessionId, nextPanes, result.paneId);
      if (sessionId) {
        recordAgentActivity(
          buildAgentSessionHandleDescriptor({
            pane,
            projectId: root,
            projectSessionId: sessionId,
            label: terminalPaneLabelForDisplay(pane.label, pane.profile.label, slot),
            approvalMode: agentApprovalMode,
          }),
          {
            kind: "process",
            label: "Created pane",
            detail: profile.label,
            status: "running",
          },
        );
      }
      terminalLaunchProfileRef.current = profile;
      setTerminalLaunchProfile(profile);
      await storeRef.current?.set("terminalLaunchProfile", profile);
      await storeRef.current?.save();
      setLaunchError(null);
      setTimeout(sendTerminalResize, 0);
      await updateOpenProjectStatus(root, projectStatusForRoot(root));
      await updateActiveSessionStatus(root, terminalPaneProjectStatus(nextPanes));
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
      const result = await invoke<OpenPaneResponse>("create_pane", { path: worktree.path, profile });
      const existingPanes = terminalPanesForSession(root, sessionId);
      const slot = existingPanes.length;
      const pane: ManagedTerminalPane = {
        id: result.paneId,
        profile,
        cwd: worktree.path,
        slot,
        label: normalizeTerminalPaneLabel(label),
        state: "running",
        exitCode: null,
        createdAt: Date.now(),
      };
      const nextPanes = [...existingPanes, pane];
      setSessionTerminalPanes(root, sessionId, nextPanes, result.paneId);
      setWorktrees((current) => {
        const next = addWorktree(current, {
          paneId: String(result.paneId),
          projectRoot: root,
          path: worktree.path,
          branch: worktree.branch,
          label: normalizeTerminalPaneLabel(label) ?? label,
          createdAt: Date.now(),
        });
        void storeRef.current?.set("worktrees", next);
        void storeRef.current?.save();
        return next;
      });
      if (sessionId) {
        recordAgentActivity(
          buildAgentSessionHandleDescriptor({
            pane,
            projectId: root,
            projectSessionId: sessionId,
            label: terminalPaneLabelForDisplay(pane.label, pane.profile.label, slot),
            approvalMode: agentApprovalMode,
          }),
          { kind: "process", label: "Created worktree pane", detail: worktree.branch, status: "running" },
        );
      }
      terminalLaunchProfileRef.current = profile;
      setTerminalLaunchProfile(profile);
      await storeRef.current?.set("terminalLaunchProfile", profile);
      await storeRef.current?.save();
      setLaunchError(null);
      setTimeout(sendTerminalResize, 0);
      await updateOpenProjectStatus(root, projectStatusForRoot(root));
      await updateActiveSessionStatus(root, terminalPaneProjectStatus(nextPanes));
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

  const projectRailStatusLabel = (status: ProjectRailStatus) => {
    if (status === "running") return "Running";
    if (status === "attention") return "Needs attention";
    return "Idle";
  };

  const projectRailStatusIcon = (status: ProjectRailStatus): AppIconName => {
    if (status === "running") return "loading";
    if (status === "attention") return "error";
    return "idle";
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
      setEditorText(buffered.text);
      setSavedEditorText(buffered.savedText);
      setEditorBytes(buffered.bytes);
      setEditorModifiedMs(buffered.modifiedMs);
      setEditorError(buffered.error);
      setEditorRecoveryError(buffered.recoveryError);
      const restoredForContent = clampEditorViewState(editorViewStatesRef.current[file.path], buffered.text.length);
      setEditorCursor(restoredForContent ? cursorFromText(buffered.text, restoredForContent.head) : { line: 1, column: 1 });
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
      editorBuffersRef.current[file.path] = {
        text: result.content,
        savedText: result.content,
        bytes: result.bytes,
        modifiedMs: result.modifiedMs,
        error: null,
        recoveryError: null,
      };
      setEditorBufferRevision((value) => value + 1);
      setEditorText(result.content);
      setSavedEditorText(result.content);
      setEditorBytes(result.bytes);
      setEditorModifiedMs(result.modifiedMs);
      const restoredForContent = clampEditorViewState(editorViewStatesRef.current[file.path], result.content.length);
      setEditorCursor(restoredForContent ? cursorFromText(result.content, restoredForContent.head) : { line: 1, column: 1 });
      await persistActiveFile(root, file.path);
      if (options.focusEditor) {
        requestAnimationFrame(() => {
          editorViewRef.current?.focus();
        });
      }
    } catch (err) {
      if (editorLoadSeq.current !== seq) return;
      editorBuffersRef.current[file.path] = {
        text: "",
        savedText: "",
        bytes: null,
        modifiedMs: null,
        error: String(err),
        recoveryError: null,
      };
      setEditorBufferRevision((value) => value + 1);
      setEditorText("");
      setSavedEditorText("");
      setEditorBytes(null);
      setEditorModifiedMs(null);
      setEditorError(String(err));
      setEditorRecoveryError(null);
    } finally {
      if (editorLoadSeq.current === seq) setEditorLoading(false);
    }
  };

  const requestOpenEditorFile = async (file: FileTreeNode, options: OpenEditorFileOptions = {}) => {
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
      requestedBy: "user",
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
      !window.confirm("Rename this item and discard the unsaved editor buffer?")
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
    if (!window.confirm(message)) return;
    if (affectedSelectedFile && editorDirty && !window.confirm("The selected file has unsaved changes. Delete anyway?")) return;
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


  const jumpToTerminalFindHit = (hits: TerminalFindHit[], index: number | null) => {
    if (index == null || !hits[index]) return;
    void invoke("scroll_terminal_to_row", { row: hits[index].row });
  };

  const runTerminalFind = async () => {
    const query = terminalFindQuery.trim();
    if (!query || !activeTerminalPane || terminalFindBusy) return;
    setTerminalFindBusy(true);
    setTerminalFindError(null);
    try {
      const hits = await invoke<TerminalFindHit[]>("search_terminal_scrollback", { query });
      setTerminalFindHits(hits);
      setTerminalFindLastQuery(query);
      const first = hits.length > 0 ? 0 : null;
      setTerminalFindIndex(first);
      jumpToTerminalFindHit(hits, first);
    } catch (error) {
      setTerminalFindHits([]);
      setTerminalFindIndex(null);
      setTerminalFindError(String(error));
    } finally {
      setTerminalFindBusy(false);
    }
  };

  const stepTerminalFind = (direction: 1 | -1) => {
    const next = nextTerminalFindIndex(terminalFindIndex, terminalFindHits.length, direction);
    setTerminalFindIndex(next);
    jumpToTerminalFindHit(terminalFindHits, next);
  };

  const closeTerminalFind = () => {
    setTerminalFindOpen(false);
    setTerminalFindError(null);
    // Ghostty clamps at the live bottom; a large delta snaps back to the tail.
    void invoke("scroll_pty", { delta: 10_000_000 });
  };

  const openCommandPalette = () => {
    setContextMenu(null);
    setCommandPaletteQuery("");
    setCommandPaletteActiveIndex(0);
    setCommandPaletteOpen(true);
  };

  const closeCommandPalette = () => {
    setCommandPaletteOpen(false);
    setCommandPaletteQuery("");
    setCommandPaletteActiveIndex(0);
  };

  const openChatSearch = (bookmarksOnly = false) => {
    setContextMenu(null);
    setSideDrawerCollapsed(false);
    setSideDrawerMode("search");
    setDrawerSearchScope("chats");
    setChatSearchBookmarksOnly(bookmarksOnly);
  };

  const openQuickOpen = () => {
    setContextMenu(null);
    setQuickOpenQuery("");
    setQuickOpenActiveIndex(0);
    setQuickOpenOpen(true);
  };

  const closeQuickOpen = () => {
    setQuickOpenOpen(false);
    setQuickOpenQuery("");
    setQuickOpenActiveIndex(0);
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

  const projectSessionContextMenuItems = (projectPath: string, session: ProjectSession): ContextMenuItem[] => [
    menuItem("session.switch", "Switch to Chat", () => switchProjectSession(projectPath, session.id), {
      icon: "file",
      disabled: projectPath === workspacePath && session.id === activeSessionId,
    }),
    menuItem("session.rename", "Rename Chat", () => renameProjectSession(projectPath, session), { icon: "file" }),
    menuItem("session.copy-name", "Copy Chat Name", async () => { await writeText(session.title); setActionNotice("Copied chat name"); }, { icon: "file" }),
    menuItem(
      "session.pin",
      session.pinnedAt ? "Unpin Chat" : "Pin Chat",
      () => pinProjectSession(projectPath, session, !session.pinnedAt),
      { icon: "pin" },
    ),
    menuItem(
      "session.archive",
      session.archived ? "Unarchive Chat" : "Archive Chat",
      () => archiveProjectSession(projectPath, session, !session.archived),
      {
        icon: "close",
        disabled:
          !session.archived &&
          (projectSessionsRef.current[projectPath] ?? []).filter((s) => !s.archived).length <= 1,
      },
    ),
    menuItem("session.delete", "Delete Chat", () => deleteProjectSession(projectPath, session), {
      icon: "error",
      danger: true,
      disabled: (projectSessionsRef.current[projectPath] ?? []).length <= 1,
    }),
  ];

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

  const terminalContextMenuItems = (): ContextMenuItem[] => [
    menuItem("terminal.new-pane", `New ${terminalLaunchProfile.label} Pane`, () => createTerminalPane(terminalLaunchProfile), {
      icon: "terminal",
      disabled: !workspacePath || launchProfileChanging,
    }),
    menuItem("terminal.new-worktree-pane", "New Worktree Pane", () => createWorktreePane(terminalLaunchProfile), {
      icon: "terminal",
      disabled: !workspacePath || launchProfileChanging,
    }),
    menuItem("terminal.rename-pane", "Rename Selected Pane", () => activeTerminalPane ? renameTerminalPane(activeTerminalPane) : undefined, {
      icon: "terminal",
      disabled: !activeTerminalPane,
    }),
    menuItem("terminal.save-transcript", "Save Transcript", saveActivePaneTranscript, {
      icon: "file",
      disabled: !activeTerminalPane,
    }),
    menuItem("terminal.restart-pane", "Restart Selected Process", () => activeTerminalPane ? restartTerminalPane(activeTerminalPane) : undefined, {
      icon: "reload",
      disabled: !activeTerminalPane || launchProfileChanging,
    }),
    menuItem("terminal.terminate-pane", "Kill Selected Process", () => activeTerminalPane ? terminateTerminalPane(activeTerminalPane) : undefined, {
      icon: "stop",
      danger: true,
      disabled: !activeTerminalPane || activeTerminalPane.state === "exited",
    }),
    menuItem("terminal.close-pane", "Close Selected Pane", () => activeAgentSessionHandle ? activeAgentSessionHandle.close() : undefined, {
      icon: "close",
      danger: true,
      disabled: !activeAgentSessionHandle,
    }),
    menuItem("terminal.remove-worktree", "Remove Worktree", () => activeTerminalPane ? closeWorktreePane(activeTerminalPane.id) : undefined, {
      icon: "close",
      danger: true,
      disabled: !activeTerminalPane || !worktreeForPaneId(worktrees, activeTerminalPane ? String(activeTerminalPane.id) : null),
    }),
    menuItem("terminal.copy", "Copy Selection", async () => { await copyTerminalSelection(); setActionNotice("Copied terminal selection"); }, {
      icon: "terminal",
      shortcut: shortcutKeys("terminal.copy-selection"),
      disabled: !terminalSelectedText(),
    }),
    menuItem("terminal.paste", "Paste", () => pasteIntoTerminal(), { icon: "terminal", shortcut: shortcutKeys("terminal.paste"), disabled: !activeTerminalPane }),
    menuItem("terminal.copy-tail", "Copy Last 20 Lines", async () => { await copyActivePaneTail(); setActionNotice("Copied last 20 lines"); }, {
      icon: "terminal",
      disabled: !activeAgentSessionHandle,
    }),
    menuItem("terminal.clear", "Clear Terminal", () => clearActiveTerminal(), { icon: "terminal", shortcut: shortcutKeys("terminal.clear"), disabled: !activeTerminalPane }),
    menuItem("terminal.interrupt", "Interrupt Process", () => interruptActivePane(), { icon: "stop", danger: true, disabled: !activeTerminalPane || activeTerminalPane.state === "exited" }),
    menuItem("terminal.copy-cwd", "Copy Working Directory", () => workspacePath ? copyPathToClipboard(workspacePath) : undefined, {
      icon: "workspace",
      disabled: !workspacePath,
    }),
  ];

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

  const activeTerminalPaneCommandIndex = activeTerminalPane ? terminalPanes.findIndex((pane) => pane.id === activeTerminalPane.id) : -1;
  const activeTerminalPaneLabelForCommands = activeTerminalPane
    ? terminalPaneLabel(activeTerminalPane, activeTerminalPaneCommandIndex >= 0 ? activeTerminalPaneCommandIndex : activeTerminalPane.slot)
    : null;
  const commandPaletteCommands: CommandPaletteCommand[] = [
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
      run: () => setTerminalFindOpen(true),
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
      run: openQuickOpen,
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
  const visibleCommandPaletteCommands = filterCommandPaletteCommands(commandPaletteCommands, commandPaletteQuery, commandPaletteSources).slice(0, 120);
  const activeCommandPaletteCommand = visibleCommandPaletteCommands[commandPaletteActiveIndex] ?? visibleCommandPaletteCommands[0] ?? null;

  const runCommandPaletteCommand = (command: CommandPaletteCommand | null) => {
    if (!command || command.disabled) return;
    closeCommandPalette();
    command.run();
  };

  const handleCommandPaletteKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeCommandPalette();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setCommandPaletteActiveIndex((index) => visibleCommandPaletteCommands.length === 0 ? 0 : (index + 1) % visibleCommandPaletteCommands.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCommandPaletteActiveIndex((index) => visibleCommandPaletteCommands.length === 0 ? 0 : (index - 1 + visibleCommandPaletteCommands.length) % visibleCommandPaletteCommands.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      runCommandPaletteCommand(activeCommandPaletteCommand);
    }
  };

  useEffect(() => {
    if (!commandPaletteOpen) return;
    setCommandPaletteActiveIndex(0);
    requestAnimationFrame(() => commandPaletteInputRef.current?.focus());
  }, [commandPaletteOpen, commandPaletteQuery]);

  const runQuickOpenFile = (file: FileTreeNode | null) => {
    if (!file) return;
    closeQuickOpen();
    void requestOpenEditorFile(file, { focusEditor: true });
  };

  const handleQuickOpenKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeQuickOpen();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setQuickOpenActiveIndex((index) => quickOpenResults.length === 0 ? 0 : (index + 1) % quickOpenResults.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setQuickOpenActiveIndex((index) => quickOpenResults.length === 0 ? 0 : (index - 1 + quickOpenResults.length) % quickOpenResults.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      runQuickOpenFile(quickOpenResults[quickOpenActiveIndex] ?? quickOpenResults[0] ?? null);
    }
  };

  useEffect(() => {
    if (!quickOpenOpen) return;
    setQuickOpenActiveIndex(0);
    requestAnimationFrame(() => quickOpenInputRef.current?.focus());
  }, [quickOpenOpen, quickOpenQuery]);

  const tabIsDirty = (path: string) => dirtyTabPathSet.has(path);

  const closeEditorTab = async (tab: FileTreeNode) => {
    captureCurrentEditorViewState();
    captureCurrentEditorBuffer();
    if (tabIsDirty(tab.path) && !window.confirm(`Close ${tab.name} and discard unsaved changes?`)) return;
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

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    const paint = () => {
      frame.current = null;
      const snap = latest.current;
      if (!snap) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }
      const paintStart = performance.now();
      const { cw, ch } = metrics.current;
      const dpr = window.devicePixelRatio || 1;
      const w = snap.cols * cw;
      const h = snap.rows * ch;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.textBaseline = "top";
      ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;

      for (let y = 0; y < snap.rows; y++) {
        for (let x = 0; x < snap.cols; x++) {
          const cell = snap.cells[y * snap.cols + x];
          if (!cell) continue;
          const selected = isCellSelected(x, y, selection.current);
          ctx.fillStyle = selected ? "#2f6f9f" : rgb(cell.b);
          ctx.fillRect(x * cw, y * ch, cw, ch);
          if (cell.t !== " ") {
            ctx.fillStyle = selected ? "#ffffff" : rgb(cell.f);
            ctx.font = `${cell.bold ? "bold " : ""}${FONT_SIZE}px ${FONT_FAMILY}`;
            ctx.fillText(cell.t, x * cw, y * ch + (ch - FONT_SIZE) / 2);
          }
        }
      }
      if (snap.cvis) {
        ctx.fillStyle = "rgba(230,230,230,0.55)";
        ctx.fillRect(snap.cx * cw, snap.cy * ch, cw, ch);
      }
      // Track the IME composition input to the cursor cell so the OS candidate
      // window (CJK IME, dead-key accent picker) anchors near the caret.
      const imeInput = imeInputRef.current;
      if (imeInput) {
        const caret = imeCaretStyle(snap.cx, snap.cy, cw, ch);
        imeInput.style.transform = caret.transform;
        imeInput.style.width = caret.width;
        imeInput.style.height = caret.height;
      }
      recordFrameTime(renderPerfRef.current, performance.now() - paintStart);
    };

    const requestPaint = () => {
      if (frame.current == null) frame.current = requestAnimationFrame(paint);
    };
    requestTerminalPaintRef.current = requestPaint;

    // Measure the monospace advance once the font is loaded, then report size.
    const setup = async () => {
      await (document as any).fonts?.ready;
      ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
      const cw = Math.max(1, Math.round(ctx.measureText("M").width));
      const ch = Math.round(FONT_SIZE * LINE_HEIGHT);
      metrics.current = { cw, ch };
      const staleLock = await invoke<boolean>("begin_session").catch(() => false);
      await initWorkspace();
      const recovery = deriveCrashRecovery(staleLock, openProjectsRef.current.length);
      setCrashNotice(crashRecoveryMessage(recovery));
      const cleanup = () => {
        void invoke("end_session_clean").catch(() => {});
      };
      window.addEventListener("beforeunload", cleanup);
    };

    const scrollViewport = (delta: number) => {
      if (activeTerminalPaneIdRef.current == null) return;
      if (!Number.isFinite(delta) || delta === 0) return;
      selection.current = null;
      requestPaint();
      invoke("scroll_pty", { delta: Math.trunc(delta) }).catch(() => {});
    };

    // Workspace: reopen the last folder on startup, else prompt. Opening a folder
    // spawns the selected launch profile in it (backend `open_workspace`) and
    // persists the active folder plus recent and open-project rail lists.
    const initWorkspace = async () => {
      const store = await load("workspace.json", { autoSave: true, defaults: {} });
      storeRef.current = store;
      const storedEntries = Object.fromEntries(await store.entries());
      const migration = migrateWorkspaceStore(storedEntries);
      if (migration.migrated) {
        for (const [key, value] of Object.entries(migration.data)) {
          await store.set(key, value);
        }
        await store.save();
      }
      const savedRecent = normalizeRecentProjects(await store.get<unknown>("recentFolders"));
      const savedOpenProjects = normalizeOpenProjects(await store.get<unknown>("openProjects"));
      const savedProjectSessions = normalizeProjectSessionsByProject(await store.get<unknown>("projectSessions"));
      const savedActiveSessions = normalizeActiveSessionByProject(await store.get<unknown>("activeSessionByProject"));
      const savedBrowserProjects = normalizeBrowserPreviewRecords(await store.get<unknown>("browserPreviewByProject"));
      const savedBrowserSessions = normalizeBrowserPreviewRecords(await store.get<unknown>("browserPreviewBySession"));
      const savedProfile = normalizeLaunchProfile(await store.get<unknown>("launchProfile"));
      const savedCustomProfiles = normalizeCustomLaunchProfiles(await store.get<unknown>("customLaunchProfiles"));
      customLaunchProfilesRef.current = savedCustomProfiles;
      setCustomLaunchProfiles(savedCustomProfiles);
      const savedAiConnectionSettings = normalizeAiConnectionSettings(await store.get<unknown>("aiConnectionSettings"));
      setAiConnectionSettings(savedAiConnectionSettings);
      void refreshConnectionSecretPresence(savedAiConnectionSettings);
      const savedTerminalProfile = normalizeTerminalLaunchProfile(await store.get<unknown>("terminalLaunchProfile"));
      const savedComposerHarness = normalizeComposerHarnessRecords(await store.get<unknown>("composerHarnessBySession"), savedProfile.id);
      const storedScopedSettings = await store.get<unknown>("scopedSettings");
      const savedScopedSettings = storedScopedSettings == null
        ? migrateLegacyScopedSettings({
            agentProfileId: savedProfile.id,
            browserUrl: DEFAULT_BROWSER_PREVIEW_URL,
            browserProjects: savedBrowserProjects,
            browserChats: savedBrowserSessions,
            composerChats: savedComposerHarness,
          })
        : normalizeScopedSettings(storedScopedSettings, defaultScopedSettings(savedProfile.id, DEFAULT_BROWSER_PREVIEW_URL));
      const savedGlobalProfile = resolveLaunchProfile(savedScopedSettings.global.agentProfileId);
      if (storedScopedSettings == null || JSON.stringify(storedScopedSettings) !== JSON.stringify(savedScopedSettings)) {
        await store.set("scopedSettings", savedScopedSettings);
        await store.save();
      }
      const legacyChatConversations = normalizeChatConversationRecords(await store.get<unknown>("chatConversations"));
      if (Object.keys(legacyChatConversations).length > 0) {
        await migrateLegacyChatConversations(legacyChatConversations);
      } else {
        await migrateLegacyChatConversations({});
      }
      const savedChatConversations = normalizeChatConversationRecords(await loadDurableChatConversations());
      if ((await store.get<unknown>("chatConversations")) !== null) {
        await store.delete("chatConversations");
        await store.save();
      }
      const savedPaneLabels = normalizePaneLabelsBySession(await store.get<unknown>("paneLabelsBySession"));
      const savedSessionSnapshots = normalizeSessionEditorSnapshots(await store.get<unknown>("sessionEditorSnapshots"));
      const savedPaneLayouts = normalizePaneLayoutsBySession(await store.get<unknown>("paneLayoutsBySession"));
      const savedAgentActivity = normalizeAgentActivityEvents(await store.get<unknown>("agentActivityEvents"));
      activeFilesByWorkspaceRef.current = normalizeActiveFileByWorkspace(await store.get<unknown>("activeFileByWorkspace"));
      const savedKeybindings = normalizeKeybindingOverrides(await store.get<unknown>("keybindingOverrides"));
      setActiveKeybindingOverrides(savedKeybindings);
      setKeybindingOverrides(savedKeybindings);
      setCommandPaletteSources(normalizeCommandPaletteSources(await store.get<unknown>("commandPaletteSources")));
      const savedTheme = await store.get<unknown>("appTheme");
      if (savedTheme === "mono-ghost") setAppTheme("mono-ghost");
      if ((await store.get<unknown>("notificationsEnabled")) === true) setNotificationsEnabled(true);
      setPaneTranscripts(normalizePaneTranscripts(await store.get<unknown>("paneTranscripts")));
      setWorktrees(normalizeWorktrees(await store.get<unknown>("worktrees")));
      const initialOpenProjects = savedOpenProjects.length > 0 ? savedOpenProjects : openProjectsFromRecent(savedRecent);
      const initialProjectSessions = initialOpenProjects.reduce(
        (sessions, project) => ensureProjectSessions(sessions, project.path, Date.now()),
        savedProjectSessions,
      );
      recentProjectsRef.current = savedRecent;
      openProjectsRef.current = initialOpenProjects;
      projectSessionsRef.current = initialProjectSessions;
      activeSessionByProjectRef.current = savedActiveSessions;
      browserPreviewByProjectRef.current = savedBrowserProjects;
      browserPreviewBySessionRef.current = savedBrowserSessions;
      composerHarnessBySessionRef.current = savedComposerHarness;
      scopedSettingsRef.current = savedScopedSettings;
      chatConversationsRef.current = savedChatConversations;
      paneLabelsBySessionRef.current = savedPaneLabels;
      sessionEditorSnapshotsRef.current = savedSessionSnapshots;
      paneLayoutsBySessionRef.current = savedPaneLayouts;
      launchProfileRef.current = savedGlobalProfile;
      setLaunchProfile(savedGlobalProfile);
      terminalLaunchProfileRef.current = savedTerminalProfile;
      setTerminalLaunchProfile(savedTerminalProfile);
      setRecentProjects(savedRecent);
      setOpenProjects(initialOpenProjects);
      setProjectSessions(initialProjectSessions);
      setActiveSessionByProjectState(savedActiveSessions);
      setBrowserPreviewByProject(savedBrowserProjects);
      setBrowserPreviewBySession(savedBrowserSessions);
      setComposerHarnessBySession(savedComposerHarness);
      setScopedSettings(savedScopedSettings);
      setChatConversations(savedChatConversations);
      setPaneLabelsBySession(savedPaneLabels);
      setAgentActivityEvents(savedAgentActivity);
      const last = await store.get<string>("folder");
      if (last) await openWorkspaceDirect(last, savedGlobalProfile);
      else await pickWorkspace();
      sendTerminalResize();
    };

    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (e.isComposing) return;
      if (comboMatches(e, "chrome.command-palette")) {
        e.preventDefault();
        openCommandPalette();
        return;
      }
      if (comboMatches(e, "workspace.quick-open")) {
        e.preventDefault();
        openQuickOpen();
        return;
      }
      if (comboMatches(e, "chrome.settings")) {
        e.preventDefault();
        setSettingsOpen(true);
        return;
      }
      if (target?.closest(".file-rail, .editor-area, .browser-preview, .terminal-titlebar, .agent-composer, .command-palette")) return;
      if (activeTerminalPaneIdRef.current == null) return;
      // Cmd (meta) combos are app-level, not pty input. Let them through so the
      // native copy/paste clipboard events fire; handle the few we own explicitly.
      if (e.metaKey) {
        const k = e.key.toLowerCase();
        if (k === "k") {
          // Clear — map to Ctrl-L (shell clear-screen). Ship-ugly stopgap.
          e.preventDefault();
          invoke("send_key", { code: "KeyL", text: null, shift: false, alt: false, ctrl: true, sup: false }).catch(() => {});
        } else if (k === "c") {
          const snap = latest.current;
          const selectedText = snap && selection.current ? selectionToText(snap.cells, snap.cols, selection.current) : "";
          if (selectedText) {
            e.preventDefault();
            writeText(selectedText).catch(() => {});
          }
        } else if (k === "v") {
          // Paste: the browser `paste` event never fires on a bare canvas, so read
          // the clipboard directly and send it through the (bracketed-aware) command.
          e.preventDefault();
          selection.current = null;
          requestPaint();
          readText().then((t) => t && invoke("paste", { text: t })).catch(() => {});
        }
        return;
      }
      if (e.shiftKey && (e.code === "PageUp" || e.code === "PageDown")) {
        e.preventDefault();
        const rows = latest.current?.rows ?? 24;
        scrollViewport(e.code === "PageUp" ? -(rows - 1) : rows - 1);
        return;
      }
      const code = e.code;
      if (!code) return;
      selection.current = null;
      requestPaint();
      // utf8 text: printable single char only, and only when no ctrl/alt transform.
      const text = e.key.length === 1 && !e.ctrlKey && !e.altKey ? e.key : null;
      e.preventDefault();
      invoke("send_key", {
        code,
        text,
        shift: e.shiftKey,
        alt: e.altKey,
        ctrl: e.ctrlKey,
        sup: false,
      }).catch(() => {});
    };

    const pointForEvent = (e: MouseEvent) => {
      const snap = latest.current;
      if (!snap) return null;
      const { cw, ch } = metrics.current;
      return pointFromMouse(canvas.getBoundingClientRect(), cw, ch, snap.cols, snap.rows, e.clientX, e.clientY);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const point = pointForEvent(e);
      if (!point) return;
      e.preventDefault();
      selection.current = { start: point, end: point };
      selecting.current = true;
      requestPaint();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!selecting.current) return;
      const point = pointForEvent(e);
      if (!point || !selection.current) return;
      selection.current = { ...selection.current, end: point };
      requestPaint();
    };

    const onMouseUp = () => {
      selecting.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      const snap = latest.current;
      if (!snap || snap.sb === 0) return;
      e.preventDefault();
      const { ch } = metrics.current;
      const rawRows = e.deltaY / ch;
      const rows = Math.sign(rawRows) * Math.max(1, Math.round(Math.abs(rawRows)));
      scrollViewport(rows);
    };

    const unlisten = listen<GridPayload>("grid", (ev) => {
      ipcSampleCounter.current += 1;
      if (ipcSampleCounter.current % 20 === 0) {
        recordIpcPayloadBytes(renderPerfRef.current, JSON.stringify(ev.payload).length);
      }
      terminalSnapshotsRef.current[ev.payload.paneId] = ev.payload.snapshot;
      detectLocalDevServerFromSnapshot(ev.payload.paneId, ev.payload.snapshot);
      if (ev.payload.paneId === activeTerminalPaneIdRef.current) {
        latest.current = ev.payload.snapshot;
        requestPaint();
      }
    });
    const unlistenMenu = listen("menu-open-folder", () => {
      pickWorkspace();
    });
    const unlistenMenuSave = listen("menu-save-file", () => {
      void saveEditorFileRef.current();
    });
    const unlistenMenuFind = listen("menu-find-in-file", () => {
      openEditorSearchRef.current();
    });
    const unlistenMenuCloseTab = listen("menu-close-editor-tab", () => {
      void closeActiveEditorTabRef.current();
    });
    const unlistenPaneExit = listen<PaneExit>("pane-exit", (ev) => {
      const wasIntentionallyTerminated = intentionallyTerminatedPaneIdsRef.current.delete(ev.payload.paneId);
      const context = paneContextForPaneId(ev.payload.paneId);
      const root = context?.projectRoot ?? workspacePathRef.current;
      const nextPanes = setPaneState(ev.payload.paneId, "exited", ev.payload.code);
      const nextStatus = terminalPaneProjectStatus(nextPanes);
      const paneIndex = nextPanes.findIndex((pane) => pane.id === ev.payload.paneId);
      const pane = paneIndex >= 0 ? nextPanes[paneIndex] : null;
      const sessionId = context?.sessionId ?? activeSessionForProject(root);
      if (root && sessionId && pane) {
        recordAgentActivity(
          buildAgentSessionHandleDescriptor({
            pane,
            projectId: root,
            projectSessionId: sessionId,
            label: terminalPaneLabelForDisplay(pane.label, pane.profile.label, paneIndex),
            approvalMode: agentApprovalMode,
          }),
          {
            kind: wasIntentionallyTerminated ? "process" : "command",
            label: wasIntentionallyTerminated ? "Process terminated" : ev.payload.code === 0 ? "Command finished" : "Command failed",
            detail: ev.payload.command,
            target: root,
            exitCode: ev.payload.code,
            outputRef: "terminal",
            status: wasIntentionallyTerminated ? "exited" : ev.payload.code === 0 ? "complete" : "error",
          },
        );
      }
      if (!wasIntentionallyTerminated && ev.payload.paneId === activeTerminalPaneIdRef.current) setLaunchError(ev.payload.message);
      void updateOpenProjectStatus(root, projectStatusForRoot(root));
      void updateSessionStatus(root, sessionId, nextStatus);
      if (root && sessionId && pane) {
        const snapshot = terminalSnapshotsRef.current[ev.payload.paneId];
        if (snapshot) persistPaneTranscript(root, sessionId, pane, paneIndex, terminalSnapshotText(snapshot), Date.now());
      }
      const exitedInBackground = root && (
        isBackgroundExit(root, workspacePathRef.current)
        || sessionId !== activeSessionForProject(root)
      );
      if (!wasIntentionallyTerminated && root && exitedInBackground) {
        const label = pane ? terminalPaneLabelForDisplay(pane.label, pane.profile.label, paneIndex) : "Agent";
        const exit = { paneId: String(ev.payload.paneId), projectPath: root, label, failed: ev.payload.code !== 0 };
        setBackgroundExits((exits) => addBackgroundExit(exits, exit));
        if (notificationsEnabledRef.current) {
          void (async () => {
            let granted = await isPermissionGranted();
            if (!granted) granted = (await requestPermission()) === "granted";
            if (granted) sendNotification({ title: "Keelhouse", body: notificationBody(exit) });
          })().catch(() => {});
        }
      }
    });

    window.addEventListener("keydown", onKey);
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    const resizeObserver = new ResizeObserver(sendTerminalResize);
    if (terminalHostRef.current) resizeObserver.observe(terminalHostRef.current);
    window.addEventListener("resize", sendTerminalResize);
    setup();

    return () => {
      unlisten.then((f) => f());
      unlistenMenu.then((f) => f());
      unlistenMenuSave.then((f) => f());
      unlistenMenuFind.then((f) => f());
      unlistenMenuCloseTab.then((f) => f());
      unlistenPaneExit.then((f) => f());
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("resize", sendTerminalResize);
      resizeObserver.disconnect();
      if (frame.current != null) cancelAnimationFrame(frame.current);
    };
  }, []);

  const activeTerminalPaneIndex = activeTerminalPane ? terminalPanes.findIndex((pane) => pane.id === activeTerminalPane.id) : -1;
  const activeTerminalPaneLabel = activeTerminalPane
    ? terminalPaneLabel(activeTerminalPane, activeTerminalPaneIndex >= 0 ? activeTerminalPaneIndex : activeTerminalPane.slot)
    : null;
  const activeWorkspaceName = workspacePath ? basename(workspacePath) : "Open workspace";
  const activeSessionTitle = activeSessionId
    ? projectSessionsFor(workspacePath ?? "").find((session) => session.id === activeSessionId)?.title ?? "New chat"
    : "No chat";
  const activeDrawerMode = DRAWER_MODES.find((mode) => mode.id === sideDrawerMode) ?? DRAWER_MODES[0];
  const drawerActiveTitle = sideDrawerMode === "projects" ? "Project chats" : activeDrawerMode.label;

  return (
    <div className={`app-shell ${sideDrawerCollapsed ? "app-shell--side-drawer-collapsed" : ""} ${settingsOpen ? "app-shell--settings-open" : ""}`} style={appShellStyle}>
      <header className="app-titlebar" aria-label="Application chrome" data-tauri-drag-region>
        <div className="titlebar-identity">
          <button className="titlebar-search" type="button" onClick={() => openChatSearch()} title="Search chats across projects">
            <AppIcon name="search" />
            <span>Search threads…</span>
          </button>
        </div>
        <div className="titlebar-splitter" aria-hidden="true" />
        <div className="titlebar-agent-context" aria-label="Workspace context">
          <button className="titlebar-workspace" type="button" onClick={pickWorkspace} title="Open or switch project folder">
            <AppIcon name="workspace" />
            <span>{activeWorkspaceName}</span>
          </button>
          {gitStatus?.branch ? <span className="titlebar-branch">{`⎇ ${gitStatus.branch}`}</span> : null}
        </div>
        <div className="titlebar-splitter" aria-hidden="true" />
        <div className="titlebar-actions">
          <div className="titlebar-panel-toggles" aria-label="Toggle panels">
            <button className={`titlebar-action ${!sideDrawerCollapsed ? "titlebar-action--active" : ""}`} type="button" title="Toggle Threads" aria-label="Toggle Threads" aria-pressed={!sideDrawerCollapsed} onClick={() => setSideDrawerCollapsed((collapsed) => !collapsed)}>
              <AppIcon name="menu" />
            </button>
          </div>
          <span className={`titlebar-pill titlebar-pill--${primarySurfaceState}`} title={`${primarySurfaceLabel} · ${primarySurfaceStatusLabel}`}>
            <AppIcon name={paneStateIconName(primarySurfaceState)} />
            <span>{primarySurfaceLabel}</span>
          </span>
          <button className="titlebar-action" type="button" title="More" aria-label="Open settings and more" onClick={() => setSettingsOpen(true)}>
            <AppIcon name="more" />
          </button>
        </div>
      </header>
      <aside className={`file-rail ${sideDrawerCollapsed ? "file-rail--collapsed" : ""}`} aria-label={`${sideDrawerMode === "projects" ? "Project threads" : drawerActiveTitle} drawer`}>
        <div className="drawer-toolbar">
          <span>{sideDrawerMode === "projects" ? "Threads" : drawerActiveTitle}</span>
          {sideDrawerMode === "projects" ? (
            <button
              className="drawer-collapse-button"
              type="button"
              title="New chat"
              aria-label="New chat"
              disabled={!workspacePath}
              onClick={() => workspacePath && void createProjectSession(workspacePath)}
            >
              <AppIcon name="filePlus" />
            </button>
          ) : null}
          <button
            className="drawer-collapse-button"
            type="button"
            title="Reset interface"
            aria-label="Reset interface"
            onClick={resetInterface}
          >
            <AppIcon name="reload" />
          </button>
          <button
            className="drawer-collapse-button"
            type="button"
            title={sideDrawerCollapsed ? "Expand side drawer" : "Collapse side drawer"}
            aria-label={sideDrawerCollapsed ? "Expand side drawer" : "Collapse side drawer"}
            aria-pressed={sideDrawerCollapsed}
            onClick={() => setSideDrawerCollapsed((collapsed) => !collapsed)}
          >
            <AppIcon name={sideDrawerCollapsed ? "chevronRight" : "chevronDown"} />
          </button>
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
        {!sideDrawerCollapsed && sideDrawerMode === "files" ? (
          <>
            <div className="panel-title panel-title--with-action">
              <span>Files</span>
              <button
                className="rail-open-button"
                type="button"
                disabled={!workspacePath}
                title="New file"
                aria-label="Create new file"
                onClick={() => void createFileInRail()}
              >
                <AppIcon name="filePlus" />
                <span>File</span>
              </button>
              <button
                className="rail-open-button"
                type="button"
                disabled={!workspacePath}
                title="New folder"
                aria-label="Create new folder"
                onClick={() => void createFolderInRail()}
              >
                <AppIcon name="folderPlus" />
                <span>Folder</span>
              </button>
              <button
                className="rail-open-button"
                type="button"
                title={shortcutTitle("workspace.open", "Open folder")}
                aria-label="Open folder"
                onClick={pickWorkspace}
              >
                <AppIcon name="folderOpen" />
                <span>Open</span>
              </button>
            </div>
            <div className="rail-root" title={workspacePath ?? ""}>
              <button
                className="rail-root__button"
                type="button"
                aria-label={workspacePath ? `Workspace ${basename(workspacePath)}` : "No workspace selected"}
                onContextMenu={(event) => openContextMenu(event, workspaceContextMenuItems())}
              >
                <AppIcon name={workspacePath ? "workspace" : "folderOpen"} />
                {workspacePath ? basename(workspacePath) : "No workspace"}
              </button>
            </div>
          </>
        ) : null}
        {!sideDrawerCollapsed && sideDrawerMode === "projects" && visibleOpenProjects.length > 0 ? (
          <nav className="project-rail" aria-label="Open projects">
            <div className="project-rail__heading">Today</div>
            {visibleOpenProjects.map((project) => {
              const status = projectRailStatus(project);
              const active = project.path === workspacePath;
              const allSessions = projectSessionsFor(project.path);
              const sessions = activeSessionsForRail(allSessions, showArchivedSessions);
              const archivedCount = archivedSessionCount(allSessions);
              const sessionsExpanded = expandedSessionProjects[project.path] ?? false;
              const visibleSessions = sessionsExpanded ? sessions : sessions.slice(0, 3);
              const hiddenSessionCount = Math.max(0, sessions.length - visibleSessions.length);
              return (
                <div className="project-group" key={project.path}>
                  <button
                    className={`project-row ${active ? "project-row--active" : ""} project-row--${status}`}
                    type="button"
                    aria-current={active ? "page" : undefined}
                    aria-label={`${active ? "Active project" : "Switch to project"} ${basename(project.path)}, ${projectRailStatusLabel(status)}`}
                    title={project.path}
                    onPointerDown={(event) => {
                      if (event.button !== 0) return;
                      event.preventDefault();
                      if (!active) void requestOpenWorkspace(project.path);
                    }}
                    onContextMenu={(event) => openContextMenu(event, projectRailContextMenuItems(project))}
                  >
                    <span className="project-row__copy">
                      <span className="project-row__name">
                        <AppIcon name="workspace" />
                        <span>{basename(project.path)}</span>
                      </span>
                    </span>
                    {backgroundExitCountForProject(backgroundExits, project.path) > 0 && project.path !== workspacePath ? (
                      <span className="project-row__badge" aria-label={`${backgroundExitCountForProject(backgroundExits, project.path)} background exits`}>
                        {backgroundExitCountForProject(backgroundExits, project.path)}
                      </span>
                    ) : (
                      <span className="project-row__state" aria-hidden="true" />
                    )}
                  </button>
                  <div className="session-list" aria-label={`${basename(project.path)} chats`}>
                    {visibleSessions.map((session) => {
                      const sessionStatus = projectSessionStatus(project.path, session);
                      const sessionActive = active && session.id === activeSessionId;
                      return (
                        <button
                          className={`session-row ${sessionActive ? "session-row--active" : ""} session-row--${sessionStatus}`}
                          type="button"
                          key={session.id}
                          aria-current={sessionActive ? "page" : undefined}
                          aria-label={`${sessionActive ? "Active chat" : "Switch to chat"} ${session.title}, ${projectRailStatusLabel(sessionStatus)}`}
                          title={`${session.title} · ${projectRailStatusLabel(sessionStatus)}`}
                          onPointerDown={(event) => {
                            if (event.button !== 0) return;
                            event.preventDefault();
                            if (!sessionActive) void switchProjectSession(project.path, session.id);
                          }}
                          onContextMenu={(event) => openContextMenu(event, projectSessionContextMenuItems(project.path, session))}
                        >
                          <span className="session-row__copy">
                            <span>{session.title}</span>
                          </span>
                          <span className="session-row__state">
                            {session.pinnedAt ? <AppIcon className="session-row__pin" name="pin" label="Pinned chat" /> : null}
                            <span className="session-row__time">{sessionRecencyLabel(session.updatedAt)}</span>
                            <AppIcon name={projectRailStatusIcon(sessionStatus)} />
                          </span>
                        </button>
                      );
                    })}
                    {sessions.length > 3 ? (
                      <button
                        className="session-row session-row--more"
                        type="button"
                        aria-expanded={sessionsExpanded}
                        aria-label={sessionsExpanded ? `Show fewer chats in ${basename(project.path)}` : `Show ${hiddenSessionCount} more chats in ${basename(project.path)}`}
                        onPointerDown={(event) => {
                          if (event.button !== 0) return;
                          event.preventDefault();
                          setExpandedSessionProjects((expanded) => ({
                            ...expanded,
                            [project.path]: !sessionsExpanded,
                          }));
                        }}
                      >
                        <span>{sessionsExpanded ? "Show fewer" : `Show more (${hiddenSessionCount})`}</span>
                      </button>
                    ) : null}
                    {archivedCount > 0 ? (
                      <button
                        className="session-row session-row--more"
                        type="button"
                        aria-pressed={showArchivedSessions}
                        onPointerDown={(event) => {
                          if (event.button !== 0) return;
                          event.preventDefault();
                          setShowArchivedSessions((show) => !show);
                        }}
                      >
                        <span>{showArchivedSessions ? "Hide archived" : `Show archived (${archivedCount})`}</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </nav>
        ) : null}
        {!sideDrawerCollapsed && sideDrawerMode === "projects" && visibleOpenProjects.length === 0 ? <div className="rail-status">Open a folder to start a chat</div> : null}
        {!sideDrawerCollapsed && sideDrawerMode === "search" ? (
          <section className="drawer-panel" aria-label="Search chats and workspace">
            <div className="panel-title panel-title--with-action">
              <span>Search</span>
              <button className="rail-open-button" type="button" onClick={openQuickOpen}>
                <AppIcon name="search" />
                <span>{shortcutKeys("workspace.quick-open") || "Quick Open"}</span>
              </button>
            </div>
            <div className="search-scope-tabs" role="tablist" aria-label="Search scope">
              <button
                className={`search-scope-tabs__button ${drawerSearchScope === "chats" ? "search-scope-tabs__button--active" : ""}`}
                type="button"
                role="tab"
                aria-selected={drawerSearchScope === "chats"}
                onClick={() => setDrawerSearchScope("chats")}
              >
                <AppIcon name="agent" />
                <span>Chats</span>
              </button>
              <button
                className={`search-scope-tabs__button ${drawerSearchScope === "files" ? "search-scope-tabs__button--active" : ""}`}
                type="button"
                role="tab"
                aria-selected={drawerSearchScope === "files"}
                onClick={() => setDrawerSearchScope("files")}
              >
                <AppIcon name="file" />
                <span>Files</span>
              </button>
              <button
                className={`search-scope-tabs__button ${drawerSearchScope === "text" ? "search-scope-tabs__button--active" : ""}`}
                type="button"
                role="tab"
                aria-selected={drawerSearchScope === "text"}
                onClick={() => setDrawerSearchScope("text")}
              >
                <AppIcon name="search" />
                <span>Text</span>
              </button>
            </div>
            <label className="drawer-field">
              <span>{drawerSearchScope === "chats" ? "Search chat history" : drawerSearchScope === "files" ? "Filter files" : "Search text"}</span>
              <input
                value={drawerSearchScope === "chats" ? chatSearchQuery : drawerSearchQuery}
                placeholder={drawerSearchScope === "chats" ? "Search all projects and messages" : drawerSearchScope === "files" ? "Type a filename or path" : "Type at least 2 characters"}
                disabled={drawerSearchScope !== "chats" && !workspacePath}
                onChange={(event) => drawerSearchScope === "chats" ? setChatSearchQuery(event.currentTarget.value) : setDrawerSearchQuery(event.currentTarget.value)}
              />
            </label>
            {drawerSearchScope === "chats" ? (
              <div className="chat-search-filter" role="group" aria-label="Chat search filter">
                <button className={!chatSearchBookmarksOnly ? "is-active" : ""} type="button" aria-pressed={!chatSearchBookmarksOnly} onClick={() => setChatSearchBookmarksOnly(false)}>All</button>
                <button className={chatSearchBookmarksOnly ? "is-active" : ""} type="button" aria-pressed={chatSearchBookmarksOnly} onClick={() => setChatSearchBookmarksOnly(true)}>
                  <AppIcon name="bookmark" />
                  Bookmarks
                </button>
              </div>
            ) : null}
            <div className="drawer-list">
              {drawerSearchScope !== "chats" && !workspacePath ? <div className="rail-status">Open a folder to search</div> : null}
              {drawerSearchScope === "chats" && !chatSearchBookmarksOnly && chatSearchQuery.trim().length < 2 ? <div className="rail-status">Type at least 2 characters to search every chat</div> : null}
              {drawerSearchScope === "chats" && chatSearchLoading ? <div className="rail-status">Searching chats…</div> : null}
              {drawerSearchScope === "chats" && chatSearchError ? <div className="rail-status rail-status--error">{chatSearchError}</div> : null}
              {drawerSearchScope === "chats" && !chatSearchLoading && !chatSearchError && (chatSearchBookmarksOnly || chatSearchQuery.trim().length >= 2) && chatSearchViewResults.length === 0 ? (
                <div className="rail-status">{chatSearchBookmarksOnly ? "No bookmarked messages" : "No chat matches"}</div>
              ) : null}
              {drawerSearchScope === "chats" && chatSearchViewResults.map((result) => (
                <button
                  className="drawer-list-row drawer-list-row--chat-hit"
                  type="button"
                  key={`${result.chatId}:${result.messageId ?? result.role}`}
                  title={`${result.projectPath} · ${result.title}`}
                  onClick={() => void openChatSearchResult(result)}
                >
                  <AppIcon name={result.bookmarked ? "bookmark" : result.pinned ? "pin" : "agent"} />
                  <span className="drawer-list-row__main">{result.title}</span>
                  <span className="drawer-list-row__meta">{result.projectName}{result.archived ? " · Archived" : ""}</span>
                  <span className="drawer-list-row__snippet">{result.snippet}</span>
                </button>
              ))}
              {workspacePath && drawerSearchScope === "files" && drawerSearchResults.length === 0 ? <div className="rail-status">No matching files</div> : null}
              {workspacePath && drawerSearchScope === "files" && drawerSearchResults.map((file) => (
                <button
                  className="drawer-list-row"
                  type="button"
                  key={file.path}
                  title={file.path}
                  onClick={() => void requestOpenEditorFile(file, { focusEditor: true })}
                >
                  <AppIcon name="file" />
                  <span className="drawer-list-row__main">{file.name}</span>
                  <span className="drawer-list-row__meta">{pathBreadcrumbs(workspacePath, file.path).join(" / ")}</span>
                </button>
              ))}
              {workspacePath && drawerSearchScope === "text" && drawerSearchQuery.trim().length < 2 ? <div className="rail-status">Type at least 2 characters to search text</div> : null}
              {workspacePath && drawerSearchScope === "text" && textSearchLoading ? <div className="rail-status">Searching text…</div> : null}
              {workspacePath && drawerSearchScope === "text" && textSearchError ? <div className="rail-status rail-status--error">{textSearchError}</div> : null}
              {workspacePath && drawerSearchScope === "text" && drawerSearchQuery.trim().length >= 2 && !textSearchLoading && !textSearchError && textSearchResults.length === 0 ? (
                <div className="rail-status">No text matches. Try fewer words or switch to Files.</div>
              ) : null}
              {workspacePath && drawerSearchScope === "text" && textSearchResults.map((match) => (
                <button
                  className="drawer-list-row drawer-list-row--search-hit"
                  type="button"
                  key={`${match.path}:${match.line}:${match.column}`}
                  title={`${match.relativePath}:${match.line}:${match.column}`}
                  onClick={() => openTextSearchResult(match)}
                >
                  <AppIcon name="search" />
                  <span className="drawer-list-row__main">{match.relativePath}</span>
                  <span className="drawer-list-row__meta">{`Ln ${match.line}, Col ${match.column}`}</span>
                  <span className="drawer-list-row__snippet">{match.lineText}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}
        {!sideDrawerCollapsed && sideDrawerMode === "git" ? (
          <section className="drawer-panel" aria-label="Source control">
            <div className="panel-title panel-title--with-action">
              <span>Source Control</span>
              <button
                className="rail-open-button"
                type="button"
                disabled={!workspacePath || gitStatusLoading}
                onClick={() => void refreshGitStatus()}
              >
                <AppIcon name="reload" />
                <span>Refresh</span>
              </button>
            </div>
            {gitStatusLoading ? <div className="rail-status">Reading git status…</div> : null}
            {gitStatusError ? <div className="rail-status rail-status--error">{gitStatusError}</div> : null}
            {!workspacePath ? <div className="rail-status">Open a folder to read source control</div> : null}
            {workspacePath && gitStatus?.isRepository === false ? <div className="rail-status">This workspace is not a Git repository</div> : null}
            {gitStatus?.isRepository ? (
              <>
                <div className="drawer-summary">
                  <div>
                    <span>Branch</span>
                    <strong>{gitStatus.branch ?? "Detached"}</strong>
                  </div>
                  <div>
                    <span>Changes</span>
                    <strong>{gitStatus.files.length}</strong>
                  </div>
                  <div>
                    <span>Staged</span>
                    <strong>{gitStatus.staged}</strong>
                  </div>
                  <div>
                    <span>Untracked</span>
                    <strong>{gitStatus.untracked}</strong>
                  </div>
                  {gitStatus.ahead > 0 || gitStatus.behind > 0 ? (
                    <div>
                      <span>Remote</span>
                      <strong>{`+${gitStatus.ahead} / -${gitStatus.behind}`}</strong>
                    </div>
                  ) : null}
                </div>
                <div className="drawer-list">
                  {gitStatus.files.length === 0 ? <div className="rail-status">Working tree clean</div> : null}
                  {gitStatus.files.map((file) => (
                    <button
                      className="drawer-list-row"
                      type="button"
                      key={`${file.index}${file.worktree}${file.path}`}
                      title={`${gitStatusLabel(file)} · ${file.path}`}
                      onClick={() => void openGitDiff(file)}
                    >
                      <AppIcon name={file.index === "?" ? "filePlus" : "git"} />
                      <span className="drawer-list-row__main">{basename(file.path)}</span>
                      <span className="drawer-list-row__meta">{gitStatusLabel(file)} · Review diff</span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </section>
        ) : null}
        {!sideDrawerCollapsed && sideDrawerMode === "browser" ? (
          <section className="drawer-panel" aria-label="Browser tools">
            <div className="panel-title panel-title--with-action">
              <span>Browser</span>
              <button className="rail-open-button" type="button" onClick={() => setWorkbenchLayout(workbenchLayout === "hidden" ? "right" : workbenchLayout)}>
                <AppIcon name="browser" />
                <span>Show</span>
              </button>
            </div>
            <form className="drawer-form" onSubmit={submitBrowserAddress}>
              <label className="drawer-field">
                <span>Preview URL</span>
                <input
                  value={browserAddress}
                  placeholder="localhost:5173"
                  onChange={(event) => {
                    setBrowserAddress(event.currentTarget.value);
                    setBrowserError(null);
                  }}
                />
              </label>
              <button className="rail-open-button" type="submit">
                <AppIcon name="browser" />
                <span>Open</span>
              </button>
            </form>
            {browserError ? <div className="rail-status rail-status--error">{browserError}</div> : null}
            {activeDetectedLocalDevServer ? (
              <div className="drawer-detected-server" title={activeDetectedLocalDevServer.url}>
                <div>
                  <span>Detected from {activeDetectedLocalDevServer.paneLabel}</span>
                  <strong>{activeDetectedLocalDevServer.url}</strong>
                </div>
                <button className="rail-open-button" type="button" disabled={activeDetectedLocalDevServer.url === browserUrl} onClick={() => void openDetectedLocalDevServer()}>
                  <AppIcon name="browser" />
                  <span>{activeDetectedLocalDevServer.url === browserUrl ? "Current" : "Open detected"}</span>
                </button>
              </div>
            ) : null}
            <div className="drawer-action-grid">
              <button className="rail-open-button" type="button" disabled={!browserCanGoBack} onClick={() => goBrowserHistory(-1)}>
                <AppIcon name="back" />
                <span>Back</span>
              </button>
              <button className="rail-open-button" type="button" disabled={!browserCanGoForward} onClick={() => goBrowserHistory(1)}>
                <AppIcon name="forward" />
                <span>Forward</span>
              </button>
              <button className="rail-open-button" type="button" onClick={reloadBrowserPreview}>
                <AppIcon name="reload" />
                <span>Reload</span>
              </button>
              <button className="rail-open-button" type="button" onClick={() => void openUrl(browserUrl)}>
                <AppIcon name="openExternal" />
                <span>External</span>
              </button>
            </div>
            <div className="drawer-callout" title={browserUrl}>
              <AppIcon name="browser" />
              <span>{browserUrl}</span>
            </div>
          </section>
        ) : null}
        {!sideDrawerCollapsed && sideDrawerMode === "settings" ? (
          <section className="drawer-panel" aria-label="Settings">
            <div className="panel-title">Settings</div>
            <label className="drawer-field">
              <span>New terminal pane profile</span>
              <select
                value={terminalLaunchProfile.id}
                disabled={launchProfileChanging}
                onChange={(event) => void switchTerminalLaunchProfile(resolveLaunchProfile(event.currentTarget.value))}
              >
                {allLaunchProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="drawer-field">
              <span>Permission mode</span>
              <select
                value={activeComposerHarness.approvalMode}
                disabled={!activeComposerHarnessKey}
                onChange={(event) => void setComposerApprovalMode(event.currentTarget.value as AgentApprovalMode)}
              >
                <option value="ask">Ask</option>
                <option value="approveSafe">Approve safe</option>
                <option value="fullAccess">Full access</option>
              </select>
            </label>
            <label className="drawer-field">
              <span>Bottom tray</span>
              <select
                value={agentSurfaceMode}
                onChange={(event) => event.currentTarget.value === "terminal"
                  ? void toggleRawTerminal()
                  : setAgentSurfaceMode("chat")}
              >
                <option value="chat">Collapsed</option>
                <option value="terminal">Terminal open</option>
              </select>
            </label>
            <label className="drawer-field">
              <span>Tool tray</span>
              <select value={renderedWorkbenchLayout} onChange={(event) => setWorkbenchLayout(event.currentTarget.value as WorkbenchLayoutMode)}>
                <option value="left">Left</option>
                <option value="right">Right</option>
                <option value="bottom">Bottom</option>
                <option value="hidden">Hidden</option>
              </select>
            </label>
            <label className="drawer-field">
              <span>Tray tabs</span>
              <select value={toolTrayMode} onChange={(event) => setToolTrayMode(event.currentTarget.value as ToolTrayMode)}>
                <option value="files">Files</option>
                <option value="split">Split editor + browser</option>
                <option value="editor">Editor only</option>
                <option value="browser">Browser only</option>
                <option value="git">Git</option>
              </select>
            </label>
            <div className="drawer-action-grid">
              <button className="rail-open-button" type="button" onClick={pickWorkspace}>
                <AppIcon name="folderOpen" />
                <span>Open Folder</span>
              </button>
              <button className="rail-open-button" type="button" disabled={!workspacePath} onClick={refreshFileTree}>
                <AppIcon name="reload" />
                <span>Refresh Files</span>
              </button>
            </div>
          </section>
        ) : null}
        {!sideDrawerCollapsed && sideDrawerMode === "files" ? (
          <div ref={railBodyRef} className="rail-tree">
            {fileTreeLoading ? <div className="rail-status">Loading…</div> : null}
            {fileTreeError ? <div className="rail-status rail-status--error">{fileTreeError}</div> : null}
            {fileOpError ? <div className="rail-status rail-status--error">{fileOpError}</div> : null}
            {!fileTreeLoading && !fileTreeError && workspacePath && fileTree.length === 0 ? (
              <div className="rail-status">Empty folder</div>
            ) : null}
            {!workspacePath ? <div className="rail-status">Open a folder</div> : null}
            {workspacePath && fileTree.length > 0 ? (
              <Tree<FileTreeNode>
                ref={treeRef}
                aria-label="Project files"
                data={visibleFileTree}
                idAccessor="id"
                childrenAccessor="children"
                rowHeight={24}
                height={railHeight}
                width="100%"
                indent={14}
                overscanCount={8}
                disableDrag
                disableDrop
                disableEdit
                disableMultiSelection
                selection={selectedFile?.id}
                onActivate={(node) => {
                  if (node.data.kind === "directory") {
                    node.toggle();
                  } else if (node.data.gitStatus?.code === "deleted") {
                    node.select();
                  } else {
                    void requestOpenEditorFile(node.data, { focusEditor: true });
                  }
                }}
              >
                {FileTreeRow}
              </Tree>
            ) : null}
            {fileTreeTruncated ? <div className="rail-status rail-status--muted">Showing first 8000 entries</div> : null}
          </div>
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
        <section className="files-dock" aria-label="Project files">
          <div className="dock-surface__header">
            <span title={workspacePath ?? ""}>{workspacePath ? basename(workspacePath) : "Files"}</span>
            <div className="dock-surface__actions">
              <button type="button" disabled={!workspacePath} title="New file" aria-label="Create new file" onClick={() => void createFileInRail()}>
                <AppIcon name="filePlus" />
              </button>
              <button type="button" disabled={!workspacePath} title="New folder" aria-label="Create new folder" onClick={() => void createFolderInRail()}>
                <AppIcon name="folderPlus" />
              </button>
              <button type="button" disabled={!workspacePath} title="Refresh files" aria-label="Refresh files" onClick={refreshFileTree}>
                <AppIcon name="reload" />
              </button>
            </div>
          </div>
          <label className="dock-file-filter">
            <AppIcon name="search" />
            <input aria-label="Filter files" value={drawerSearchQuery} placeholder="Filter files…" onChange={(event) => setDrawerSearchQuery(event.currentTarget.value)} />
          </label>
          <div className="dock-file-list">
            {fileTreeLoading ? <div className="rail-status">Loading files…</div> : null}
            {fileTreeError ? <div className="rail-status rail-status--error">{fileTreeError}</div> : null}
            {!workspacePath ? <div className="rail-status">Open a folder to browse files</div> : null}
            {workspacePath && !fileTreeLoading && searchableFiles.length === 0 ? <div className="rail-status">Empty folder</div> : null}
            {(drawerSearchQuery.trim() ? drawerSearchResults : searchableFiles.slice(0, 600)).map((file) => (
              <button
                className={`dock-file-row ${selectedFile?.path === file.path ? "dock-file-row--active" : ""}`}
                type="button"
                key={file.path}
                title={file.path}
                onClick={() => void requestOpenEditorFile(file, { focusEditor: true })}
              >
                <AppIcon name="file" />
                <span className="dock-file-row__name">{file.name}</span>
                <span className="dock-file-row__path">{pathBreadcrumbs(workspacePath, file.path).slice(0, -1).join(" / ")}</span>
              </button>
            ))}
            {!drawerSearchQuery.trim() && searchableFiles.length > 600 ? <div className="rail-status rail-status--muted">Showing first 600 files. Use Quick Open for the full workspace.</div> : null}
          </div>
        </section>
        <section className="git-dock" aria-label="Source control">
          <div className="dock-surface__header">
            <span>{gitStatus?.branch ?? "Source Control"}</span>
            <div className="dock-surface__actions">
              <button type="button" disabled={!workspacePath || gitStatusLoading} title="Refresh source control" aria-label="Refresh source control" onClick={() => void refreshGitStatus()}>
                <AppIcon name="reload" />
              </button>
            </div>
          </div>
          <div className="git-dock__summary">
            <span>{gitStatus?.files.length ?? 0} changes</span>
            <span>{gitStatus?.staged ?? 0} staged</span>
            <span>{gitStatus?.untracked ?? 0} untracked</span>
          </div>
          <div className="dock-file-list">
            {gitStatusLoading ? <div className="rail-status">Reading git status…</div> : null}
            {gitStatusError ? <div className="rail-status rail-status--error">{gitStatusError}</div> : null}
            {!workspacePath ? <div className="rail-status">Open a folder to read source control</div> : null}
            {workspacePath && gitStatus?.isRepository === false ? <div className="rail-status">This workspace is not a Git repository</div> : null}
            {gitStatus?.isRepository && gitStatus.files.length === 0 ? <div className="rail-status">Working tree clean</div> : null}
            {gitStatus?.files.map((file) => (
              <button
                className="dock-file-row"
                type="button"
                key={`${file.index}${file.worktree}${file.path}`}
                title={`${gitStatusLabel(file)} · ${file.path}`}
                onClick={() => void openGitDiff(file)}
                onContextMenu={(event) => openContextMenu(event, gitFileContextMenuItems(file))}
              >
                <AppIcon name={file.index === "?" ? "filePlus" : "git"} />
                <span className="dock-file-row__name">{basename(file.path)}</span>
                <span className="dock-file-row__path">{gitStatusLabel(file)}</span>
              </button>
            ))}
          </div>
        </section>
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
          <div className="editor-tabbar">
            <div className="editor-tabs" role="tablist" aria-label="Open files">
              {diffReview || diffReviewLoading || diffReviewError ? (
                <div className="editor-tab editor-tab--active editor-tab--diff" title={diffReview?.response.path ?? diffReviewError ?? "Loading diff"}>
                  <button
                    className="editor-tab__activate"
                    type="button"
                    role="tab"
                    aria-selected="true"
                    aria-label={diffReview ? `Diff for ${diffReview.response.path}` : "Diff review"}
                  >
                    <span className="editor-tab__name">{diffReview ? `Diff: ${basename(diffReview.response.path)}` : "Diff review"}</span>
                  </button>
                  <button
                    className="editor-tab__close"
                    type="button"
                    aria-label="Close diff review"
                    title="Close diff review"
                    onPointerDown={(event) => {
                      if (event.button !== 0) return;
                      event.preventDefault();
                      event.stopPropagation();
                      closeDiffReview();
                    }}
                  >
                    <AppIcon name="close" />
                  </button>
                </div>
              ) : null}
              {editorTabs.length > 0 ? (
                editorTabs.map((tab) => {
                  const active = selectedFile?.path === tab.path;
                  const dirty = tabIsDirty(tab.path);
                  return (
                    <div
                      className={`editor-tab ${dirty ? "editor-tab--dirty" : ""} ${active ? "editor-tab--active" : ""}`}
                      title={tab.path}
                      key={tab.path}
                      onContextMenu={(event) => openContextMenu(event, editorTabContextMenuItems(tab))}
                    >
                      <button
                        className="editor-tab__activate"
                        type="button"
                        role="tab"
                        aria-selected={active}
                        aria-label={`${tab.name}${dirty ? ", unsaved changes" : ""}`}
                        onPointerDown={(event) => {
                          if (event.button !== 0) return;
                          event.preventDefault();
                          void requestOpenEditorFile(tab, { focusEditor: true });
                        }}
                      >
                        <span className="editor-tab__name">{tab.name}</span>
                        {dirty ? <span className="editor-tab__dirty" aria-label="Unsaved changes" /> : null}
                      </button>
                      <button
                        className="editor-tab__close"
                        type="button"
                        aria-label={`Close ${tab.name}`}
                        title={shortcutTitle("editor.close-tab", `Close ${tab.name}`)}
                        onPointerDown={(event) => {
                          if (event.button !== 0) return;
                          event.preventDefault();
                          event.stopPropagation();
                          void closeEditorTab(tab);
                        }}
                      >
                        <AppIcon name="close" />
                      </button>
                    </div>
                  );
                })
              ) : !diffReview && !diffReviewLoading && !diffReviewError ? (
                <div className="editor-tab editor-tab--empty">
                  <span className="editor-tab__name">No file open</span>
                </div>
              ) : null}
            </div>
            {diffReview || diffReviewLoading || diffReviewError ? (
              <div className="editor-actions editor-actions--diff">
                <button
                  className="editor-command"
                  type="button"
                  disabled={!diffReview || !diffReviewCanStage || diffReviewLoading}
                  title="Stage file"
                  onClick={() => diffReview && void runGitFileAction("stage", diffReview.file)}
                >
                  <AppIcon name="git" />
                  <span>Stage</span>
                </button>
                <button
                  className="editor-command"
                  type="button"
                  disabled={!diffReview || !diffReviewCanUnstage || diffReviewLoading}
                  title="Unstage file"
                  onClick={() => diffReview && void runGitFileAction("unstage", diffReview.file)}
                >
                  <AppIcon name="git" />
                  <span>Unstage</span>
                </button>
                <button
                  className="editor-command editor-command--danger"
                  type="button"
                  disabled={!diffReview || !diffReviewCanDiscard || diffReviewLoading}
                  title="Discard unstaged changes"
                  onClick={() => diffReview && void runGitFileAction("discard", diffReview.file)}
                >
                  <AppIcon name="error" />
                  <span>Discard</span>
                </button>
                <button
                  className="editor-command"
                  type="button"
                  disabled={!diffReview || diffReview.response.diff.length === 0}
                  title="Copy shown diff"
                  onClick={() => void copyShownDiff()}
                >
                  <AppIcon name="copy" />
                  <span>Copy</span>
                </button>
                <button
                  className="editor-command"
                  type="button"
                  disabled={!diffReview || !diffReviewCanOpenFile}
                  title={diffReviewCanOpenFile ? "Open file" : "File cannot be opened from this diff"}
                  onClick={() => void openDiffFile()}
                >
                  <AppIcon name="file" />
                </button>
                <button className="editor-command" type="button" title="Close diff review" onClick={closeDiffReview}>
                  <AppIcon name="close" />
                </button>
              </div>
            ) : selectedFile ? (
              <div className="editor-actions">
                {activeFileMissing ? <span className="editor-badge editor-badge--warn">Missing from tree</span> : null}
                <span className="editor-meta">{editorLanguage}</span>
                <span className="editor-meta">{formatBytes(editorBytes)}</span>
                <span className="editor-meta">
                  Ln {editorCursor.line}, Col {editorCursor.column}
                </span>
                <span className="editor-status" title={selectedFile.path}>
                  {editorLoading ? "Loading" : editorDirty ? "Unsaved" : "Saved"}
                </span>
                <button className="editor-command" type="button" disabled={editorLoading} title={shortcutTitle("editor.find", "Find and replace")} onClick={openEditorSearch}>
                  <AppIcon name="search" />
                  <span>Find</span>
                </button>
                <button
                  className="editor-save"
                  type="button"
                  disabled={!editorDirty || editorSaving || editorLoading}
                  title={shortcutTitle("editor.save", "Save")}
                  onClick={() => void saveEditorFile()}
                >
                  <AppIcon name={editorSaving ? "loading" : "save"} />
                  <span>{editorSaving ? "Saving" : "Save"}</span>
                </button>
              </div>
            ) : null}
          </div>
          {diffReview ? (
            <nav className="editor-pathbar" aria-label="Diff file path" title={diffReview.absolutePath}>
              {diffBreadcrumbs.map((part, index) => (
                <span className="editor-crumb" key={`${part}-${index}`}>
                  {index > 0 ? <span className="editor-crumb__separator">/</span> : null}
                  <span className={index === diffBreadcrumbs.length - 1 ? "editor-crumb__current" : ""}>{part}</span>
                </span>
              ))}
            </nav>
          ) : selectedFile ? (
            <nav className="editor-pathbar" aria-label="Active file path" title={selectedFile.path}>
              {editorBreadcrumbs.map((part, index) => (
                <span className="editor-crumb" key={`${part}-${index}`}>
                  {index > 0 ? <span className="editor-crumb__separator">/</span> : null}
                  <span className={index === editorBreadcrumbs.length - 1 ? "editor-crumb__current" : ""}>{part}</span>
                </span>
              ))}
            </nav>
          ) : null}
          {diffReview || diffReviewLoading || diffReviewError ? (
            <div className="diff-view" aria-label="Diff review" onContextMenu={(event) => openContextMenu(event, diffContextMenuItems())}>
              {diffReviewLoading ? <div className="diff-empty">Loading diff…</div> : null}
              {diffReviewError ? (
                <div className="editor-error editor-error--inline">
                  <div className="editor-error__title">Diff failed</div>
                  <div className="editor-error__body">{diffReviewError}</div>
                </div>
              ) : null}
              {diffReview && !diffReviewLoading ? (
                <>
                  <div className="diff-view__header">
                    <div>
                      <div className="diff-view__title">{diffReview.response.path}</div>
                      <div className="diff-view__meta">{gitStatusLabel(diffReview.file)} · {diffReview.response.source}</div>
                    </div>
                    <div className="diff-view__summary" aria-label="Diff summary">
                      <span className="diff-view__additions">+{diffReview.parsed.additions}</span>
                      <span className="diff-view__deletions">-{diffReview.parsed.deletions}</span>
                    </div>
                  </div>
                  {diffReview.parsed.lines.length === 0 ? (
                    <div className="diff-empty">No diff for this file.</div>
                  ) : (
                    <div className="diff-view__body" role="table" aria-label={`Diff for ${diffReview.response.path}`}>
                      {diffReview.parsed.lines.map((line) => (
                        <div className={`diff-line diff-line--${line.kind}`} role="row" key={line.id}>
                          <span className="diff-line__number" aria-label={line.oldLine == null ? "No old line" : `Old line ${line.oldLine}`}>{line.oldLine ?? ""}</span>
                          <span className="diff-line__number" aria-label={line.newLine == null ? "No new line" : `New line ${line.newLine}`}>{line.newLine ?? ""}</span>
                          {line.kind === "hunk" ? (
                            <button
                              className="diff-line__jump"
                              type="button"
                              disabled={!diffReviewCanOpenFile || line.hunkNewStart == null}
                              title={diffReviewCanOpenFile ? "Open file at hunk" : "File cannot be opened from this diff"}
                              onClick={() => void openDiffFile(line.hunkNewStart)}
                            >
                              {line.text}
                            </button>
                          ) : (
                            <code className="diff-line__code">{line.text || " "}</code>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          ) : selectedFile ? (
            <div
              className="editor-code"
              onContextMenu={(event) => openContextMenu(event, editorContextMenuItems())}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
                  event.preventDefault();
                  void saveEditorFile();
                }
              }}
            >
              {editorError ? (
                <EditorSaveError
                  message={editorError}
                  recoveryError={editorRecoveryError}
                  saving={editorSaving}
                  canOpenExternally={Boolean(selectedFile)}
                  conflict={editorSaveConflict}
                  onRetry={() => void saveEditorFile()}
                  onReload={() => void reloadSelectedFileFromDisk()}
                  onOverwrite={() => void overwriteSelectedFile()}
                  onOpenExternally={() => void openSelectedFileExternally()}
                />
              ) : null}
              <CodeMirror
                key={selectedFile.path}
                value={editorText}
                height="100%"
                theme={oneDark}
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: true,
                  highlightActiveLine: true,
                  highlightActiveLineGutter: true,
                }}
                editable={!editorLoading}
                extensions={editorExtensionsFor(selectedFile.path)}
                onChange={(value) => setEditorText(value)}
                onCreateEditor={restoreEditorView}
                onUpdate={handleEditorUpdate}
              />
            </div>
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

        <section className="browser-preview" aria-label="Browser preview" onContextMenu={(event) => openContextMenu(event, browserContextMenuItems())}>
          <div className="browser-toolbar">
            <div className="browser-toolbar__nav" aria-label="Browser navigation">
              <button
                className="browser-button"
                type="button"
                title="Back"
                aria-label="Back"
                disabled={!browserCanGoBack}
                onClick={() => goBrowserHistory(-1)}
              >
                <AppIcon name="back" />
              </button>
              <button
                className="browser-button"
                type="button"
                title="Forward"
                aria-label="Forward"
                disabled={!browserCanGoForward}
                onClick={() => goBrowserHistory(1)}
              >
                <AppIcon name="forward" />
              </button>
              <button className="browser-button" type="button" title="Reload" aria-label="Reload browser preview" onClick={reloadBrowserPreview}>
                <AppIcon name="reload" />
              </button>
            </div>
            <form className="browser-address" onSubmit={submitBrowserAddress}>
              <label className="browser-address__label" htmlFor="browser-preview-url">
                Preview URL
              </label>
              <AppIcon name="browser" />
              <input
                id="browser-preview-url"
                value={browserAddress}
                spellCheck={false}
                inputMode="url"
                placeholder="localhost:3000"
                onChange={(event) => {
                  setBrowserAddress(event.currentTarget.value);
                  setBrowserError(null);
                }}
              />
              <button className="browser-button browser-button--go" type="submit" title="Open preview URL">
                Open
              </button>
            </form>
            <button className="browser-button" type="button" title="Open preview externally" aria-label="Open preview externally" onClick={() => void openUrl(browserUrl)}>
              <AppIcon name="openExternal" />
            </button>
          </div>
          {activeDetectedLocalDevServer && activeDetectedLocalDevServer.url !== browserUrl ? (
            <div className="browser-detected-banner" title={activeDetectedLocalDevServer.url}>
              <AppIcon name="browser" />
              <span>Detected dev server from {activeDetectedLocalDevServer.paneLabel}</span>
              <button type="button" onClick={() => void openDetectedLocalDevServer()}>
                Open detected
              </button>
            </div>
          ) : null}
          <div className="browser-frame-wrap">
            {browserError ? <div className="browser-error" role="alert">{browserError}</div> : null}
            <iframe
              key={`${browserUrl}-${browserReloadNonce}`}
              className="browser-frame"
              title={`Browser preview: ${browserUrl}`}
              src={browserUrl}
              referrerPolicy="no-referrer"
            />
          </div>
        </section>

        <section className={`terminal-panel terminal-panel--${agentSurfaceMode}`} aria-label="Agent conversation">
          <div className="terminal-titlebar">
            <div className="terminal-profile">
              <span className="terminal-kicker">Thread</span>
              <span className="terminal-title">
                <AppIcon name="agent" />
                <span>{activeSessionTitle}</span>
              </span>
              <span className="terminal-command" title={launchProfileCommandLine(activeTerminalProfile)}>
                {launchProfileCommandLine(activeTerminalProfile)}
              </span>
              <span className="terminal-mode">{launchProfileMode(activeTerminalProfile)}</span>
              <span
                className={`terminal-state terminal-state--${terminalPaneState}`}
                aria-label={paneStateAccessibleLabel(terminalPaneState, terminalStatusLabel)}
                title={paneStateAccessibleLabel(terminalPaneState, terminalStatusLabel)}
              >
                <AppIcon name={paneStateIconName(terminalPaneState)} />
                <span>{terminalStatusLabel}</span>
              </span>
              <span className="terminal-cwd" title={workspacePath ?? ""}>
                {terminalPaneCwdLabel(workspacePath)}
              </span>
            </div>
            <div className="terminal-actions">
              <button className="terminal-tab-action" type="button" title="Open workspace externally" aria-label="Open workspace externally" disabled={!workspacePath} onClick={() => workspacePath && void openPath(workspacePath)}>
                <AppIcon name="openExternal" />
              </button>
              <button className="terminal-tab-action" type="button" title="Thread settings" aria-label="Thread settings" onClick={() => setSettingsOpen(true)}>
                <AppIcon name="settings" />
              </button>
              <ToolDockMenu
                layout={renderedWorkbenchLayout}
                toolMode={toolTrayMode}
                onLayoutChange={setWorkbenchLayout}
                onToolModeChange={setToolTrayMode}
              />
            </div>
          </div>
          <div className={`agent-surface agent-surface--${agentSurfaceMode}`}>
            <ChatThreadSurface
              conversation={activeChatConversation}
              events={selectedAgentActivityLog}
              hidden={false}
              onSuggestion={(draft) => setComposerLocalState(activeComposerHarnessKey, draft, composerHistory)}
              onRetry={(prompt) => void submitComposerDraft(prompt)}
              onApprovalDecision={(message, decision) => void resolveChatApproval(message, decision)}
              onToggleBookmark={toggleChatMessageBookmark}
              focusMessageId={focusedChatMessageId}
            />
          </div>
          <div className="agent-composer" aria-label="Agent composer" onContextMenu={(event) => openContextMenu(event, composerContextMenuItems())}>
            <div className="agent-composer__card">
              <textarea
                className="agent-composer__input"
                aria-label="Agent composer draft"
                value={composerDraft}
                rows={2}
                placeholder="Ask Keelhouse to run agents, open files, inspect git, or use the browser..."
                disabled={composerSending}
                onChange={(event) => {
                  setComposerLocalState(activeComposerHarnessKey, event.currentTarget.value, composerHistory);
                  setComposerHistoryIndex(null);
                }}
                onPaste={(event) => {
                  if ([...event.clipboardData.types].some((type) => type.startsWith("image/"))) {
                    event.preventDefault();
                    void pasteComposerImage();
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void submitComposerDraft();
                  } else if (event.key === "Escape") {
                    event.currentTarget.blur();
                  } else if (event.key === "ArrowUp" && !composerDraft && composerHistory.length > 0) {
                    event.preventDefault();
                    showPreviousComposerHistory();
                  } else if (event.key === "ArrowDown" && composerHistoryIndex != null) {
                    event.preventDefault();
                    showNextComposerHistory();
                  }
                }}
              />
              {composerMentionQuery != null && composerMentionResults.length > 0 ? (
                <div className="agent-composer__mentions" role="listbox" aria-label="Attach workspace file">
                  {composerMentionResults.map((file) => (
                    <button
                      key={file.path}
                      type="button"
                      role="option"
                      onClick={() => {
                        setComposerLocalState(activeComposerHarnessKey, composerDraft.replace(/@[^\s@]*$/, ""), composerHistory);
                        void attachWorkspaceFileToComposer(file);
                      }}
                    >
                      <AppIcon name="file" />
                      <span>{file.name}</span>
                      <small>{file.path}</small>
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="agent-composer__bar">
                <div className="agent-composer__attachments" aria-label="Composer context">
                  <button
                    className="agent-composer__attachment-button"
                    type="button"
                    aria-label="Attach file"
                    title="Attach file"
                    disabled={!activeComposerHarnessKey}
                    onClick={() => void attachLocalFileToComposer()}
                  >
                    <AppIcon name="plus" />
                  </button>
                  <details className="agent-composer__menu agent-composer__menu--permission">
                    <summary className={`agent-composer__control ${activeComposerHarness.approvalMode === "fullAccess" ? "agent-composer__control--warning" : ""}`}>
                      <AppIcon name="shield" />
                      <span>{composerApprovalLabel(activeComposerHarness.approvalMode)}</span>
                      <AppIcon name="chevronDown" />
                    </summary>
                    <div className="agent-composer__popover agent-composer__popover--permission" role="menu" aria-label="Composer permission mode">
                      <div className="agent-composer__popover-title">Permission mode</div>
                      {([
                        ["ask", "Ask for approval", "Confirm edits, commands, and network access."],
                        ["approveSafe", "Approve safe actions", "Run workspace-scoped actions and ask for riskier access."],
                        ["fullAccess", "Full access", "Allow unrestricted file and network access."],
                      ] as const).map(([value, label, description]) => (
                        <button
                          className={`agent-composer__menu-option ${activeComposerHarness.approvalMode === value ? "agent-composer__menu-option--selected" : ""}`}
                          type="button"
                          role="menuitemradio"
                          aria-checked={activeComposerHarness.approvalMode === value}
                          key={value}
                          onClick={(event) => {
                            event.currentTarget.closest("details")?.removeAttribute("open");
                            void setComposerApprovalMode(value);
                          }}
                        >
                          <AppIcon name={activeComposerHarness.approvalMode === value ? "check" : "shield"} />
                          <span><strong>{label}</strong><small>{description}</small></span>
                        </button>
                      ))}
                    </div>
                  </details>
                  <details className="agent-composer__menu agent-composer__menu--goal">
                    <summary className={`agent-composer__control ${activeComposerHarness.goal ? "agent-composer__control--active" : ""}`}>
                      <AppIcon name="target" />
                      <span>Goal</span>
                    </summary>
                    <div className="agent-composer__popover agent-composer__popover--goal">
                      <label className="agent-composer__popover-field">
                        <span>Goal for this chat</span>
                        <input
                          aria-label="Composer goal"
                          value={activeComposerHarness.goal}
                          maxLength={160}
                          placeholder="Optional outcome to keep in context"
                          disabled={!activeComposerHarnessKey}
                          onChange={(event) => void setComposerGoal(event.currentTarget.value)}
                          onBlur={() => void setComposerGoal(activeComposerHarness.goal, { log: true })}
                        />
                      </label>
                      {activeComposerHarness.goal ? (
                        <button className="agent-composer__clear" type="button" onClick={() => void setComposerGoal("")}>Clear goal</button>
                      ) : null}
                    </div>
                  </details>
                  <div className="agent-composer__attachment-list">
                    {activeComposerHarness.attachments.map((attachment) => (
                      <span className="agent-composer__attachment" key={attachment.id} title={attachment.target}>
                        {attachment.kind === "image" ? <img src={convertFileSrc(attachment.target)} alt="" /> : null}
                        <span>{attachment.label}</span>
                        <button
                          type="button"
                          aria-label={`Remove attachment ${attachment.label}`}
                          onClick={() => void removeComposerAttachmentById(attachment)}
                        >
                          <AppIcon name="close" />
                        </button>
                      </span>
                    ))}
                  </div>
                  {activeComposerHarness.attachments.length > 0 || activeComposerHarness.goal ? (
                    <button className="agent-composer__control" type="button" onClick={() => void reviewComposerContext()}>
                      <AppIcon name="search" />
                      <span>Review context</span>
                    </button>
                  ) : null}
                </div>
                <div className="agent-composer__actions">
                  <details className="agent-composer__menu agent-composer__menu--runtime">
                    <summary className="agent-composer__control agent-composer__control--runtime">
                      <AppIcon name="agent" />
                      <span>Codex</span>
                      {activeComposerHarness.model.trim() ? <span className="agent-composer__control-detail">{activeComposerHarness.model.trim()}</span> : null}
                      {activeComposerHarness.reasoningEffort !== "default" ? <span className="agent-composer__control-detail">{composerReasoningLabel(activeComposerHarness.reasoningEffort)}</span> : null}
                      <AppIcon name="chevronDown" />
                    </summary>
                    <div className="agent-composer__popover agent-composer__popover--runtime">
                      <div className="agent-composer__popover-title">Codex run settings</div>
                      <label className="agent-composer__popover-field">
                        <span>Model override</span>
                        <input
                          aria-label="Codex model override"
                          value={activeComposerHarness.model}
                          maxLength={128}
                          placeholder="Use Codex config default"
                          disabled={!activeComposerHarnessKey}
                          onChange={(event) => void setComposerModel(event.currentTarget.value)}
                          onBlur={() => void setComposerModel(activeComposerHarness.model, { log: true })}
                        />
                      </label>
                      <fieldset className="agent-composer__reasoning">
                        <legend>Reasoning effort</legend>
                        <div>
                          {COMPOSER_REASONING_OPTIONS.map((option) => (
                            <button
                              className={activeComposerHarness.reasoningEffort === option.value ? "is-selected" : ""}
                              type="button"
                              aria-pressed={activeComposerHarness.reasoningEffort === option.value}
                              key={option.value}
                              onClick={() => void setComposerReasoningEffort(option.value)}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </fieldset>
                    </div>
                  </details>
                  {activeChatConversation.activeRunId ? (
                    <button
                      className="agent-composer__send agent-composer__send--stop"
                      type="button"
                      aria-label="Stop current chat run"
                      title="Stop current chat run"
                      onClick={() => void stopActiveChatRun()}
                    >
                      <AppIcon name="stop" />
                    </button>
                  ) : (
                    <button
                      className="agent-composer__send"
                      type="button"
                      aria-label={composerSending ? "Sending" : "Send"}
                      title={shortcutTitle("composer.send", "Send")}
                      disabled={composerSending || !composerDraft.trim()}
                      onClick={() => void submitComposerDraft()}
                    >
                      <AppIcon name={composerSending ? "loading" : "send"} />
                    </button>
                  )}
                </div>
              </div>
            </div>
            {composerError ? <div className="agent-composer__error">{composerError}</div> : null}
            {composerNotice ? (
              <div className="agent-composer__notice" role="status">
                <pre>{composerNotice}</pre>
                <button className="agent-composer__button" type="button" aria-label="Dismiss app command help" onClick={() => setComposerNotice(null)}>
                  <AppIcon name="close" />
                </button>
              </div>
            ) : null}
          </div>
        </section>
        <button
          className="utility-tray-resizer"
          type="button"
          aria-label="Resize bottom utility tray"
          title="Resize bottom utility tray"
          onPointerDown={(event) => {
            setAgentSurfaceMode("terminal");
            beginUtilityTrayResize(event);
          }}
        />
        <section className={`utility-tray ${agentSurfaceMode === "terminal" ? "utility-tray--open" : "utility-tray--collapsed"}`} aria-label="Bottom utility tray">
          <nav className="utility-tray__tabs" aria-label="Utility tray surfaces">
            {([
              ["terminal", "terminal", "Terminal"],
              ["processes", "waiting", "Processes"],
              ["logs", "logs", "Logs"],
            ] as const).map(([mode, icon, label]) => (
              <button
                className={`utility-tray__tab ${utilityTrayMode === mode ? "utility-tray__tab--active" : ""}`}
                type="button"
                aria-pressed={agentSurfaceMode === "terminal" && utilityTrayMode === mode}
                key={mode}
                onClick={() => void openUtilityTray(mode)}
                onContextMenu={(event) => openContextMenu(event, utilityTrayTabContextMenuItems(mode))}
              >
                <AppIcon name={icon} />
                <span>{label}</span>
              </button>
            ))}
            <span className="utility-tray__spacer" />
            <button className="utility-tray__icon" type="button" title="Collapse tray" aria-label="Collapse utility tray" onClick={() => setAgentSurfaceMode("chat")}>
              <AppIcon name="chevronDown" />
            </button>
          </nav>
          <div className={`utility-tray__body utility-tray__body--${utilityTrayMode}`}>
            <div className="utility-tray__terminal-controls">
              <div className="terminal-pane-strip" aria-label="Terminal panes">
                {terminalPanes.map((pane, index) => {
                  const label = terminalPaneLabel(pane, index);
                  return (
                    <button
                      key={pane.id}
                      className={`terminal-pane-button ${pane.id === activeTerminalPaneId ? "terminal-pane-button--active" : ""}`}
                      type="button"
                      title={`${label} - ${terminalPaneStateLabel(pane.state, pane.exitCode)}. Double-click to rename.`}
                      aria-label={`Focus ${label}. Double-click to rename.`}
                      aria-pressed={pane.id === activeTerminalPaneId}
                      onClick={() => void focusTerminalPane(pane.id)}
                      onDoubleClick={() => void renameTerminalPane(pane)}
                      onContextMenu={(event) => openContextMenu(event, terminalPaneContextMenuItems(pane))}
                    >
                      <AppIcon name={paneStateIconName(pane.state)} />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
              <span className="utility-tray__spacer" />
              <label className="terminal-profile-picker" title="New terminal profile">
                <select aria-label="New pane profile" value={terminalLaunchProfile.id} disabled={launchProfileChanging} onChange={(event) => void switchTerminalLaunchProfile(resolveLaunchProfile(event.currentTarget.value))}>
                  {allLaunchProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
                </select>
              </label>
              <button className="terminal-new-pane" type="button" title={`New ${terminalLaunchProfile.label} pane`} aria-label={`New ${terminalLaunchProfile.label} pane`} disabled={!workspacePath || launchProfileChanging} onClick={() => void createTerminalPane(terminalLaunchProfile)}>
                <AppIcon name="plus" />
              </button>
              <button className="terminal-new-pane" type="button" title="Find in terminal scrollback" aria-label="Find in terminal scrollback" disabled={!activeTerminalPane} onClick={() => setTerminalFindOpen((open) => !open)}>
                <AppIcon name="search" />
              </button>
              <button className="terminal-new-pane" type="button" title="Restart selected process" aria-label="Restart selected process" disabled={!activeTerminalPane || launchProfileChanging} onClick={() => void restartTerminalPane(activeTerminalPane)}>
                <AppIcon name="reload" />
              </button>
              <button className="terminal-new-pane terminal-new-pane--danger" type="button" title="Kill selected process" aria-label="Kill selected process" disabled={!activeTerminalPane || activeTerminalPane.state === "exited"} onClick={() => void terminateTerminalPane(activeTerminalPane)}>
                <AppIcon name="stop" />
              </button>
              <button className="terminal-new-pane terminal-new-pane--danger" type="button" title="Close selected pane" aria-label="Close selected pane" disabled={!activeAgentSessionHandle} onClick={() => activeAgentSessionHandle && void activeAgentSessionHandle.close()}>
                <AppIcon name="close" />
              </button>
            </div>
            {terminalFindOpen ? (
              <div className="terminal-find" role="search" aria-label="Find in terminal scrollback">
                <AppIcon name="search" />
                <input
                  value={terminalFindQuery}
                  placeholder="Find in scrollback"
                  aria-label="Terminal search query"
                  disabled={terminalFindBusy}
                  onChange={(event) => setTerminalFindQuery(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && event.shiftKey) {
                      event.preventDefault();
                      stepTerminalFind(-1);
                    } else if (event.key === "Enter") {
                      event.preventDefault();
                      if (terminalFindQuery.trim() === terminalFindLastQuery && terminalFindHits.length > 0) stepTerminalFind(1);
                      else void runTerminalFind();
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      closeTerminalFind();
                    }
                  }}
                />
                <span className="terminal-find__count">{terminalFindError ?? terminalFindCountLabel(terminalFindIndex, terminalFindHits.length)}</span>
                <button className="terminal-new-pane" type="button" aria-label="Previous match" title="Previous match" disabled={terminalFindHits.length === 0} onClick={() => stepTerminalFind(-1)}><AppIcon name="chevronUp" /></button>
                <button className="terminal-new-pane" type="button" aria-label="Next match" title="Next match" disabled={terminalFindHits.length === 0} onClick={() => stepTerminalFind(1)}><AppIcon name="chevronDown" /></button>
                {terminalFindIndex != null && terminalFindHits[terminalFindIndex] ? <span className="terminal-find__preview" title={terminalFindHits[terminalFindIndex].text}>{terminalFindHitLabel(terminalFindHits[terminalFindIndex])}</span> : null}
                <button className="terminal-new-pane" type="button" aria-label="Close terminal find" title="Close" onClick={closeTerminalFind}><AppIcon name="close" /></button>
              </div>
            ) : null}
            <div ref={terminalHostRef} className="terminal-host utility-tray__terminal" onPointerDown={() => imeInputRef.current?.focus()} onContextMenu={(event) => openContextMenu(event, terminalContextMenuItems())}>
              <canvas ref={canvasRef} className="term" aria-hidden="true" />
              <textarea
                ref={imeInputRef}
                className="terminal-ime-input"
                tabIndex={0}
                role="application"
                aria-label={`${activeTerminalProfile.label} terminal pane. Type to send keyboard input to the active process.`}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                onCompositionEnd={(event) => {
                  const text = event.data;
                  event.currentTarget.value = "";
                  if (text) invoke("paste", { text }).catch(() => {});
                }}
              />
            </div>
            <div className="utility-tray__processes" aria-label="Processes">
              {terminalPanes.length === 0 ? <div className="utility-tray__empty">No processes in this chat.</div> : terminalPanes.map((pane, index) => (
                <button type="button" key={pane.id} onClick={() => void focusTerminalPane(pane.id)}>
                  <AppIcon name={paneStateIconName(pane.state)} />
                  <span>{terminalPaneLabel(pane, index)}</span>
                  <small>{pane.profile.label}</small>
                  <span>{terminalPaneStateLabel(pane.state, pane.exitCode)}</span>
                </button>
              ))}
            </div>
            <div className="utility-tray__logs" aria-label="Agent logs">
              {selectedAgentActivityLog.length === 0 ? <div className="utility-tray__empty">No activity logged for this chat.</div> : selectedAgentActivityLog.map((event) => (
                <div className="utility-tray__log-row" key={event.id}>
                  <span>{new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  <strong>{event.label}</strong>
                  <span>{event.detail ?? event.target ?? event.kind}</span>
                  <small>{event.status}</small>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {settingsOpen ? (
        <SettingsModal
          approvalSetting={activeApprovalSetting}
          agentConnectionsStatus={agentConnectionsStatus}
          agentConnectionsRefreshing={agentConnectionsRefreshing}
          browserSetting={activeBrowserSetting}
          aiConnectionSettings={aiConnectionSettings}
          connectionSecretPresence={connectionSecretPresence}
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
            label: profile.id === "codex"
              ? profile.label
              : `${profile.label} · ${profile.id === "shell" ? "not a chat provider" : "raw terminal only"}`,
            disabled: profile.id !== "codex",
          }))}
          sessionTitle={activeSessionTitle}
          trayMode={toolTrayMode}
          workspaceName={activeWorkspaceName}
          workspacePath={workspacePath ?? ""}
          onApprovalModeChange={(scope, mode) => {
            if (scope === "chat") void setComposerApprovalMode(mode);
            else void updateScopedSetting(scope, "approvalMode", mode);
          }}
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
          onValidateConnectionTarget={(server: McpServerConfig) => invoke<ConnectionTargetStatus>("validate_connection_target", {
            kind: server.transport,
            target: server.target,
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
            if (!window.confirm("Reset all local data? This clears saved projects, chats, transcripts, layout, and local state files. This cannot be undone.")) return;
            void (async () => {
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
      {transcriptsOpen ? (() => {
        const sessionTranscripts = workspacePath && activeSessionId
          ? transcriptsForSession(paneTranscripts, workspacePath, activeSessionId)
          : [];
        const open = sessionTranscripts.find((t) => t.id === openTranscriptId) ?? sessionTranscripts[0] ?? null;
        return (
          <div
            className="command-palette-backdrop"
            role="presentation"
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) setTranscriptsOpen(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setTranscriptsOpen(false);
              }
            }}
          >
            <div className="transcripts-modal" role="dialog" aria-modal="true" aria-label="Saved transcripts">
              <header className="settings-modal__head">
                <strong>Transcripts</strong>
                <button className="settings-modal__close" type="button" aria-label="Close transcripts" onClick={() => setTranscriptsOpen(false)}>
                  <AppIcon name="close" />
                </button>
              </header>
              <div className="settings-modal__grid">
                <nav className="settings-modal__nav" aria-label="Saved transcripts">
                  {sessionTranscripts.length === 0 ? (
                    <div className="settings-modal__empty">No saved terminal transcripts for this chat yet.</div>
                  ) : (
                    sessionTranscripts.map((transcript) => (
                      <button
                        key={transcript.id}
                        className={`settings-modal__nav-row ${open?.id === transcript.id ? "settings-modal__nav-row--active" : ""}`}
                        type="button"
                        onClick={() => setOpenTranscriptId(transcript.id)}
                      >
                        <AppIcon name="file" />
                        <span>{`${transcript.paneLabel} · ${transcriptTimeLabel(transcript.savedAt, Date.now())}`}</span>
                      </button>
                    ))
                  )}
                </nav>
                <div className="settings-modal__content">
                  {open ? <pre className="transcripts-modal__body" aria-label={`Transcript from ${open.paneLabel}`}>{open.text}</pre> : null}
                </div>
              </div>
            </div>
          </div>
        );
      })() : null}
      {crashNotice ? (
        <div className="crash-notice" role="status">
          <AppIcon name="reload" />
          <span>{crashNotice}</span>
          <button className="editor-command" type="button" aria-label="Dismiss recovery notice" onClick={() => setCrashNotice(null)}>
            <AppIcon name="close" />
          </button>
        </div>
      ) : null}
      {actionNotice ? (
        <div className="context-action-notice" role="status">
          <AppIcon name="check" />
          <span>{actionNotice}</span>
          <button className="editor-command" type="button" aria-label="Dismiss action notice" onClick={() => setActionNotice(null)}>
            <AppIcon name="close" />
          </button>
        </div>
      ) : null}
      {launchError ? (
        <div className="launch-error" role="alert">
          <span className="launch-error__message">{launchError}</span>
          <span className="launch-error__actions">
            <button className="editor-command" type="button" onClick={() => void pickWorkspace()}>
              <AppIcon name="folderOpen" />
              <span>Open Folder</span>
            </button>
            <button
              className="editor-command"
              type="button"
              disabled={launchProfileChanging || launchProfile.id === "shell"}
              onClick={() => {
                const shell = LAUNCH_PROFILES.find((profile) => profile.id === "shell");
                if (shell) void switchLaunchProfile(shell);
              }}
            >
              <AppIcon name="terminal" />
              <span>Use Shell profile</span>
            </button>
          </span>
        </div>
      ) : null}
      {contextMenu ? (
        <ContextMenu
          state={contextMenu}
          onDismiss={() => setContextMenu(null)}
          onActionError={(item, error) => setLaunchError(`${item.label} failed: ${String(error)}`)}
        />
      ) : null}
      {commandPaletteOpen ? (
        <div className="command-palette-backdrop" role="presentation" onPointerDown={closeCommandPalette}>
          <section
            className="command-palette"
            aria-label="Command palette"
            role="dialog"
            aria-modal="true"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="command-palette__field">
              <AppIcon name="search" />
              <input
                ref={commandPaletteInputRef}
                value={commandPaletteQuery}
                aria-label="Search commands"
                placeholder="Run a command..."
                onChange={(event) => {
                  setCommandPaletteQuery(event.currentTarget.value);
                  setCommandPaletteActiveIndex(0);
                }}
                onKeyDown={handleCommandPaletteKeyDown}
              />
              <span>{shortcutKeys("chrome.command-palette")}</span>
            </div>
            <div className="command-palette__list" role="listbox" aria-label="Commands">
              {visibleCommandPaletteCommands.length > 0 ? (
                visibleCommandPaletteCommands.map((command, index) => (
                  <button
                    className={`command-palette__row ${index === commandPaletteActiveIndex ? "command-palette__row--active" : ""}`}
                    type="button"
                    role="option"
                    aria-selected={index === commandPaletteActiveIndex}
                    disabled={command.disabled}
                    key={command.id}
                    onPointerMove={() => setCommandPaletteActiveIndex(index)}
                    onClick={() => runCommandPaletteCommand(command)}
                  >
                    <span className="command-palette__icon">
                      <AppIcon name={command.icon} />
                    </span>
                    <span className="command-palette__copy">
                      <strong>{command.label}</strong>
                      <span>{command.detail}</span>
                    </span>
                    {command.shortcut ? <span className="command-palette__shortcut">{command.shortcut}</span> : null}
                  </button>
                ))
              ) : (
                <div className="command-palette__empty">No commands match</div>
              )}
            </div>
          </section>
        </div>
      ) : null}
      {quickOpenOpen ? (
        <div className="command-palette-backdrop" role="presentation" onPointerDown={closeQuickOpen}>
          <section
            className="command-palette quick-open"
            aria-label="Quick open files"
            role="dialog"
            aria-modal="true"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <div className="command-palette__field">
              <AppIcon name="file" />
              <input
                ref={quickOpenInputRef}
                value={quickOpenQuery}
                aria-label="Quick open file"
                placeholder="Open file by name or path..."
                onChange={(event) => {
                  setQuickOpenQuery(event.currentTarget.value);
                  setQuickOpenActiveIndex(0);
                }}
                onKeyDown={handleQuickOpenKeyDown}
              />
              <span>{shortcutKeys("workspace.quick-open")}</span>
            </div>
            <div className="command-palette__list" role="listbox" aria-label="Files">
              {!workspacePath ? <div className="command-palette__empty">Open a folder before quick open</div> : null}
              {workspacePath && quickOpenResults.length > 0 ? (
                quickOpenResults.map((file, index) => (
                  <button
                    className={`command-palette__row ${index === quickOpenActiveIndex ? "command-palette__row--active" : ""}`}
                    type="button"
                    role="option"
                    aria-selected={index === quickOpenActiveIndex}
                    key={file.path}
                    onPointerMove={() => setQuickOpenActiveIndex(index)}
                    onClick={() => runQuickOpenFile(file)}
                  >
                    <span className="command-palette__icon">
                      <AppIcon name="file" />
                    </span>
                    <span className="command-palette__copy">
                      <strong>{file.name}</strong>
                      <span>{pathBreadcrumbs(workspacePath, file.path).join(" / ")}</span>
                    </span>
                  </button>
                ))
              ) : null}
              {workspacePath && quickOpenResults.length === 0 ? <div className="command-palette__empty">No files match</div> : null}
            </div>
          </section>
        </div>
      ) : null}
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
      <footer className="status-bar" aria-label="Workspace status">
        <div className="status-bar__group status-bar__group--left">
          <span className="status-bar__item">
            <AppIcon name="workspace" />
            <span>{activeWorkspaceName}</span>
          </span>
        </div>
        <div className="status-bar__group status-bar__group--center">
          <span className="status-bar__item">
            <AppIcon name={paneStateIconName(primarySurfaceState)} />
            <span>{primarySurfaceLabel}</span>
            <span>{primarySurfaceStatusLabel}</span>
          </span>
        </div>
        <div className="status-bar__group status-bar__group--right">
          <span className="status-bar__item">{agentSurfaceMode === "chat" ? "Chat" : utilityTrayStatusLabel}</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
