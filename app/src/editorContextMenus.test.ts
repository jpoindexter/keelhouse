import { describe, expect, it, vi } from "vitest";
import type { ActiveDiffReview } from "./useGitDiffReview";
import type { FileTreeNode } from "./fileTreeTypes";
import {
  buildDiffContextMenuItems,
  buildEditorContextMenuItems,
  buildEditorTabContextMenuItems,
} from "./editorContextMenus";

const file: FileTreeNode = {
  id: "/repo/src/App.tsx",
  kind: "file",
  name: "App.tsx",
  path: "/repo/src/App.tsx",
};

const createActions = () => ({
  closeDiff: vi.fn(),
  closeTab: vi.fn(),
  copyDiff: vi.fn(),
  copyPath: vi.fn(),
  find: vi.fn(),
  openDiffFile: vi.fn(),
  openExternal: vi.fn(),
  openTab: vi.fn(),
  revealNode: vi.fn(),
  revealSelected: vi.fn(),
  runGitAction: vi.fn(),
  save: vi.fn(),
  shortcut: vi.fn((id: string) => `shortcut:${id}`),
});

describe("editor context menus", () => {
  it("routes editor tab actions", () => {
    const actions = createActions();
    const items = buildEditorTabContextMenuItems(file, actions);

    for (const item of items) item.onSelect();

    expect(actions.openTab).toHaveBeenCalledWith(file);
    expect(actions.closeTab).toHaveBeenCalledWith(file);
    expect(actions.revealNode).toHaveBeenCalledWith(file);
    expect(actions.copyPath).toHaveBeenCalledWith(file.path);
  });

  it("gates editor actions from dirty, loading, saving, and selection state", () => {
    const actions = createActions();
    const items = buildEditorContextMenuItems({
      editorDirty: true, editorLoading: false, editorSaving: false, selectedFile: file,
    }, actions);

    expect(items.find((item) => item.id === "editor.save")?.disabled).toBe(false);
    expect(items.find((item) => item.id === "editor.find")?.disabled).toBe(false);
    items.find((item) => item.id === "editor.copy-path")?.onSelect();
    expect(actions.copyPath).toHaveBeenCalledWith(file.path);

    const empty = buildEditorContextMenuItems({
      editorDirty: false, editorLoading: true, editorSaving: true, selectedFile: null,
    }, actions);
    expect(empty.find((item) => item.id === "editor.save")?.disabled).toBe(true);
    expect(empty.find((item) => item.id === "editor.find")?.disabled).toBe(true);
  });

  it("builds diff actions only for an active review", () => {
    const actions = createActions();
    const review = {
      file: { index: " ", path: "src/App.tsx", worktree: "M" },
      response: { diff: "@@ changed", path: "src/App.tsx", source: "working-tree" },
    } as ActiveDiffReview;
    const items = buildDiffContextMenuItems({
      canDiscard: true, canOpenFile: true, canStage: true, canUnstage: false,
      loading: false, review,
    }, actions);

    expect(buildDiffContextMenuItems({
      canDiscard: false, canOpenFile: false, canStage: false, canUnstage: false,
      loading: false, review: null,
    }, actions)).toEqual([]);
    items.find((item) => item.id === "diff.stage")?.onSelect();
    items.find((item) => item.id === "diff.copy")?.onSelect();
    expect(actions.runGitAction).toHaveBeenCalledWith("stage", review.file);
    expect(actions.copyDiff).toHaveBeenCalledOnce();
    expect(items.find((item) => item.id === "diff.unstage")?.disabled).toBe(true);
    expect(items.find((item) => item.id === "diff.discard")?.danger).toBe(true);
  });
});
