import { describe, expect, it } from "vitest";
import {
  editorLoadErrorState,
  editorLoadStateFromBuffer,
  editorLoadStateFromResponse,
  type EditorFileBuffer,
} from "./editorFileLoadState";

const buffer: EditorFileBuffer = {
  text: "one\ntwo",
  savedText: "one",
  bytes: 7,
  modifiedMs: 123,
  error: null,
  recoveryError: null,
};

describe("editor file load state", () => {
  it("restores cached file content and clamps the saved cursor state", () => {
    const state = editorLoadStateFromBuffer(buffer, { anchor: -10, head: 999, scrollTop: -5, focused: true });

    expect(state).toEqual({
      text: "one\ntwo",
      savedText: "one",
      bytes: 7,
      modifiedMs: 123,
      error: null,
      recoveryError: null,
      cursor: { line: 2, column: 4 },
      buffer,
    });
  });

  it("converts a file read response into a clean editor state and buffer", () => {
    const state = editorLoadStateFromResponse({
      path: "/repo/README.md",
      content: "alpha\nbeta",
      bytes: 10,
      modifiedMs: 456,
    }, { anchor: 2, head: 8, scrollTop: 0, focused: true });

    expect(state.cursor).toEqual({ line: 2, column: 3 });
    expect(state.buffer).toEqual({
      text: "alpha\nbeta",
      savedText: "alpha\nbeta",
      bytes: 10,
      modifiedMs: 456,
      error: null,
      recoveryError: null,
    });
  });

  it("builds the blank error state stored for failed reads", () => {
    expect(editorLoadErrorState(new Error("denied"))).toEqual({
      text: "",
      savedText: "",
      bytes: null,
      modifiedMs: null,
      error: "Error: denied",
      recoveryError: null,
      cursor: { line: 1, column: 1 },
      buffer: {
        text: "",
        savedText: "",
        bytes: null,
        modifiedMs: null,
        error: "Error: denied",
        recoveryError: null,
      },
    });
  });
});
