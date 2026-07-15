import { describe, expect, it } from "vitest";
import type { EditorFileBuffer } from "./editorFileLoadState";
import type { FileTreeNode } from "./fileTreeTypes";
import { deriveEditorWorkspaceState } from "./editorWorkspaceState";

const file = (path: string): FileTreeNode => ({
  id: path,
  kind: "file",
  name: path.split("/").pop() ?? path,
  path,
});

const buffer = (text: string, savedText: string): EditorFileBuffer => ({
  bytes: text.length,
  error: null,
  modifiedMs: 10,
  recoveryError: null,
  savedText,
  text,
});

describe("deriveEditorWorkspaceState", () => {
  it("projects dirty buffers, breadcrumbs, language, Git status, and searchable files", () => {
    const selectedFile = file("/repo/src/App.tsx");
    const otherFile = file("/repo/README.md");

    const result = deriveEditorWorkspaceState({
      diffReview: null,
      editorBuffers: { [otherFile.path]: buffer("changed", "saved") },
      editorError: null,
      editorTabs: [selectedFile, otherFile],
      editorText: "active change",
      fileTree: [selectedFile, otherFile],
      gitStatus: { isRepository: true, files: [{ path: "src/App.tsx", index: " ", worktree: "M" }] },
      gitStatusRoot: "/repo",
      savedEditorText: "active saved",
      selectedFile,
      workspacePath: "/repo",
    });

    expect(result.editorDirty).toBe(true);
    expect(result.dirtyTabPaths).toEqual([selectedFile.path, otherFile.path]);
    expect(result.editorBreadcrumbs).toEqual(["repo", "src", "App.tsx"]);
    expect(result.editorLanguage).toBe("TSX");
    expect(result.visibleFileTree[0]).toMatchObject({ dirty: true, gitStatus: { code: "modified" } });
    expect(result.searchableFiles.map((item) => item.path)).toEqual([selectedFile.path, otherFile.path]);
  });

  it("detects missing active files, save conflicts, and deleted diff constraints", () => {
    const selectedFile = file("/repo/missing.ts");
    const result = deriveEditorWorkspaceState({
      diffReview: { absolutePath: "/repo/deleted.ts", file: { path: "deleted.ts", index: "D", worktree: " " } },
      editorBuffers: {},
      editorError: "File changed on disk since it was opened: /repo/missing.ts",
      editorTabs: [selectedFile],
      editorText: "same",
      fileTree: [file("/repo/kept.ts")],
      gitStatus: null,
      gitStatusRoot: null,
      savedEditorText: "same",
      selectedFile,
      workspacePath: "/repo",
    });

    expect(result.activeFileMissing).toBe(true);
    expect(result.editorSaveConflict).toBe(true);
    expect(result.diffBreadcrumbs).toEqual(["repo", "deleted.ts"]);
    expect(result).toMatchObject({
      diffReviewCanDiscard: false,
      diffReviewCanOpenFile: false,
      diffReviewCanStage: false,
      diffReviewCanUnstage: true,
    });
  });

  it("returns neutral editor and diff values without a selection", () => {
    const result = deriveEditorWorkspaceState({
      diffReview: null,
      editorBuffers: {},
      editorError: null,
      editorTabs: [],
      editorText: "",
      fileTree: [],
      gitStatus: null,
      gitStatusRoot: null,
      savedEditorText: "",
      selectedFile: null,
      workspacePath: null,
    });

    expect(result).toMatchObject({
      activeFileMissing: false,
      diffBreadcrumbs: [],
      dirtyTabPaths: [],
      editorBreadcrumbs: [],
      editorDirty: false,
      editorLanguage: "No file",
      editorSaveConflict: false,
      searchableFiles: [],
    });
  });
});
