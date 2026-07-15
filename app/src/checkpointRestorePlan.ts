import type { WorkspaceCheckpointPreview } from "./workspaceCheckpoints";

type CheckpointRestorePlanInput = {
  dirtyTabPaths: string[];
  preview: WorkspaceCheckpointPreview;
  projectPath: string;
  selectedFilePath: string | null;
};

export type CheckpointRestorePlan = {
  activeFileAction: "write" | "delete" | null;
  affectedAbsolutePaths: Set<string>;
  protectedDirtyPath: string | null;
  relativeDirtyPaths: string[];
};

export const planCheckpointRestore = ({
  dirtyTabPaths,
  preview,
  projectPath,
  selectedFilePath,
}: CheckpointRestorePlanInput): CheckpointRestorePlan => {
  const affectedAbsolutePaths = new Set(preview.files.map((file) => `${projectPath}/${file.path}`));
  const activeFileAction = selectedFilePath && affectedAbsolutePaths.has(selectedFilePath)
    ? preview.files.find((file) => `${projectPath}/${file.path}` === selectedFilePath)?.action ?? null
    : null;
  return {
    activeFileAction,
    affectedAbsolutePaths,
    protectedDirtyPath: dirtyTabPaths.find((path) => affectedAbsolutePaths.has(path)) ?? null,
    relativeDirtyPaths: dirtyTabPaths
      .filter((path) => path.startsWith(`${projectPath}/`))
      .map((path) => path.slice(projectPath.length + 1)),
  };
};
