import type { EditorView } from "@codemirror/view";
import { useRef, useState } from "react";
import type { EditorFileBuffer } from "./editorFileLoadState";
import type { CursorPosition, EditorViewState } from "./editorState";
import type { FileTreeNode } from "./fileTreeTypes";
import { useSyncRef } from "./useSyncRef";
import type { ActiveFileByWorkspace } from "./workspaceState";

export type ProjectEditorSnapshot = {
  activePath: string | null;
  buffers: Record<string, EditorFileBuffer>;
  tabs: FileTreeNode[];
  viewStates: Record<string, EditorViewState>;
};

const useEditorSessionState = () => {
  const activeFilesByWorkspaceRef = useRef<ActiveFileByWorkspace>({});
  const restoredActiveFileWorkspaceRef = useRef<string | null>(null);
  const selectedFileRef = useRef<FileTreeNode | null>(null);
  const saveEditorFileRef = useRef<() => Promise<boolean>>(async () => false);
  const openEditorSearchRef = useRef<() => void>(() => {});
  const closeActiveEditorTabRef = useRef<() => Promise<void>>(async () => {});
  const editorViewRef = useRef<EditorView | null>(null);
  const editorViewStatesRef = useRef<Record<string, EditorViewState>>({});
  const editorBuffersRef = useRef<Record<string, EditorFileBuffer>>({});
  const sessionEditorSnapshotsRef = useRef<Record<string, ProjectEditorSnapshot>>({});
  const pendingEditorFocusRef = useRef(false);
  const editorLoadSeq = useRef(0);
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
  useSyncRef(selectedFileRef, selectedFile);
  return {
    activeFilesByWorkspaceRef, closeActiveEditorTabRef, editorBuffersRef, editorBytes,
    editorCursor, editorError, editorLoadSeq, editorLoading, editorModifiedMs,
    editorRecoveryError, editorSaving, editorTabs, editorText, editorViewRef,
    editorViewStatesRef, fileOpError, openEditorSearchRef, pendingEditorFocusRef,
    restoredActiveFileWorkspaceRef, saveEditorFileRef, savedEditorText, selectedFile,
    selectedFileRef, sessionEditorSnapshotsRef, setEditorBufferRevision, setEditorBytes,
    setEditorCursor, setEditorError, setEditorLoading, setEditorModifiedMs,
    setEditorRecoveryError, setEditorSaving, setEditorTabs, setEditorText,
    setFileOpError, setSavedEditorText, setSelectedFile,
  };
};

type EditorSessionState = ReturnType<typeof useEditorSessionState>;

const resetEditorState = (state: EditorSessionState) => {
  state.editorViewRef.current = null;
  state.editorLoadSeq.current += 1;
  state.editorBuffersRef.current = {};
  state.setEditorTabs([]);
  state.setEditorBufferRevision((value) => value + 1);
  state.setSelectedFile(null);
  state.setEditorText("");
  state.setSavedEditorText("");
  state.setEditorError(null);
  state.setEditorRecoveryError(null);
  state.setEditorBytes(null);
  state.setEditorModifiedMs(null);
  state.setEditorCursor({ line: 1, column: 1 });
};

const captureEditorViewState = (state: EditorSessionState) => {
  const file = state.selectedFileRef.current;
  const view = state.editorViewRef.current;
  if (!file || !view) return;
  const { anchor, head } = view.state.selection.main;
  state.editorViewStatesRef.current[file.path] = {
    anchor,
    head,
    scrollTop: view.scrollDOM.scrollTop,
    focused: view.hasFocus,
  };
};

const captureEditorBuffer = (state: EditorSessionState) => {
  const file = state.selectedFileRef.current;
  if (!file) return;
  state.editorBuffersRef.current[file.path] = {
    text: state.editorText,
    savedText: state.savedEditorText,
    bytes: state.editorBytes,
    modifiedMs: state.editorModifiedMs,
    error: state.editorError,
    recoveryError: state.editorRecoveryError,
  };
  state.setEditorBufferRevision((value) => value + 1);
};

export function useEditorSessionController() {
  const state = useEditorSessionState();
  return {
    ...state,
    captureCurrentEditorBuffer: () => captureEditorBuffer(state),
    captureCurrentEditorViewState: () => captureEditorViewState(state),
    resetEditor: () => resetEditorState(state),
  };
}
