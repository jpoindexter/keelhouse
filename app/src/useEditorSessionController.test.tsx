// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import type { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";
import type { FileTreeNode } from "./fileTreeTypes";
import { useEditorSessionController } from "./useEditorSessionController";

const file: FileTreeNode = {
  id: "/repo/src/App.tsx",
  kind: "file",
  name: "App.tsx",
  path: "/repo/src/App.tsx",
};

describe("useEditorSessionController", () => {
  it("captures the active editor buffer", () => {
    const { result } = renderHook(() => useEditorSessionController());
    act(() => {
      result.current.setSelectedFile(file);
      result.current.setEditorText("draft");
      result.current.setSavedEditorText("saved");
      result.current.setEditorBytes(5);
      result.current.setEditorModifiedMs(100);
      result.current.setEditorError("read warning");
      result.current.setEditorRecoveryError("recovery warning");
    });

    act(() => result.current.captureCurrentEditorBuffer());

    expect(result.current.editorBuffersRef.current[file.path]).toEqual({
      bytes: 5,
      error: "read warning",
      modifiedMs: 100,
      recoveryError: "recovery warning",
      savedText: "saved",
      text: "draft",
    });
  });

  it("captures selection, scroll, and focus for the active editor view", () => {
    const { result } = renderHook(() => useEditorSessionController());
    result.current.selectedFileRef.current = file;
    result.current.editorViewRef.current = {
      hasFocus: true,
      scrollDOM: { scrollTop: 42 },
      state: { selection: { main: { anchor: 3, head: 8 } } },
    } as unknown as EditorView;

    act(() => result.current.captureCurrentEditorViewState());

    expect(result.current.editorViewStatesRef.current[file.path]).toEqual({
      anchor: 3,
      focused: true,
      head: 8,
      scrollTop: 42,
    });
  });

  it("resets editor state and invalidates pending loads", () => {
    const { result } = renderHook(() => useEditorSessionController());
    act(() => {
      result.current.setSelectedFile(file);
      result.current.setEditorTabs([file]);
      result.current.setEditorText("draft");
      result.current.setSavedEditorText("saved");
      result.current.setEditorError("error");
      result.current.setEditorRecoveryError("recovery");
      result.current.setEditorBytes(5);
      result.current.setEditorModifiedMs(100);
      result.current.setEditorCursor({ line: 4, column: 2 });
    });
    result.current.editorBuffersRef.current[file.path] = {
      bytes: 5, error: null, modifiedMs: 100, recoveryError: null,
      savedText: "saved", text: "draft",
    };
    const loadSequence = result.current.editorLoadSeq.current;

    act(() => result.current.resetEditor());

    expect(result.current.editorLoadSeq.current).toBe(loadSequence + 1);
    expect(result.current.editorBuffersRef.current).toEqual({});
    expect(result.current.editorTabs).toEqual([]);
    expect(result.current.selectedFile).toBeNull();
    expect(result.current.editorText).toBe("");
    expect(result.current.savedEditorText).toBe("");
    expect(result.current.editorError).toBeNull();
    expect(result.current.editorRecoveryError).toBeNull();
    expect(result.current.editorBytes).toBeNull();
    expect(result.current.editorModifiedMs).toBeNull();
    expect(result.current.editorCursor).toEqual({ line: 1, column: 1 });
  });
});
