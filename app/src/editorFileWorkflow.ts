import { invoke } from "@tauri-apps/api/core";

import { createAppAction, type AppActionAuditEvent, type AppActionDescriptor } from "./appActions";
import {
  editorLoadErrorState,
  editorLoadStateFromBuffer,
  editorLoadStateFromResponse,
  type EditorFileBuffer,
  type EditorFileLoadState,
  type TextFileReadResult,
} from "./editorFileLoadState";
import type { EditorViewState } from "./editorState";
import type { FileTreeNode } from "./fileTreeTypes";

type Ref<T> = { current: T };
export type EditorFileOpenOptions = { focusEditor?: boolean };
export type EditorFileWorkflowServices = {
  readFile: (root: string, path: string) => Promise<TextFileReadResult>;
  requestFrame: (callback: () => void) => void;
  writeFile: (
    root: string, path: string, content: string, expectedModifiedMs: number | null,
  ) => Promise<TextFileReadResult>;
};
type EditorSaveState = {
  bytes: number | null;
  dirty: boolean;
  file: FileTreeNode | null;
  modifiedMs: number | null;
  recoveryError: string | null;
  root: string | null;
  savedText: string;
  saving: boolean;
  text: string;
};

type EditorFileWorkflowOptions = {
  applyState: (state: EditorFileLoadState) => void;
  beginOpen: (file: FileTreeNode, focusEditor: boolean) => void;
  buffers: Ref<Record<string, EditorFileBuffer>>;
  bumpBufferRevision: () => void;
  focusEditor: () => void;
  gateAction: (action: AppActionDescriptor) => Promise<AppActionAuditEvent>;
  getActiveFilePath: () => string | null;
  getRoot: () => string | null;
  getSaveState: () => EditorSaveState;
  loadSequence: Ref<number>;
  onCurrentFile: (focusEditor: boolean) => void;
  onSaveError: (message: string) => void;
  onSaveSuccess: (result: TextFileReadResult) => void;
  persistActiveFile: (root: string, path: string) => Promise<void>;
  prepareSave: () => void;
  prepareRead: () => void;
  recordEdit: (file: FileTreeNode) => void;
  services?: EditorFileWorkflowServices;
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  viewStates: Ref<Record<string, EditorViewState>>;
};

type WorkflowContext = EditorFileWorkflowOptions & { services: EditorFileWorkflowServices };

const nativeServices: EditorFileWorkflowServices = {
  readFile: (root, path) => invoke<TextFileReadResult>("read_text_file", { root, path }),
  requestFrame: (callback) => requestAnimationFrame(callback),
  writeFile: (root, path, content, expectedModifiedMs) => invoke<TextFileReadResult>("write_text_file", {
    root, path, content, expectedModifiedMs,
  }),
};

const focusWhenRequested = (context: WorkflowContext, focusEditor: boolean) => {
  if (focusEditor) context.services.requestFrame(context.focusEditor);
};

const applyBufferedFile = async (
  context: WorkflowContext, root: string, file: FileTreeNode, buffer: EditorFileBuffer, focusEditor: boolean,
) => {
  context.setLoading(false);
  context.applyState(editorLoadStateFromBuffer(buffer, context.viewStates.current[file.path]));
  await context.persistActiveFile(root, file.path);
  focusWhenRequested(context, focusEditor);
};

const readFile = async (
  context: WorkflowContext, root: string, file: FileTreeNode, sequence: number, focusEditor: boolean,
) => {
  context.setLoading(true);
  context.prepareRead();
  try {
    const result = await context.services.readFile(root, file.path);
    if (context.loadSequence.current !== sequence || result.path !== file.path) return;
    const loaded = editorLoadStateFromResponse(result, context.viewStates.current[file.path]);
    context.buffers.current[file.path] = loaded.buffer;
    context.bumpBufferRevision();
    context.applyState(loaded);
    await context.persistActiveFile(root, file.path);
    focusWhenRequested(context, focusEditor);
  } catch (error) {
    if (context.loadSequence.current !== sequence) return;
    const failed = editorLoadErrorState(error);
    context.buffers.current[file.path] = failed.buffer;
    context.bumpBufferRevision();
    context.applyState(failed);
  } finally {
    if (context.loadSequence.current === sequence) context.setLoading(false);
  }
};

const openDirect = async (context: WorkflowContext, file: FileTreeNode, options: EditorFileOpenOptions) => {
  const root = context.getRoot();
  if (!root) return;
  const focusEditor = options.focusEditor ?? false;
  context.beginOpen(file, focusEditor);
  const sequence = context.loadSequence.current + 1;
  context.loadSequence.current = sequence;
  const buffer = context.buffers.current[file.path];
  if (buffer) await applyBufferedFile(context, root, file, buffer, focusEditor);
  else await readFile(context, root, file, sequence, focusEditor);
};

const requestOpen = async (
  context: WorkflowContext,
  file: FileTreeNode,
  options: EditorFileOpenOptions,
  requestedBy: "user" | "agent",
) => {
  if (context.getActiveFilePath() === file.path) {
    context.onCurrentFile(options.focusEditor ?? false);
    return true;
  }
  const audit = await context.gateAction(createAppAction({
    kind: "open-file", label: "Open file", target: file.path, risk: "low", requestedBy,
  }));
  if (audit.decision !== "approved") return false;
  await openDirect(context, file, options);
  return true;
};

const save = async (context: WorkflowContext, force = false) => {
  const state = context.getSaveState();
  if (!state.root || !state.file || state.saving) return false;
  if (!state.dirty) return true;
  context.setSaving(true);
  context.prepareSave();
  try {
    const result = await context.services.writeFile(
      state.root, state.file.path, state.text, force ? null : state.modifiedMs,
    );
    context.buffers.current[state.file.path] = {
      text: result.content, savedText: result.content, bytes: result.bytes,
      modifiedMs: result.modifiedMs, error: null, recoveryError: null,
    };
    context.bumpBufferRevision();
    context.onSaveSuccess(result);
    context.recordEdit(state.file);
    return true;
  } catch (error) {
    const message = String(error);
    context.buffers.current[state.file.path] = {
      text: state.text, savedText: state.savedText, bytes: state.bytes,
      modifiedMs: state.modifiedMs, error: message, recoveryError: state.recoveryError,
    };
    context.bumpBufferRevision();
    context.onSaveError(message);
    return false;
  } finally {
    context.setSaving(false);
  }
};

export const createEditorFileWorkflow = (options: EditorFileWorkflowOptions) => {
  const context = { ...options, services: options.services ?? nativeServices };
  return {
    openDirect: (file: FileTreeNode, openOptions: EditorFileOpenOptions = {}) =>
      openDirect(context, file, openOptions),
    requestOpen: (
      file: FileTreeNode, openOptions: EditorFileOpenOptions = {}, requestedBy: "user" | "agent" = "user",
    ) => requestOpen(context, file, openOptions, requestedBy),
    save: (force = false) => save(context, force),
  };
};
