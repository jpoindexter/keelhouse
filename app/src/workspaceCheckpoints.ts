import { invoke } from "@tauri-apps/api/core";

export type WorkspaceCheckpointSummary = {
  id: string;
  label: string;
  createdAt: number;
  baseCommit: string;
  fileCount: number;
};

export type WorkspaceCheckpointPreviewFile = {
  path: string;
  action: "write" | "delete";
};

export type WorkspaceCheckpointPreview = {
  checkpoint: WorkspaceCheckpointSummary;
  files: WorkspaceCheckpointPreviewFile[];
  previewToken: string;
};

export type WorkspaceCheckpointRestoreResult = {
  checkpointId: string;
  recoveryCheckpointId: string;
  restoredFiles: number;
};

export const createWorkspaceCheckpoint = (root: string, label: string) =>
  invoke<WorkspaceCheckpointSummary>("create_workspace_checkpoint", { root, label });

export const previewWorkspaceCheckpoint = (root: string, checkpointId: string) =>
  invoke<WorkspaceCheckpointPreview>("preview_workspace_checkpoint", { root, checkpointId });

export const restoreWorkspaceCheckpoint = (
  root: string,
  checkpointId: string,
  previewToken: string,
  dirtyPaths: string[],
) => invoke<WorkspaceCheckpointRestoreResult>("restore_workspace_checkpoint", {
  root,
  checkpointId,
  previewToken,
  dirtyPaths,
});

export const checkpointPreviewMessage = (preview: WorkspaceCheckpointPreview) => {
  const rows = preview.files.slice(0, 12).map((file) => `${file.action === "delete" ? "Delete" : "Write"} ${file.path}`);
  const remaining = preview.files.length - rows.length;
  return [
    `Restore "${preview.checkpoint.label}"?`,
    "",
    ...rows,
    ...(remaining > 0 ? [`...and ${remaining} more`] : []),
    "",
    "Keelhouse will create a recovery checkpoint first. Staged files remain staged.",
  ].join("\n");
};
