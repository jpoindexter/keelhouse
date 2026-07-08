import { useEffect, useMemo, useRef, useState } from "react";
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
import { editorExtensionsFor } from "./editorLanguages";
import { isCellSelected, pointFromMouse, selectionToText } from "./selection";
import type { SelectionRange } from "./selection";
import {
  forgetActiveFile,
  isMissingWorkspaceError,
  normalizeActiveFileByWorkspace,
  normalizeRecentProjects,
  pushRecentProject,
  rememberActiveFile,
  removeRecentProject,
} from "./workspaceState";
import type { ActiveFileByWorkspace } from "./workspaceState";
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
import "./App.css";

// SPIKE-2 frontend: paint the grid snapshots from the Rust backend onto a canvas,
// and encode keydowns back into pty bytes. Ship-ugly on purpose.

type Cell = { t: string; f: [number, number, number]; b: [number, number, number]; bold: boolean };
type Snapshot = { cols: number; rows: number; cx: number; cy: number; cvis: boolean; sb: number; cells: Cell[] };
type PaneExit = { command: string; code: number; message: string };
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
type PendingNavigation =
  | { kind: "file"; file: FileTreeNode; options: OpenEditorFileOptions }
  | { kind: "workspace"; path: string };
type FileContextMenu = { node: FileTreeNode; x: number; y: number };

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
        {isDirectory ? (node.isOpen ? "▾" : "▸") : ""}
      </span>
      <span className={`file-node__icon file-node__icon--${node.data.kind}`} aria-hidden="true">
        {isDirectory ? "□" : "·"}
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
  const launchProfileRef = useRef<LaunchProfile>(defaultLaunchProfile());
  const activeFilesByWorkspaceRef = useRef<ActiveFileByWorkspace>({});
  const restoredActiveFileWorkspaceRef = useRef<string | null>(null);
  const selectedFileRef = useRef<FileTreeNode | null>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const editorViewStatesRef = useRef<Record<string, EditorViewState>>({});
  const editorBuffersRef = useRef<Record<string, EditorBuffer>>({});
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
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null);
  const [draftDialogError, setDraftDialogError] = useState<string | null>(null);
  const [fileContextMenu, setFileContextMenu] = useState<FileContextMenu | null>(null);
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
  const visibleFileTree = useMemo(
    () => markDirtyFile(fileTree, dirtyTabPathSet),
    [fileTree, dirtyTabPathSet],
  );

  const refreshFileTree = () => setTreeRefreshNonce((value) => value + 1);

  useEffect(() => {
    recentProjectsRef.current = recentProjects;
  }, [recentProjects]);

  useEffect(() => {
    selectedFileRef.current = selectedFile;
  }, [selectedFile]);

  useEffect(() => {
    if (!selectedFile) return;
    treeRef.current?.scrollTo(selectedFile.id, "smart");
  }, [selectedFile, visibleFileTree]);

  useEffect(() => {
    const onContextMenu = (event: Event) => {
      const detail = (event as CustomEvent<FileContextMenu>).detail;
      if (!detail?.node) return;
      setFileContextMenu(detail);
    };
    const closeMenu = () => setFileContextMenu(null);
    window.addEventListener("file-tree-context-menu", onContextMenu);
    window.addEventListener("pointerdown", closeMenu);
    window.addEventListener("keydown", closeMenu);
    return () => {
      window.removeEventListener("file-tree-context-menu", onContextMenu);
      window.removeEventListener("pointerdown", closeMenu);
      window.removeEventListener("keydown", closeMenu);
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

  useEffect(() => {
    launchProfileRef.current = launchProfile;
  }, [launchProfile]);

  const openWorkspaceDirect = async (path: string, profileOverride: LaunchProfile = launchProfileRef.current) => {
    captureCurrentEditorViewState();
    const store = storeRef.current;
    const profile = profileOverride;
    try {
      const root = await invoke<string>("open_workspace", { path, profile });
      setLaunchError(null);
      restoredActiveFileWorkspaceRef.current = null;
      workspacePathRef.current = root;
      setWorkspacePath(root);
      resetEditor();
      setTimeout(sendTerminalResize, 0);
      const nextRecent = pushRecentProject(recentProjectsRef.current, root);
      recentProjectsRef.current = nextRecent;
      setRecentProjects(nextRecent);
      await store?.set("launchProfile", profile);
      await store?.set("folder", root);
      await store?.set("recentFolders", nextRecent);
      await store?.save();
      return true;
    } catch (err) {
      const message = String(err);
      setLaunchError(message);
      if (isMissingWorkspaceError(message)) {
        const nextRecent = removeRecentProject(recentProjectsRef.current, path);
        recentProjectsRef.current = nextRecent;
        setRecentProjects(nextRecent);
        await store?.set("recentFolders", nextRecent);
        if (workspacePathRef.current === path) {
          setWorkspacePath(null);
          setFileTree([]);
          resetEditor();
        }
        await store?.delete("folder");
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
    try {
      await invoke<string>("open_workspace", { path: root, profile });
      setLaunchError(null);
      launchProfileRef.current = profile;
      setLaunchProfile(profile);
      await store?.set("launchProfile", profile);
      await store?.save();
      setTimeout(sendTerminalResize, 0);
    } catch (err) {
      setLaunchError(String(err));
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

  const visibleRecentProjects = recentProjects.filter((project) => project !== workspacePath).slice(0, 3);
  const hiddenRecentCount = Math.max(0, recentProjects.filter((project) => project !== workspacePath).length - visibleRecentProjects.length);

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
    // persists both the active folder and recent-projects list.
    const initWorkspace = async () => {
      const store = await load("workspace.json", { autoSave: true, defaults: {} });
      storeRef.current = store;
      const savedRecent = normalizeRecentProjects(await store.get<unknown>("recentFolders"));
      const savedProfile = normalizeLaunchProfile(await store.get<unknown>("launchProfile"));
      activeFilesByWorkspaceRef.current = normalizeActiveFileByWorkspace(await store.get<unknown>("activeFileByWorkspace"));
      recentProjectsRef.current = savedRecent;
      launchProfileRef.current = savedProfile;
      setLaunchProfile(savedProfile);
      setRecentProjects(savedRecent);
      const last = await store.get<string>("folder");
      if (last) await openWorkspaceDirect(last, savedProfile);
      else await pickWorkspace();
      sendTerminalResize();
    };

    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target?.closest(".file-rail, .editor-area, .terminal-titlebar, .agent-composer")) return;
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
    const unlistenPaneExit = listen<PaneExit>("pane-exit", (ev) => {
      setLaunchError(ev.payload.message);
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
            onClick={() => void createFileInRail()}
          >
            File
          </button>
          <button
            className="rail-open-button"
            type="button"
            disabled={!workspacePath}
            title="New folder"
            onClick={() => void createFolderInRail()}
          >
            Folder
          </button>
          <button className="rail-open-button" type="button" onClick={pickWorkspace}>
            Open
          </button>
        </div>
        <div className="rail-root" title={workspacePath ?? ""}>
          {workspacePath ? basename(workspacePath) : "No workspace"}
        </div>
        {visibleRecentProjects.length > 0 ? (
          <div className="recent-projects" aria-label="Recent projects">
            {visibleRecentProjects.map((project) => (
              <button
                className="recent-project"
                type="button"
                key={project}
                aria-label={`Switch to recent project ${basename(project)}`}
                title={project}
                onPointerDown={(event) => {
                  event.preventDefault();
                  void requestOpenWorkspace(project);
                }}
              >
                <span className="recent-project__copy">
                  <span className="recent-project__name">{basename(project)}</span>
                  <span className="recent-project__path">{project}</span>
                </span>
                <span className="recent-project__action" aria-hidden="true">
                  Switch
                </span>
              </button>
            ))}
            {hiddenRecentCount > 0 ? <div className="rail-status rail-status--muted">{hiddenRecentCount} more hidden</div> : null}
          </div>
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
        <section className="editor-area" aria-label="Editor">
          <div className="editor-tabbar">
            <div className="editor-tabs" role="tablist" aria-label="Open files">
              {editorTabs.length > 0 ? (
                editorTabs.map((tab) => {
                  const active = selectedFile?.path === tab.path;
                  const dirty = tabIsDirty(tab.path);
                  return (
                    <div
                      className={`editor-tab ${dirty ? "editor-tab--dirty" : ""} ${active ? "editor-tab--active" : ""}`}
                      role="tab"
                      aria-selected={active}
                      title={tab.path}
                      key={tab.path}
                    >
                      <button
                        className="editor-tab__activate"
                        type="button"
                        onPointerDown={(event) => {
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
                        title={`Close ${tab.name}`}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void closeEditorTab(tab);
                        }}
                      >
                        ×
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
                <button className="editor-command" type="button" disabled={editorLoading} title="Find and replace (Cmd+F)" onClick={openEditorSearch}>
                  Find
                </button>
                <button
                  className="editor-save"
                  type="button"
                  disabled={!editorDirty || editorSaving || editorLoading}
                  onClick={() => void saveEditorFile()}
                >
                  {editorSaving ? "Saving" : "Save"}
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

        <section className="terminal-panel" aria-label="Agent terminal">
          <div className="terminal-titlebar">
            <div className="terminal-profile">
              <span className="terminal-kicker">Agent</span>
              <span className="terminal-title">{launchProfile.label}</span>
              <span className="terminal-command" title={launchProfileCommandLine(launchProfile)}>
                {launchProfileCommandLine(launchProfile)}
              </span>
              <span className="terminal-mode">{launchProfileMode(launchProfile)}</span>
            </div>
            <label className="terminal-profile-picker">
              <span className="terminal-profile-picker__label">Profile</span>
              <select
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
          <div ref={terminalHostRef} className="terminal-host">
            <canvas ref={canvasRef} className="term" />
          </div>
          <div className="agent-composer" aria-label="Agent composer">
            <div className="agent-composer__target" title={workspacePath ?? ""}>
              <span>Target</span>
              <strong>{launchProfile.label}</strong>
              <span>{workspacePath ? basename(workspacePath) : "No workspace"}</span>
              <span>single pane</span>
            </div>
            <textarea
              className="agent-composer__input"
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
                disabled={composerSending || !composerDraft.trim()}
                onClick={() => void submitComposerDraft()}
              >
                {composerSending ? "Sending" : "Send"}
              </button>
              <button className="agent-composer__button" type="button" onClick={() => void interruptActivePane()}>
                Stop
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
      {fileContextMenu ? (
        <div
          className="file-context-menu"
          style={{ left: fileContextMenu.x, top: fileContextMenu.y }}
          role="menu"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const node = fileContextMenu.node;
              setFileContextMenu(null);
              void createFileInRail(node);
            }}
          >
            New File
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const node = fileContextMenu.node;
              setFileContextMenu(null);
              void createFolderInRail(node);
            }}
          >
            New Folder
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const node = fileContextMenu.node;
              setFileContextMenu(null);
              void renameRailNode(node);
            }}
          >
            Rename
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const node = fileContextMenu.node;
              setFileContextMenu(null);
              void duplicateRailNode(node);
            }}
          >
            Duplicate
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const node = fileContextMenu.node;
              setFileContextMenu(null);
              void revealRailNode(node);
            }}
          >
            Reveal in Finder
          </button>
          <button
            className="file-context-menu__danger"
            type="button"
            role="menuitem"
            onClick={() => {
              const node = fileContextMenu.node;
              setFileContextMenu(null);
              void deleteRailNode(node);
            }}
          >
            Delete
          </button>
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
