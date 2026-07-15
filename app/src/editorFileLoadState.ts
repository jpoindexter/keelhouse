import {
  clampEditorViewState,
  cursorFromText,
  type CursorPosition,
  type EditorViewState,
} from "./editorState";
import type { EditorBufferSnapshot } from "./editorTabs";

export type EditorFileBuffer = EditorBufferSnapshot & {
  bytes: number | null;
  modifiedMs: number | null;
  error: string | null;
  recoveryError: string | null;
};

export type TextFileReadResult = {
  path: string;
  content: string;
  bytes: number;
  modifiedMs: number | null;
};

export type EditorFileLoadState = EditorFileBuffer & {
  buffer: EditorFileBuffer;
  cursor: CursorPosition;
};

const cursorForContent = (content: string, viewState: EditorViewState | undefined): CursorPosition => {
  const restored = clampEditorViewState(viewState, content.length);
  return restored ? cursorFromText(content, restored.head) : { line: 1, column: 1 };
};

export const editorLoadStateFromBuffer = (
  buffer: EditorFileBuffer,
  viewState: EditorViewState | undefined,
): EditorFileLoadState => ({
  ...buffer,
  buffer,
  cursor: cursorForContent(buffer.text, viewState),
});

export const editorLoadStateFromResponse = (
  response: TextFileReadResult,
  viewState: EditorViewState | undefined,
): EditorFileLoadState => {
  const buffer: EditorFileBuffer = {
    text: response.content,
    savedText: response.content,
    bytes: response.bytes,
    modifiedMs: response.modifiedMs,
    error: null,
    recoveryError: null,
  };
  return editorLoadStateFromBuffer(buffer, viewState);
};

export const editorLoadErrorState = (error: unknown): EditorFileLoadState => {
  const message = String(error);
  const buffer: EditorFileBuffer = {
    text: "",
    savedText: "",
    bytes: null,
    modifiedMs: null,
    error: message,
    recoveryError: null,
  };
  return {
    ...buffer,
    buffer,
    cursor: { line: 1, column: 1 },
  };
};
