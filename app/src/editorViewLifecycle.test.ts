import { describe, expect, it, vi } from "vitest";
import { createEditorViewLifecycle } from "./editorViewLifecycle";
import type { EditorViewState } from "./editorState";

const ref = <T,>(current: T) => ({ current });

const view = (docLength = 100, scrollTop = 0) => ({
  dispatch: vi.fn(),
  focus: vi.fn(),
  hasFocus: false,
  scrollDOM: { scrollTop },
  state: { doc: { length: docLength } },
});

const update = (anchor: number, head: number, sourceView = view()) => ({
  state: {
    doc: { lineAt: (pos: number) => ({ from: Math.floor(pos / 10) * 10, number: Math.floor(pos / 10) + 1 }) },
    selection: { main: { anchor, head } },
  },
  view: sourceView,
});

const createOptions = () => ({
  getSelectedFilePath: vi.fn(() => "/repo/a.ts" as string | null),
  pendingFocus: ref(false),
  scheduleFrame: (callback: () => void) => callback(),
  setCursor: vi.fn(),
  setView: vi.fn(),
  viewStates: ref<Record<string, EditorViewState>>({}),
});

describe("createEditorViewLifecycle", () => {
  it("ignores editor updates when no file is selected", () => {
    const options = createOptions();
    options.getSelectedFilePath.mockReturnValue(null);
    const lifecycle = createEditorViewLifecycle(options);

    lifecycle.handleEditorUpdate(update(3, 3));

    expect(options.viewStates.current).toEqual({});
    expect(options.setCursor).not.toHaveBeenCalled();
  });

  it("records per-file view state and cursor position on update", () => {
    const options = createOptions();
    const lifecycle = createEditorViewLifecycle(options);
    const sourceView = view(100, 42);
    sourceView.hasFocus = true;

    lifecycle.handleEditorUpdate(update(3, 25, sourceView));

    expect(options.viewStates.current["/repo/a.ts"]).toEqual({
      anchor: 3, focused: true, head: 25, scrollTop: 42,
    });
    expect(options.setCursor).toHaveBeenCalledWith({ column: 6, line: 3 });
  });

  it("restores clamped selection, scroll, and pending focus on view creation", () => {
    const options = createOptions();
    options.viewStates.current["/repo/a.ts"] = {
      anchor: 500, focused: false, head: 500, scrollTop: 42,
    };
    options.pendingFocus.current = true;
    const lifecycle = createEditorViewLifecycle(options);
    const created = view(100);

    lifecycle.restoreEditorView(created);

    expect(options.setView).toHaveBeenCalledWith(created);
    expect(created.dispatch).toHaveBeenCalledWith({
      scrollIntoView: false, selection: { anchor: 100, head: 100 },
    });
    expect(created.scrollDOM.scrollTop).toBe(42);
    expect(created.focus).toHaveBeenCalled();
    expect(options.pendingFocus.current).toBe(false);
  });

  it("skips selection restore without saved state and only focuses when pending", () => {
    const options = createOptions();
    const lifecycle = createEditorViewLifecycle(options);
    const created = view(100);

    lifecycle.restoreEditorView(created);

    expect(created.dispatch).not.toHaveBeenCalled();
    expect(created.focus).not.toHaveBeenCalled();
  });
});
