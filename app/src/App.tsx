import { type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { open } from "@tauri-apps/plugin-dialog";
import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { load } from "@tauri-apps/plugin-store";
import type { EditorView, ViewUpdate } from "@codemirror/view";
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
  pushRecentProject,
  removeProjectSession,
  removeOpenProject,
  rememberActiveFile,
  removeRecentProject,
  setActiveProjectSession,
  setOpenProjectStatus,
  setProjectSessionStatus,
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
  defaultLaunchProfile,
  launchProfileById,
  launchProfileCommandLine,
  launchProfileMode,
  normalizeLaunchProfile,
} from "./launchProfiles";
import type { LaunchProfile } from "./launchProfiles";
import {
  composerHistoryAfterSubmit,
  composerHistoryAt,
  nextComposerHistoryIndex,
  previousComposerHistoryIndex,
  routeComposerDraft,
} from "./agentComposer";
import type { ComposerAppCommand } from "./agentComposer";
import { AppIcon, paneStateAccessibleLabel, paneStateIconName } from "./icons";
import type { AppIconName } from "./icons";
import { shortcutKeys, shortcutTitle } from "./shortcuts";
import { terminalPaneCwdLabel, terminalPaneStateLabel } from "./terminalPane";
import type { TerminalPaneState } from "./terminalPane";
import "./App.css";

// SPIKE-2 frontend: paint the grid snapshots from the Rust backend onto a canvas,
// and encode keydowns back into pty bytes. Ship-ugly on purpose.

type Cell = { t: string; f: [number, number, number]; b: [number, number, number]; bold: boolean };
type Snapshot = { cols: number; rows: number; cx: number; cy: number; cvis: boolean; sb: number; cells: Cell[] };
type PaneExit = { paneId: number; command: string; code: number; message: string };
type OpenWorkspaceResponse = { root: string; paneId: number };
type FileTreeNode = {
  id: string;
  name: string;
  path: string;
  kind: "directory" | "file";
  dirty?: boolean;
  children?: FileTreeNode[];
};
type FileTreeResponse = { root: string; nodes: FileTreeNode[]; truncated: boolean };
type WorkspaceTreeChanged = { root: string; count: number };
type TextFileResponse = { path: string; content: string; bytes: number; modifiedMs: number | null };
type FileOpResponse = { path: string };
type OpenEditorFileOptions = { focusEditor?: boolean };
type SaveEditorFileOptions = { force?: boolean };
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
  | { kind: "workspace"; path: string };
type ContextMenuItem = {
  id: string;
  label: string;
  shortcut?: string;
  icon?: AppIconName;
  disabled?: boolean;
  danger?: boolean;
  onSelect: () => void;
};
type ContextMenuState = { x: number; y: number; items: ContextMenuItem[] };

const FONT_SIZE = 15;
const FONT_FAMILY = "JetBrains Mono, monospace";
const LINE_HEIGHT = 1.25;
const rgb = (c: [number, number, number]) => `rgb(${c[0]},${c[1]},${c[2]})`;
const basename = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? path;
const dirname = (path: string) => path.replace(/[\\/][^\\/]*$/, "") || path;
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

const markDirtyFile = (nodes: FileTreeNode[], dirtyPaths: Set<string>): FileTreeNode[] => {
  if (dirtyPaths.size === 0) return nodes;
  return nodes.map((node) => ({
    ...node,
    dirty: dirtyPaths.has(node.path),
    children: node.children ? markDirtyFile(node.children, dirtyPaths) : undefined,
  }));
};

