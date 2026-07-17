import { useEffect } from "react";
import type { TreeApi } from "react-arborist";
import type { deriveEditorWorkspaceState } from "./editorWorkspaceState";
import { findFileTreeNode, reconcileActiveFileNode } from "./editorState";
import type { FileTreeNode } from "./fileTreeTypes";
import type { wireEditorFileWorkflow } from "./editorFileWorkflowSurface";
import { useSyncRef } from "./useSyncRef";
import type { useWorkspaceDomain } from "./useWorkspaceDomain";
import { useWorkspaceTreeWatcher } from "./useWorkspaceTreeWatcher";

type WorkspaceDomain = ReturnType<typeof useWorkspaceDomain>;

type EditorWorkspaceRuntimeInput = {
  editorFileWorkflow: ReturnType<typeof wireEditorFileWorkflow>;
  editorSession: WorkspaceDomain["editorSession"];
  editorWorkspace: ReturnType<typeof deriveEditorWorkspaceState>;
  persistence: WorkspaceDomain["persistence"];
  treeRef: { current: TreeApi<FileTreeNode> | undefined };
  workspacePath: string | null;
  workspacePathRef: { current: string | null };
  workspaceTree: WorkspaceDomain["workspaceTree"];
};

const useSelectedFileReveal = (input: EditorWorkspaceRuntimeInput) => {
  useEffect(() => {
    if (!input.editorSession.selectedFile) return;
    input.treeRef.current?.scrollTo(input.editorSession.selectedFile.id, "smart");
  }, [input.editorSession.selectedFile, input.editorWorkspace.visibleFileTree]);
};

const useSelectedFileReconcile = (input: EditorWorkspaceRuntimeInput) => {
  useEffect(() => {
    if (!input.editorSession.selectedFile || input.workspaceTree.tree.length === 0) return;
    const syncedFile = reconcileActiveFileNode(input.workspaceTree.tree, input.editorSession.selectedFile);
    if (syncedFile !== input.editorSession.selectedFile) input.editorSession.setSelectedFile(syncedFile);
  }, [input.workspaceTree.tree, input.editorSession.selectedFile]);
};

const useRestoredActiveFile = (input: EditorWorkspaceRuntimeInput) => {
  useEffect(() => {
    if (!input.workspacePath || input.workspaceTree.loading || input.workspaceTree.error
      || input.workspaceTree.tree.length === 0 || input.editorSession.selectedFile) return;
    if (input.editorSession.restoredActiveFileWorkspaceRef.current === input.workspacePath) return;
    input.editorSession.restoredActiveFileWorkspaceRef.current = input.workspacePath;
    const savedActiveFile = input.editorSession.activeFilesByWorkspaceRef.current[input.workspacePath];
    if (!savedActiveFile) return;
    const node = findFileTreeNode(input.workspaceTree.tree, savedActiveFile);
    if (node?.kind === "file") void input.editorFileWorkflow.openDirect(node);
    else void input.persistence.clearActiveFile(input.workspacePath);
  }, [
    input.workspaceTree.tree, input.workspaceTree.error, input.workspaceTree.loading,
    input.editorSession.selectedFile, input.workspacePath,
  ]);
};

export const useEditorWorkspaceRuntime = (input: EditorWorkspaceRuntimeInput) => {
  useSelectedFileReveal(input);
  useSelectedFileReconcile(input);
  useSyncRef(input.workspacePathRef, input.workspacePath);
  useRestoredActiveFile(input);
  useWorkspaceTreeWatcher({
    getActiveRoot: () => input.workspacePathRef.current,
    onChange: input.workspaceTree.refresh,
    onError: (error) => input.workspaceTree.setError(`Live file watcher unavailable: ${error}`),
    workspacePath: input.workspacePath,
  });
};
