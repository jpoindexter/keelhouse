import type { EditorFileBuffer } from "./editorFileLoadState";
import { fileTreeContainsPath, languageLabelForPath, pathBreadcrumbs } from "./editorState";
import { dirtyEditorTabPaths } from "./editorTabs";
import { decorateFileTreeWithGitStatus, type GitStatusFile } from "./fileGitStatus";
import { flattenFileTree, markDirtyFiles } from "./fileTreeView";
import type { FileTreeNode } from "./fileTreeTypes";

type DiffReviewSummary = { absolutePath: string; file: GitStatusFile };
type GitStatusSummary = { isRepository: boolean; files: GitStatusFile[] };

type EditorWorkspaceStateInput = {
  diffReview: DiffReviewSummary | null;
  editorBuffers: Record<string, EditorFileBuffer>;
  editorError: string | null;
  editorTabs: FileTreeNode[];
  editorText: string;
  fileTree: FileTreeNode[];
  gitStatus: GitStatusSummary | null;
  gitStatusRoot: string | null;
  savedEditorText: string;
  selectedFile: FileTreeNode | null;
  workspacePath: string | null;
};

const diffCapabilities = (diffReview: DiffReviewSummary | null) => ({
  diffReviewCanOpenFile: Boolean(diffReview && diffReview.file.index !== "D" && diffReview.file.worktree !== "D"),
  diffReviewCanStage: Boolean(diffReview && (diffReview.file.index === "?" || diffReview.file.worktree !== " ")),
  diffReviewCanUnstage: Boolean(diffReview && diffReview.file.index !== " " && diffReview.file.index !== "?"),
  diffReviewCanDiscard: Boolean(diffReview && (diffReview.file.index === "?" || diffReview.file.worktree !== " ")),
});

export const deriveEditorWorkspaceState = (input: EditorWorkspaceStateInput) => {
  const editorDirty = input.selectedFile != null && input.editorText !== input.savedEditorText;
  const dirtyTabPaths = dirtyEditorTabPaths(
    input.editorTabs, input.editorBuffers, input.selectedFile?.path ?? null, editorDirty,
  );
  const dirtyTabPathSet = new Set(dirtyTabPaths);
  const editorSaveConflict = input.editorError?.startsWith("File changed on disk since it was opened") ?? false;
  const activeFileMissing = input.selectedFile != null
    && input.fileTree.length > 0
    && !fileTreeContainsPath(input.fileTree, input.selectedFile.path);
  const editorBreadcrumbs = input.selectedFile
    ? pathBreadcrumbs(input.workspacePath, input.selectedFile.path)
    : [];
  const editorLanguage = input.selectedFile ? languageLabelForPath(input.selectedFile.path) : "No file";
  const diffBreadcrumbs = input.diffReview
    ? pathBreadcrumbs(input.workspacePath, input.diffReview.absolutePath)
    : [];
  const dirtyTree = markDirtyFiles(input.fileTree, dirtyTabPathSet);
  const files = input.workspacePath === input.gitStatusRoot && input.gitStatus?.isRepository
    ? input.gitStatus.files
    : [];
  const visibleFileTree = decorateFileTreeWithGitStatus(input.workspacePath, dirtyTree, files);
  return {
    activeFileMissing, diffBreadcrumbs, dirtyTabPathSet, dirtyTabPaths,
    editorBreadcrumbs, editorDirty, editorLanguage, editorSaveConflict,
    searchableFiles: flattenFileTree(visibleFileTree), visibleFileTree,
    ...diffCapabilities(input.diffReview),
  };
};