function FileTreeRow({ node, style, dragHandle }: NodeRendererProps<FileTreeNode>) {
  const isDirectory = node.data.kind === "directory";
  return (
    <div
      ref={dragHandle}
      style={style}
      className={`file-node ${node.isSelected ? "file-node--selected" : ""}`}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        if (isDirectory) {
          node.toggle();
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
      <span className="file-node__name" title={node.data.path}>
        {node.data.name}
      </span>
      {node.data.dirty ? <span className="file-node__dirty" aria-label="Unsaved changes" /> : null}
    </div>
  );
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
  const browserUrlRef = useRef(DEFAULT_BROWSER_PREVIEW_URL);
  const launchProfileRef = useRef<LaunchProfile>(defaultLaunchProfile());
  const terminalPaneIdRef = useRef<number | null>(null);
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
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const pendingEditorFocusRef = useRef(false);
  const editorLoadSeq = useRef(0);
  const latest = useRef<Snapshot | null>(null);
  const frame = useRef<number | null>(null);
  const metrics = useRef({ cw: 9, ch: 19 });
  const selection = useRef<SelectionRange | null>(null);
  const selecting = useRef(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [launchProfile, setLaunchProfile] = useState<LaunchProfile>(defaultLaunchProfile);
  const [launchProfileChanging, setLaunchProfileChanging] = useState(false);
  const [terminalPaneState, setTerminalPaneState] = useState<TerminalPaneState>("idle");
  const [terminalExitCode, setTerminalExitCode] = useState<number | null>(null);
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
  const [browserPreviewByProject, setBrowserPreviewByProject] = useState<BrowserPreviewRecords>({});
  const [browserPreviewBySession, setBrowserPreviewBySession] = useState<BrowserPreviewRecords>({});
  const [browserUrl, setBrowserUrl] = useState(DEFAULT_BROWSER_PREVIEW_URL);
  const [browserAddress, setBrowserAddress] = useState(DEFAULT_BROWSER_PREVIEW_URL);
  const [browserHistory, setBrowserHistory] = useState([DEFAULT_BROWSER_PREVIEW_URL]);
  const [browserHistoryIndex, setBrowserHistoryIndex] = useState(0);
  const [browserReloadNonce, setBrowserReloadNonce] = useState(0);
  const [browserError, setBrowserError] = useState<string | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null);
  const [draftDialogError, setDraftDialogError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [composerDraft, setComposerDraft] = useState("");
  const [composerSending, setComposerSending] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [composerHistory, setComposerHistory] = useState<string[]>([]);
  const [composerHistoryIndex, setComposerHistoryIndex] = useState<number | null>(null);
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
  const terminalStatusLabel = terminalPaneStateLabel(terminalPaneState, terminalExitCode);
  const visibleFileTree = useMemo(
    () => markDirtyFile(fileTree, dirtyTabPathSet),
    [fileTree, dirtyTabPathSet],
  );
  const activeSessionId = useMemo(
    () => activeProjectSessionId(activeSessionByProject, projectSessions, workspacePath),
    [activeSessionByProject, projectSessions, workspacePath],
  );
  const browserCanGoBack = browserHistoryCanGoBack(browserHistoryIndex);
  const browserCanGoForward = browserHistoryCanGoForward(browserHistory, browserHistoryIndex);

  const refreshFileTree = () => setTreeRefreshNonce((value) => value + 1);

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
    browserPreviewByProjectRef.current = browserPreviewByProject;
  }, [browserPreviewByProject]);

  useEffect(() => {
    browserPreviewBySessionRef.current = browserPreviewBySession;
  }, [browserPreviewBySession]);

  useEffect(() => {
    browserUrlRef.current = browserUrl;
  }, [browserUrl]);

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
        items: fileNodeContextMenuItems(detail.node),
      });
    };
    const closeMenu = () => setContextMenu(null);
    const closeMenuOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("file-tree-context-menu", onContextMenu);
    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("keydown", closeMenuOnEscape);
    return () => {
      window.removeEventListener("file-tree-context-menu", onContextMenu);
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("keydown", closeMenuOnEscape);
    };
  }, [editorDirty, selectedFile, workspacePath]);

  useEffect(() => {
    if (!contextMenu) return;
    contextMenuRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, [contextMenu]);

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

  const browserPreviewSessionKey = (root: string, sessionId: string) => `${root}\n${sessionId}`;

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
    await storeRef.current?.set("browserPreviewByProject", nextByProject);
    await storeRef.current?.set("browserPreviewBySession", nextBySession);
    await storeRef.current?.save();
  };

  const restoreBrowserPreview = (root: string | null, sessionId: string | null) => {
    const sessionUrl = root && sessionId ? browserPreviewBySessionRef.current[browserPreviewSessionKey(root, sessionId)] : null;
    const projectUrl = root ? browserPreviewByProjectRef.current[root] : null;
    const nextUrl = sessionUrl ?? projectUrl ?? DEFAULT_BROWSER_PREVIEW_URL;
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
    setBrowserLocation(normalized);
    await persistBrowserPreviewUrl(workspacePathRef.current, activeProjectSessionId(activeSessionByProjectRef.current, projectSessionsRef.current, workspacePathRef.current), normalized);
    return true;
  };

  const submitBrowserAddress = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void navigateBrowserPreview(browserAddress);
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

  const updateActiveSessionStatus = async (path: string | null, status: ProjectRailStatus) => {
    const sessionId = activeProjectSessionId(activeSessionByProjectRef.current, projectSessionsRef.current, path);
    if (!path || !sessionId) return;
    const nextSessions = setProjectSessionStatus(projectSessionsRef.current, path, sessionId, status);
    await persistProjectSessions(nextSessions, activeSessionByProjectRef.current);
  };

  const activeProjectStatus = (): ProjectRailStatus => {
    if (terminalPaneState === "running" || terminalPaneState === "starting") return "running";
    if (terminalPaneState === "exited") return "exited";
    return "attention";
  };

  const sessionSnapshotKey = (root: string, sessionId: string) => `${root}\n${sessionId}`;

  const captureCurrentSessionSnapshot = () => {
    const root = workspacePathRef.current;
    const sessionId = activeProjectSessionId(activeSessionByProjectRef.current, projectSessionsRef.current, root);
    if (!root || !sessionId) return;
    captureCurrentEditorViewState();
    captureCurrentEditorBuffer();
    sessionEditorSnapshotsRef.current[sessionSnapshotKey(root, sessionId)] = {
      tabs: editorTabs,
      activePath: selectedFileRef.current?.path ?? null,
      buffers: { ...editorBuffersRef.current },
      viewStates: { ...editorViewStatesRef.current },
    };
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

  const openWorkspaceDirect = async (path: string, profileOverride: LaunchProfile = launchProfileRef.current) => {
    const previousRoot = workspacePathRef.current;
    captureCurrentSessionSnapshot();
    const store = storeRef.current;
    const profile = profileOverride;
    const previousPaneState = terminalPaneState;
    const previousExitCode = terminalExitCode;
    const hadPreviousPane = terminalPaneIdRef.current != null;
    setTerminalPaneState("starting");
    setTerminalExitCode(null);
    try {
      const result = await invoke<OpenWorkspaceResponse>("open_workspace", { path, profile });
      const root = result.root;
      terminalPaneIdRef.current = result.paneId;
      setLaunchError(null);
      setTerminalPaneState("running");
      restoredActiveFileWorkspaceRef.current = null;
      workspacePathRef.current = root;
      setWorkspacePath(root);
      resetEditor();
      setTimeout(sendTerminalResize, 0);
      const now = Date.now();
      const nextRecent = pushRecentProject(recentProjectsRef.current, root);
      const nextOpen = upsertOpenProject(
        previousRoot && previousRoot !== root ? setOpenProjectStatus(openProjectsRef.current, previousRoot, "exited") : openProjectsRef.current,
        root,
        "running",
      );
      let nextSessions = projectSessionsRef.current;
      let nextActiveSessions = activeSessionByProjectRef.current;
      if (previousRoot && previousRoot !== root) {
        const previousSessionId = activeProjectSessionId(nextActiveSessions, nextSessions, previousRoot);
        if (previousSessionId) nextSessions = setProjectSessionStatus(nextSessions, previousRoot, previousSessionId, "exited", now);
      }
      nextSessions = ensureProjectSessions(nextSessions, root, now);
      const sessionId = activeProjectSessionId(nextActiveSessions, nextSessions, root);
      if (sessionId) {
        nextActiveSessions = setActiveProjectSession(nextActiveSessions, root, sessionId);
        nextSessions = setProjectSessionStatus(nextSessions, root, sessionId, "running", now);
      }
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
      setTerminalPaneState(hadPreviousPane ? previousPaneState : "error");
      setTerminalExitCode(hadPreviousPane ? previousExitCode : null);
      if (isMissingWorkspaceError(message)) {
        const nextRecent = removeRecentProject(recentProjectsRef.current, path);
        const nextOpen = removeOpenProject(openProjectsRef.current, path);
        const { [path]: _removedSessions, ...nextSessions } = projectSessionsRef.current;
        const { [path]: _removedActiveSession, ...nextActiveSessions } = activeSessionByProjectRef.current;
        const { [path]: _removedBrowserProject, ...nextBrowserProjects } = browserPreviewByProjectRef.current;
        const nextBrowserSessions = Object.fromEntries(
          Object.entries(browserPreviewBySessionRef.current).filter(([key]) => !key.startsWith(`${path}\n`)),
        );
        recentProjectsRef.current = nextRecent;
        openProjectsRef.current = nextOpen;
        projectSessionsRef.current = nextSessions;
        activeSessionByProjectRef.current = nextActiveSessions;
        browserPreviewByProjectRef.current = nextBrowserProjects;
        browserPreviewBySessionRef.current = nextBrowserSessions;
        setRecentProjects(nextRecent);
        setOpenProjects(nextOpen);
        setProjectSessions(nextSessions);
        setActiveSessionByProjectState(nextActiveSessions);
        setBrowserPreviewByProject(nextBrowserProjects);
        setBrowserPreviewBySession(nextBrowserSessions);
        await store?.set("recentFolders", nextRecent);
        await store?.set("openProjects", nextOpen);
        await store?.set("projectSessions", nextSessions);
        await store?.set("activeSessionByProject", nextActiveSessions);
        await store?.set("browserPreviewByProject", nextBrowserProjects);
        await store?.set("browserPreviewBySession", nextBrowserSessions);
        if (workspacePathRef.current === path) {
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

  const switchProjectSession = async (projectPath: string, sessionId: string) => {
    const currentRoot = workspacePathRef.current;
    const sameProject = currentRoot === projectPath;
    const now = Date.now();
    captureCurrentSessionSnapshot();
    let nextSessions = projectSessionsRef.current;
    let nextActiveSessions = setActiveProjectSession(activeSessionByProjectRef.current, projectPath, sessionId);
    const previousSessionId = activeProjectSessionId(activeSessionByProjectRef.current, projectSessionsRef.current, projectPath);
    if (sameProject && previousSessionId && previousSessionId !== sessionId) {
      nextSessions = setProjectSessionStatus(nextSessions, projectPath, previousSessionId, activeProjectStatus(), now);
    }
    nextSessions = setProjectSessionStatus(nextSessions, projectPath, sessionId, sameProject ? activeProjectStatus() : "exited", now);
    await persistProjectSessions(nextSessions, nextActiveSessions);
    if (sameProject) {
      restoreSessionEditorSnapshot(projectPath, sessionId);
      restoreBrowserPreview(projectPath, sessionId);
    } else {
      await requestOpenWorkspace(projectPath);
    }
  };

  const createProjectSession = async (projectPath: string) => {
    const sameProject = workspacePathRef.current === projectPath;
    const now = Date.now();
    captureCurrentSessionSnapshot();
    const existing = projectSessionsRef.current[projectPath] ?? [];
    const session = {
      ...newProjectSession(existing, now),
      status: sameProject ? activeProjectStatus() : "exited" as ProjectRailStatus,
    };
    const nextSessions = upsertProjectSession(projectSessionsRef.current, projectPath, session);
    const nextActiveSessions = setActiveProjectSession(activeSessionByProjectRef.current, projectPath, session.id);
    await persistProjectSessions(nextSessions, nextActiveSessions);
    await persistBrowserPreviewUrl(projectPath, session.id, sameProject ? browserUrlRef.current : browserPreviewByProjectRef.current[projectPath] ?? DEFAULT_BROWSER_PREVIEW_URL);
    if (sameProject) {
      restoreSessionEditorSnapshot(projectPath, session.id);
      restoreBrowserPreview(projectPath, session.id);
    } else {
      await requestOpenWorkspace(projectPath);
    }
  };

  const renameProjectSession = async (projectPath: string, session: ProjectSession) => {
    const title = window.prompt("Session name", session.title)?.trim();
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
    const ok = window.confirm(`Delete session "${session.title}"? Editor context saved only in this app session will be removed.`);
    if (!ok) return;
    const nextSessions = removeProjectSession(projectSessionsRef.current, projectPath, session.id);
    const fallbackSessionId = activeProjectSessionId(activeSessionByProjectRef.current, nextSessions, projectPath);
    const nextActiveSessions = fallbackSessionId
      ? setActiveProjectSession(activeSessionByProjectRef.current, projectPath, fallbackSessionId)
      : activeSessionByProjectRef.current;
    delete sessionEditorSnapshotsRef.current[sessionSnapshotKey(projectPath, session.id)];
    const nextBrowserSessions = { ...browserPreviewBySessionRef.current };
    delete nextBrowserSessions[browserPreviewSessionKey(projectPath, session.id)];
    browserPreviewBySessionRef.current = nextBrowserSessions;
    setBrowserPreviewBySession(nextBrowserSessions);
    await storeRef.current?.set("browserPreviewBySession", nextBrowserSessions);
    await persistProjectSessions(nextSessions, nextActiveSessions);
    if (workspacePathRef.current === projectPath && activeSessionId === session.id) {
      restoreSessionEditorSnapshot(projectPath, fallbackSessionId);
      restoreBrowserPreview(projectPath, fallbackSessionId);
    }
  };

  const pickWorkspace = async () => {
    const dir = await open({ directory: true });
    if (typeof dir !== "string") return;
    await requestOpenWorkspace(dir);
  };

  const interruptActivePane = async () => {
    setComposerError(null);
    await invoke("send_key", { code: "KeyC", text: null, shift: false, alt: false, ctrl: true, sup: false });
  };

  const sendEnterToActivePane = async () => {
    await invoke("send_key", { code: "Enter", text: null, shift: false, alt: false, ctrl: false, sup: false });
  };

  const runComposerAppCommand = async (command: ComposerAppCommand): Promise<boolean> => {
    if (command === "save") {
      if (!selectedFile) {
        setComposerError("No editor file is selected.");
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
      openEditorSearch();
      return true;
    }
    if (command === "open-folder") {
      await pickWorkspace();
      return true;
    }
    if (command === "clear-terminal") {
      await invoke("send_key", { code: "KeyL", text: null, shift: false, alt: false, ctrl: true, sup: false });
      return true;
    }
    return false;
  };

  const submitComposerDraft = async () => {
    if (composerSending) return;
    const route = routeComposerDraft(composerDraft);
    if (route.kind === "empty") return;
    setComposerSending(true);
    setComposerError(null);
    try {
      if (route.kind === "pty") {
        if (!workspacePathRef.current) {
          setComposerError("Open a workspace before sending to an agent.");
          return;
        }
        await invoke("paste", { text: route.text });
        await sendEnterToActivePane();
      } else {
        const ok = await runComposerAppCommand(route.command);
        if (!ok) return;
      }
      setComposerHistory((history) => composerHistoryAfterSubmit(history, composerDraft));
      setComposerHistoryIndex(null);
      setComposerDraft("");
    } catch (err) {
      setComposerError(String(err));
    } finally {
      setComposerSending(false);
    }
  };

  const showPreviousComposerHistory = () => {
    const nextIndex = previousComposerHistoryIndex(composerHistory, composerHistoryIndex);
    if (nextIndex == null) return;
    setComposerHistoryIndex(nextIndex);
    setComposerDraft(composerHistoryAt(composerHistory, nextIndex));
  };

  const showNextComposerHistory = () => {
    const nextIndex = nextComposerHistoryIndex(composerHistory, composerHistoryIndex);
    setComposerHistoryIndex(nextIndex);
    setComposerDraft(nextIndex == null ? "" : composerHistoryAt(composerHistory, nextIndex));
  };

  const switchLaunchProfile = async (profile: LaunchProfile) => {
    if (profile.id === launchProfile.id || launchProfileChanging) return;
    const root = workspacePathRef.current ?? workspacePath;
    const store = storeRef.current;
    if (!root) {
      launchProfileRef.current = profile;
      setLaunchProfile(profile);
      await store?.set("launchProfile", profile);
      await store?.save();
      return;
    }
    setLaunchProfileChanging(true);
    const previousPaneState = terminalPaneState;
    const previousExitCode = terminalExitCode;
    const hadPreviousPane = terminalPaneIdRef.current != null;
    setTerminalPaneState("starting");
    setTerminalExitCode(null);
    try {
      const result = await invoke<OpenWorkspaceResponse>("open_workspace", { path: root, profile });
      terminalPaneIdRef.current = result.paneId;
      setLaunchError(null);
      setTerminalPaneState("running");
      launchProfileRef.current = profile;
      setLaunchProfile(profile);
      await store?.set("launchProfile", profile);
      await store?.save();
      setTimeout(sendTerminalResize, 0);
      await updateOpenProjectStatus(root, "running");
      await updateActiveSessionStatus(root, "running");
    } catch (err) {
      setLaunchError(String(err));
      setTerminalPaneState(hadPreviousPane ? previousPaneState : "error");
      setTerminalExitCode(hadPreviousPane ? previousExitCode : null);
      await updateOpenProjectStatus(root, "attention");
      await updateActiveSessionStatus(root, "attention");
    } finally {
      setLaunchProfileChanging(false);
    }
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
    if (project.path !== workspacePath) return project.status;
    return activeProjectStatus();
  };

  const projectRailStatusLabel = (status: ProjectRailStatus) => {
    if (status === "running") return "Running";
    if (status === "attention") return "Needs attention";
    return "Exited";
  };

  const projectRailStatusIcon = (status: ProjectRailStatus): AppIconName => {
    if (status === "running") return "loading";
    if (status === "attention") return "error";
    return "idle";
  };

  const projectSessionsFor = (projectPath: string) => projectSessions[projectPath] ?? [];

  const projectSessionStatus = (projectPath: string, session: ProjectSession): ProjectRailStatus =>
    projectPath === workspacePath && session.id === activeSessionId ? activeProjectStatus() : session.status;

  const visibleOpenProjects = openProjects.length > 0
    ? openProjects
    : workspacePath
      ? [{ path: workspacePath, status: activeProjectStatus() }]
      : [];

  const openEditorFileDirect = async (file: FileTreeNode, options: OpenEditorFileOptions = {}) => {
    const root = workspacePathRef.current ?? workspacePath;
    if (!root) return;
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
      if (options.focusEditor) requestAnimationFrame(() => editorViewRef.current?.focus());
      return true;
    }
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

  const pasteIntoTerminal = async () => {
    const text = await readText();
    if (!text) return;
    selection.current = null;
    await invoke("paste", { text });
  };

  const clearActiveTerminal = async () => {
    selection.current = null;
    await invoke("send_key", { code: "KeyL", text: null, shift: false, alt: false, ctrl: true, sup: false });
  };

  const openContextMenu = (event: ReactMouseEvent, items: ContextMenuItem[]) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, items });
  };

  const runContextMenuItem = (item: ContextMenuItem) => {
    setContextMenu(null);
    if (!item.disabled) item.onSelect();
  };

  const moveContextMenuFocus = (event: ReactKeyboardEvent<HTMLDivElement>, direction: 1 | -1) => {
    const buttons = Array.from(contextMenuRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
    if (buttons.length === 0) return;
    event.preventDefault();
    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const fallbackIndex = direction === 1 ? 0 : buttons.length - 1;
    const nextIndex = currentIndex === -1 ? fallbackIndex : (currentIndex + direction + buttons.length) % buttons.length;
    buttons[nextIndex]?.focus();
  };

  const handleContextMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setContextMenu(null);
    } else if (event.key === "ArrowDown") {
      moveContextMenuFocus(event, 1);
    } else if (event.key === "ArrowUp") {
      moveContextMenuFocus(event, -1);
    }
  };

  const fileNodeContextMenuItems = (node: FileTreeNode): ContextMenuItem[] => [
    menuItem("file.new", "New File", () => void createFileInRail(node), { icon: "filePlus" }),
    menuItem("folder.new", "New Folder", () => void createFolderInRail(node), { icon: "folderPlus" }),
    menuItem("file.rename", "Rename", () => void renameRailNode(node), { icon: "file" }),
    menuItem("file.duplicate", "Duplicate", () => void duplicateRailNode(node), { icon: "file" }),
    menuItem("file.reveal", "Reveal in Finder", () => void revealRailNode(node), { icon: "folderOpen" }),
    menuItem("file.copy-path", "Copy Path", () => void copyPathToClipboard(node.path), { icon: "file" }),
    menuItem("file.delete", "Delete", () => void deleteRailNode(node), { icon: "error", danger: true }),
  ];

  const workspaceContextMenuItems = (): ContextMenuItem[] => [
    menuItem("workspace.open", "Open Folder", () => void pickWorkspace(), { icon: "folderOpen", shortcut: shortcutKeys("workspace.open") }),
    menuItem("workspace.new-file", "New File", () => void createFileInRail(), { icon: "filePlus", disabled: !workspacePath }),
    menuItem("workspace.new-folder", "New Folder", () => void createFolderInRail(), { icon: "folderPlus", disabled: !workspacePath }),
    menuItem("workspace.reveal", "Reveal in Finder", () => workspacePath && void revealItemInDir(workspacePath), {
      icon: "folderOpen",
      disabled: !workspacePath,
    }),
    menuItem("workspace.copy-path", "Copy Workspace Path", () => workspacePath && void copyPathToClipboard(workspacePath), {
      icon: "workspace",
      disabled: !workspacePath,
    }),
  ];

  const projectRailContextMenuItems = (project: OpenProject): ContextMenuItem[] => [
    menuItem("project.switch", "Switch to Project", () => void requestOpenWorkspace(project.path), {
      icon: "workspace",
      disabled: project.path === workspacePath,
    }),
    menuItem("project.reveal", "Reveal in Finder", () => void revealItemInDir(project.path), { icon: "folderOpen" }),
    menuItem("project.copy-path", "Copy Path", () => void copyPathToClipboard(project.path), { icon: "file" }),
    menuItem(
      "project.close",
      "Close Project",
      () => {
        const nextOpen = removeOpenProject(openProjectsRef.current, project.path);
        void persistOpenProjects(nextOpen);
      },
      { icon: "close", danger: true, disabled: project.path === workspacePath },
    ),
  ];

  const projectSessionContextMenuItems = (projectPath: string, session: ProjectSession): ContextMenuItem[] => [
    menuItem("session.switch", "Switch to Session", () => void switchProjectSession(projectPath, session.id), {
      icon: "file",
      disabled: projectPath === workspacePath && session.id === activeSessionId,
    }),
    menuItem("session.rename", "Rename Session", () => void renameProjectSession(projectPath, session), { icon: "file" }),
    menuItem("session.copy-name", "Copy Session Name", () => void writeText(session.title), { icon: "file" }),
    menuItem("session.delete", "Delete Session", () => void deleteProjectSession(projectPath, session), {
      icon: "error",
      danger: true,
      disabled: (projectSessionsRef.current[projectPath] ?? []).length <= 1,
    }),
  ];

  const editorTabContextMenuItems = (tab: FileTreeNode): ContextMenuItem[] => [
    menuItem("tab.open", "Open", () => void requestOpenEditorFile(tab, { focusEditor: true }), { icon: "file" }),
    menuItem("tab.close", "Close Tab", () => void closeEditorTab(tab), { icon: "close", shortcut: shortcutKeys("editor.close-tab") }),
    menuItem("tab.reveal", "Reveal in Finder", () => void revealRailNode(tab), { icon: "folderOpen" }),
    menuItem("tab.copy-path", "Copy Path", () => void copyPathToClipboard(tab.path), { icon: "file" }),
  ];

  const editorContextMenuItems = (): ContextMenuItem[] => [
    menuItem("editor.save", "Save", () => void saveEditorFile(), {
      icon: "save",
      shortcut: shortcutKeys("editor.save"),
      disabled: !editorDirty || editorSaving || editorLoading,
    }),
    menuItem("editor.find", "Find and Replace", openEditorSearch, {
      icon: "search",
      shortcut: shortcutKeys("editor.find"),
      disabled: !selectedFile || editorLoading,
    }),
    menuItem("editor.open-external", "Open Externally", () => void openSelectedFileExternally(), { icon: "file", disabled: !selectedFile }),
    menuItem("editor.reveal", "Reveal in Finder", () => void revealSelectedFile(), { icon: "folderOpen", disabled: !selectedFile }),
    menuItem("editor.copy-path", "Copy File Path", () => selectedFile && void copyPathToClipboard(selectedFile.path), { icon: "file", disabled: !selectedFile }),
  ];

  const terminalContextMenuItems = (): ContextMenuItem[] => [
    menuItem("terminal.copy", "Copy Selection", () => void copyTerminalSelection(), {
      icon: "terminal",
      shortcut: shortcutKeys("terminal.copy-selection"),
      disabled: !terminalSelectedText(),
    }),
    menuItem("terminal.paste", "Paste", () => void pasteIntoTerminal(), { icon: "terminal", shortcut: shortcutKeys("terminal.paste") }),
    menuItem("terminal.clear", "Clear Terminal", () => void clearActiveTerminal(), { icon: "terminal", shortcut: shortcutKeys("terminal.clear") }),
    menuItem("terminal.interrupt", "Interrupt Process", () => void interruptActivePane(), { icon: "stop", danger: true }),
    menuItem("terminal.copy-cwd", "Copy Working Directory", () => workspacePath && void copyPathToClipboard(workspacePath), {
      icon: "workspace",
      disabled: !workspacePath,
    }),
  ];

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
    menuItem("browser.open-external", "Open Externally", () => void openPath(browserUrl), { icon: "openExternal" }),
    menuItem("browser.copy-url", "Copy URL", () => void writeText(browserUrl), { icon: "browser" }),
  ];

  const composerContextMenuItems = (): ContextMenuItem[] => [
    menuItem("composer.send", "Send Draft", () => void submitComposerDraft(), {
      icon: "send",
      shortcut: shortcutKeys("composer.send"),
      disabled: composerSending || !composerDraft.trim(),
    }),
    menuItem("composer.clear", "Clear Draft", () => setComposerDraft(""), { icon: "close", disabled: !composerDraft }),
    menuItem("composer.stop", "Stop Selected Pane", () => void interruptActivePane(), { icon: "stop", danger: true }),
    menuItem("composer.copy-cwd", "Copy Target Workspace", () => workspacePath && void copyPathToClipboard(workspacePath), {
      icon: "workspace",
      disabled: !workspacePath,
    }),
  ];

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
    } else {
      await openWorkspaceDirect(navigation.path);
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
  }, []);

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
      if (!snap) return;
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
    };

    const requestPaint = () => {
      if (frame.current == null) frame.current = requestAnimationFrame(paint);
    };

    // Measure the monospace advance once the font is loaded, then report size.
    const setup = async () => {
      await (document as any).fonts?.ready;
      ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
      const cw = Math.max(1, Math.round(ctx.measureText("M").width));
      const ch = Math.round(FONT_SIZE * LINE_HEIGHT);
      metrics.current = { cw, ch };
      await initWorkspace();
    };

    const scrollViewport = (delta: number) => {
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
      const savedRecent = normalizeRecentProjects(await store.get<unknown>("recentFolders"));
      const savedOpenProjects = normalizeOpenProjects(await store.get<unknown>("openProjects"));
      const savedProjectSessions = normalizeProjectSessionsByProject(await store.get<unknown>("projectSessions"));
      const savedActiveSessions = normalizeActiveSessionByProject(await store.get<unknown>("activeSessionByProject"));
      const savedBrowserProjects = normalizeBrowserPreviewRecords(await store.get<unknown>("browserPreviewByProject"));
      const savedBrowserSessions = normalizeBrowserPreviewRecords(await store.get<unknown>("browserPreviewBySession"));
      const savedProfile = normalizeLaunchProfile(await store.get<unknown>("launchProfile"));
      activeFilesByWorkspaceRef.current = normalizeActiveFileByWorkspace(await store.get<unknown>("activeFileByWorkspace"));
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
      launchProfileRef.current = savedProfile;
      setLaunchProfile(savedProfile);
      setRecentProjects(savedRecent);
      setOpenProjects(initialOpenProjects);
      setProjectSessions(initialProjectSessions);
      setActiveSessionByProjectState(savedActiveSessions);
      setBrowserPreviewByProject(savedBrowserProjects);
      setBrowserPreviewBySession(savedBrowserSessions);
      const last = await store.get<string>("folder");
      if (last) await openWorkspaceDirect(last, savedProfile);
      else await pickWorkspace();
      sendTerminalResize();
    };

    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target?.closest(".file-rail, .editor-area, .browser-preview, .terminal-titlebar, .agent-composer")) return;
      if (e.isComposing) return;
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

    const unlisten = listen<Snapshot>("grid", (ev) => {
      latest.current = ev.payload;
      requestPaint();
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
      if (ev.payload.paneId !== terminalPaneIdRef.current) return;
      setTerminalPaneState("exited");
      setTerminalExitCode(ev.payload.code);
      setLaunchError(ev.payload.message);
      void updateOpenProjectStatus(workspacePathRef.current, "exited");
      void updateActiveSessionStatus(workspacePathRef.current, "exited");
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

  return (
    <div className="app-shell">
      <aside className="file-rail" aria-label="Project files">
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
        {visibleOpenProjects.length > 0 ? (
          <nav className="project-rail" aria-label="Open projects">
            <div className="project-rail__heading">Projects</div>
            {visibleOpenProjects.map((project) => {
              const status = projectRailStatus(project);
              const active = project.path === workspacePath;
              const sessions = projectSessionsFor(project.path);
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
                      <span className="project-row__path">{project.path}</span>
                    </span>
                    <span className="project-row__state">
                      <AppIcon name={projectRailStatusIcon(status)} />
                      <span>{active ? "Active" : projectRailStatusLabel(status)}</span>
                    </span>
                  </button>
                  <div className="session-list" aria-label={`${basename(project.path)} sessions`}>
                    <button
                      className="session-row session-row--new"
                      type="button"
                      aria-label={`New session in ${basename(project.path)}`}
                      onPointerDown={(event) => {
                        if (event.button !== 0) return;
                        event.preventDefault();
                        void createProjectSession(project.path);
                      }}
                    >
                      <span className="session-row__copy">
                        <AppIcon name="filePlus" />
                        <span>New session</span>
                      </span>
                    </button>
                    {visibleSessions.map((session) => {
                      const sessionStatus = projectSessionStatus(project.path, session);
                      const sessionActive = active && session.id === activeSessionId;
                      return (
                        <button
                          className={`session-row ${sessionActive ? "session-row--active" : ""} session-row--${sessionStatus}`}
                          type="button"
                          key={session.id}
                          aria-current={sessionActive ? "page" : undefined}
                          aria-label={`${sessionActive ? "Active session" : "Switch to session"} ${session.title}, ${projectRailStatusLabel(sessionStatus)}`}
                          title={`${session.title} · ${projectRailStatusLabel(sessionStatus)}`}
                          onPointerDown={(event) => {
                            if (event.button !== 0) return;
                            event.preventDefault();
                            if (!sessionActive) void switchProjectSession(project.path, session.id);
                          }}
                          onContextMenu={(event) => openContextMenu(event, projectSessionContextMenuItems(project.path, session))}
                        >
                          <span className="session-row__copy">
                            <AppIcon name="file" />
                            <span>{session.title}</span>
                          </span>
                          <span className="session-row__state">
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
                        aria-label={sessionsExpanded ? `Show fewer sessions in ${basename(project.path)}` : `Show ${hiddenSessionCount} more sessions in ${basename(project.path)}`}
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
                  </div>
                </div>
              );
            })}
          </nav>
        ) : null}
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
      </aside>

      <main className="workbench">
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
              ) : (
                <div className="editor-tab editor-tab--empty">
                  <span className="editor-tab__name">No file open</span>
                </div>
              )}
            </div>
            {selectedFile ? (
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
          {selectedFile ? (
            <nav className="editor-pathbar" aria-label="Active file path" title={selectedFile.path}>
              {editorBreadcrumbs.map((part, index) => (
                <span className="editor-crumb" key={`${part}-${index}`}>
                  {index > 0 ? <span className="editor-crumb__separator">/</span> : null}
                  <span className={index === editorBreadcrumbs.length - 1 ? "editor-crumb__current" : ""}>{part}</span>
                </span>
              ))}
            </nav>
          ) : null}
          {selectedFile ? (
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
            <button className="browser-button" type="button" title="Open preview externally" aria-label="Open preview externally" onClick={() => void openPath(browserUrl)}>
              <AppIcon name="openExternal" />
            </button>
          </div>
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

        <section className="terminal-panel" aria-label="Agent terminal">
          <div className="terminal-titlebar">
            <div className="terminal-profile">
              <span className="terminal-kicker">Agent</span>
              <span className="terminal-title">
                <AppIcon name="agent" />
                <span>{launchProfile.label}</span>
              </span>
              <span className="terminal-command" title={launchProfileCommandLine(launchProfile)}>
                {launchProfileCommandLine(launchProfile)}
              </span>
              <span className="terminal-mode">{launchProfileMode(launchProfile)}</span>
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
            <label className="terminal-profile-picker">
              <span className="terminal-profile-picker__label">Profile</span>
              <select
                aria-label="Agent profile"
                value={launchProfile.id}
                disabled={launchProfileChanging}
                onChange={(event) => void switchLaunchProfile(launchProfileById(event.currentTarget.value))}
              >
                {LAUNCH_PROFILES.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div
            ref={terminalHostRef}
            className="terminal-host"
            onPointerDown={() => canvasRef.current?.focus()}
            onContextMenu={(event) => openContextMenu(event, terminalContextMenuItems())}
          >
            <canvas
              ref={canvasRef}
              className="term"
              tabIndex={0}
              role="application"
              aria-label={`${launchProfile.label} terminal pane. Type to send keyboard input to the active process.`}
            />
          </div>
          <div className="agent-composer" aria-label="Agent composer" onContextMenu={(event) => openContextMenu(event, composerContextMenuItems())}>
            <div className="agent-composer__target" title={workspacePath ?? ""}>
              <span>Target</span>
              <strong>
                <AppIcon name="agent" />
                <span>{launchProfile.label}</span>
              </strong>
              <span>{workspacePath ? basename(workspacePath) : "No workspace"}</span>
              <span>single pane</span>
            </div>
            <textarea
              className="agent-composer__input"
              aria-label="Agent composer draft"
              value={composerDraft}
              rows={2}
              placeholder="Send to selected agent. Use >save, >find, >open, or >clear for app actions."
              disabled={composerSending}
              onChange={(event) => {
                setComposerDraft(event.currentTarget.value);
                setComposerHistoryIndex(null);
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
            <div className="agent-composer__actions">
              <button
                className="agent-composer__button"
                type="button"
                title={shortcutTitle("composer.send", "Send")}
                disabled={composerSending || !composerDraft.trim()}
                onClick={() => void submitComposerDraft()}
              >
                <AppIcon name={composerSending ? "loading" : "send"} />
                <span>{composerSending ? "Sending" : "Send"}</span>
              </button>
              <button className="agent-composer__button" type="button" title="Stop selected pane (Ctrl+C)" onClick={() => void interruptActivePane()}>
                <AppIcon name="stop" />
                <span>Stop</span>
              </button>
            </div>
            {composerError ? <div className="agent-composer__error">{composerError}</div> : null}
          </div>
        </section>
      </main>

      {launchError ? (
        <div className="launch-error" role="alert">
          {launchError}
        </div>
      ) : null}
      {contextMenu ? (
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          aria-label="Context menu"
          role="menu"
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={handleContextMenuKeyDown}
        >
          {contextMenu.items.map((item) => (
            <button
              className={item.danger ? "context-menu__item context-menu__item--danger" : "context-menu__item"}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              key={item.id}
              onClick={() => runContextMenuItem(item)}
            >
              <span className="context-menu__label">
                {item.icon ? <AppIcon name={item.icon} /> : null}
                <span>{item.label}</span>
              </span>
              {item.shortcut ? <span className="context-menu__shortcut">{item.shortcut}</span> : null}
            </button>
          ))}
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
    </div>
  );
}

export default App;
