import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { open } from "@tauri-apps/plugin-dialog";
import { load } from "@tauri-apps/plugin-store";
import type { EditorView, ViewUpdate } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";
import { Tree } from "react-arborist";
import type { NodeRendererProps, TreeApi } from "react-arborist";
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
import "./App.css";

// SPIKE-2 frontend: paint the grid snapshots from the Rust backend onto a canvas,
// and encode keydowns back into pty bytes. Ship-ugly on purpose.

type Cell = { t: string; f: [number, number, number]; b: [number, number, number]; bold: boolean };
type Snapshot = { cols: number; rows: number; cx: number; cy: number; cvis: boolean; sb: number; cells: Cell[] };
type LaunchProfile = { id: string; command: string; args: string[]; useLoginShell: boolean };
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
type TextFileResponse = { path: string; content: string; bytes: number };
type OpenEditorFileOptions = { focusEditor?: boolean };

const FONT_SIZE = 15;
const FONT_FAMILY = "JetBrains Mono, monospace";
const LINE_HEIGHT = 1.25;
const DEFAULT_LAUNCH_PROFILE: LaunchProfile = {
  id: "claude",
  command: "claude",
  args: [],
  useLoginShell: true,
};

const rgb = (c: [number, number, number]) => `rgb(${c[0]},${c[1]},${c[2]})`;
const basename = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? path;
const extension = (path: string) => basename(path).split(".").pop()?.toLowerCase() ?? "";
const formatBytes = (bytes: number | null) => {
  if (bytes == null) return "--";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const markDirtyFile = (nodes: FileTreeNode[], dirtyPath: string | null): FileTreeNode[] => {
  if (!dirtyPath) return nodes;
  return nodes.map((node) => ({
    ...node,
    dirty: node.path === dirtyPath,
    children: node.children ? markDirtyFile(node.children, dirtyPath) : undefined,
  }));
};

const editorExtensionsFor = (path: string) => {
  switch (extension(path)) {
    case "js":
    case "jsx":
      return [javascript({ jsx: true })];
    case "ts":
    case "tsx":
      return [javascript({ jsx: extension(path) === "tsx", typescript: true })];
    case "md":
    case "markdown":
      return [markdown()];
    default:
      return [];
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value != null;

const normalizeLaunchProfile = (value: unknown): LaunchProfile => {
  if (!isRecord(value) || typeof value.command !== "string" || !value.command.trim()) {
    return DEFAULT_LAUNCH_PROFILE;
  }
  const args = Array.isArray(value.args) ? value.args.filter((arg): arg is string => typeof arg === "string") : [];
  return {
    id: typeof value.id === "string" && value.id.trim() ? value.id : value.command,
    command: value.command,
    args,
    useLoginShell: typeof value.useLoginShell === "boolean" ? value.useLoginShell : true,
  };
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
  const activeFilesByWorkspaceRef = useRef<ActiveFileByWorkspace>({});
  const restoredActiveFileWorkspaceRef = useRef<string | null>(null);
  const selectedFileRef = useRef<FileTreeNode | null>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const editorViewStatesRef = useRef<Record<string, EditorViewState>>({});
  const pendingEditorFocusRef = useRef(false);
  const editorLoadSeq = useRef(0);
  const latest = useRef<Snapshot | null>(null);
  const frame = useRef<number | null>(null);
  const metrics = useRef({ cw: 9, ch: 19 });
  const selection = useRef<SelectionRange | null>(null);
  const selecting = useRef(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [fileTreeError, setFileTreeError] = useState<string | null>(null);
  const [fileTreeLoading, setFileTreeLoading] = useState(false);
  const [fileTreeTruncated, setFileTreeTruncated] = useState(false);
  const [treeRefreshNonce, setTreeRefreshNonce] = useState(0);
  const [railHeight, setRailHeight] = useState(240);
  const [selectedFile, setSelectedFile] = useState<FileTreeNode | null>(null);
  const [editorText, setEditorText] = useState("");
  const [savedEditorText, setSavedEditorText] = useState("");
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [editorBytes, setEditorBytes] = useState<number | null>(null);
  const [editorCursor, setEditorCursor] = useState<CursorPosition>({ line: 1, column: 1 });
  const [recentProjects, setRecentProjects] = useState<string[]>([]);
  const editorDirty = selectedFile != null && editorText !== savedEditorText;
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
    () => markDirtyFile(fileTree, editorDirty && selectedFile ? selectedFile.path : null),
    [fileTree, editorDirty, selectedFile],
  );

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
    if (!selectedFile || fileTree.length === 0) return;
    const syncedFile = reconcileActiveFileNode(fileTree, selectedFile);
    if (syncedFile !== selectedFile) setSelectedFile(syncedFile);
  }, [fileTree, selectedFile]);

  const resetEditor = () => {
    editorViewRef.current = null;
    editorLoadSeq.current += 1;
    setSelectedFile(null);
    setEditorText("");
    setSavedEditorText("");
    setEditorError(null);
    setEditorBytes(null);
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

  const openWorkspace = async (path: string) => {
    captureCurrentEditorViewState();
    const store = storeRef.current;
    const saved = await store?.get<unknown>("launchProfile");
    const profile = normalizeLaunchProfile(saved);
    if (!saved) {
      await store?.set("launchProfile", profile);
      await store?.save();
    }
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

  const pickWorkspace = async () => {
    const dir = await open({ directory: true });
    if (typeof dir !== "string") return;
    await openWorkspace(dir);
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

  const openEditorFile = async (file: FileTreeNode, options: OpenEditorFileOptions = {}) => {
    const root = workspacePathRef.current ?? workspacePath;
    if (!root) return;
    captureCurrentEditorViewState();
    pendingEditorFocusRef.current = options.focusEditor ?? false;
    const seq = editorLoadSeq.current + 1;
    editorLoadSeq.current = seq;
    setSelectedFile(file);
    setEditorLoading(true);
    setEditorSaving(false);
    setEditorError(null);
    setEditorBytes(null);
    setEditorCursor({ line: 1, column: 1 });
    try {
      const result = await invoke<TextFileResponse>("read_text_file", { root, path: file.path });
      if (editorLoadSeq.current !== seq || result.path !== file.path) return;
      setEditorText(result.content);
      setSavedEditorText(result.content);
      setEditorBytes(result.bytes);
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
      setEditorText("");
      setSavedEditorText("");
      setEditorBytes(null);
      setEditorError(String(err));
    } finally {
      if (editorLoadSeq.current === seq) setEditorLoading(false);
    }
  };

  const saveEditorFile = async () => {
    const root = workspacePathRef.current ?? workspacePath;
    if (!root || !selectedFile || editorSaving || !editorDirty) return;
    setEditorSaving(true);
    setEditorError(null);
    try {
      const result = await invoke<TextFileResponse>("write_text_file", {
        root,
        path: selectedFile.path,
        content: editorText,
      });
      setSavedEditorText(result.content);
      setEditorBytes(result.bytes);
    } catch (err) {
      setEditorError(String(err));
    } finally {
      setEditorSaving(false);
    }
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
      void openEditorFile(node);
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
      activeFilesByWorkspaceRef.current = normalizeActiveFileByWorkspace(await store.get<unknown>("activeFileByWorkspace"));
      recentProjectsRef.current = savedRecent;
      setRecentProjects(savedRecent);
      const last = await store.get<string>("folder");
      if (last) await openWorkspace(last);
      else await pickWorkspace();
      sendTerminalResize();
    };

    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target?.closest(".file-rail, .editor-area")) return;
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
                  void openWorkspace(project);
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
                  void openEditorFile(node.data, { focusEditor: true });
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
            <div
              className={`editor-tab ${editorDirty ? "editor-tab--dirty" : ""} ${selectedFile ? "editor-tab--active" : ""}`}
              title={selectedFile?.path}
            >
              <span className="editor-tab__name">{selectedFile ? selectedFile.name : "No file open"}</span>
              {editorDirty ? <span className="editor-tab__dirty" aria-label="Unsaved changes" /> : null}
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
              {editorError ? <div className="editor-error">{editorError}</div> : null}
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
            <div>
              <span className="terminal-kicker">Agent</span>
              <span className="terminal-title">Claude</span>
            </div>
          </div>
          <div ref={terminalHostRef} className="terminal-host">
            <canvas ref={canvasRef} className="term" />
          </div>
        </section>
      </main>

      {launchError ? (
        <div className="launch-error" role="alert">
          {launchError}
        </div>
      ) : null}
    </div>
  );
}

export default App;
