import type { MouseEvent } from "react";
import type { GitStatusFile } from "./fileGitStatus";
import type { FileTreeNode } from "./fileTreeTypes";
import type { SourceControlSummary } from "./SourceControlDrawer";
import { FilesDock, SourceControlDock } from "./WorkbenchDocks";

export type WorkbenchDockPanelsProps = {
  files: {
    error: string | null;
    loading: boolean;
    query: string;
    results: FileTreeNode[];
    searchable: FileTreeNode[];
    selectedFilePath: string | null;
  };
  git: {
    error: string | null;
    loading: boolean;
    status: SourceControlSummary | null;
  };
  handlers: {
    createFile: () => void;
    createFolder: () => void;
    gitFileContextMenu: (event: MouseEvent, file: GitStatusFile) => void;
    openDiff: (file: GitStatusFile) => void;
    openFile: (file: FileTreeNode) => void;
    refreshFiles: () => void;
    refreshGit: () => void;
    setQuery: (query: string) => void;
  };
  workspacePath: string | null;
};

export const WorkbenchDockPanels = (props: WorkbenchDockPanelsProps) => (
  <>
    <FilesDock
      files={props.files.query.trim() ? props.files.results : props.files.searchable}
      loading={props.files.loading}
      error={props.files.error}
      query={props.files.query}
      selectedFilePath={props.files.selectedFilePath}
      workspacePath={props.workspacePath}
      onCreateFile={props.handlers.createFile}
      onCreateFolder={props.handlers.createFolder}
      onOpenFile={props.handlers.openFile}
      onQueryChange={props.handlers.setQuery}
      onRefresh={props.handlers.refreshFiles}
    />
    <SourceControlDock
      branch={props.git.status?.branch ?? null}
      error={props.git.error}
      files={props.git.status?.files ?? []}
      isRepository={props.git.status?.isRepository ?? null}
      loading={props.git.loading}
      staged={props.git.status?.staged ?? 0}
      untracked={props.git.status?.untracked ?? 0}
      workspacePath={props.workspacePath}
      onFileContextMenu={props.handlers.gitFileContextMenu}
      onOpenDiff={props.handlers.openDiff}
      onRefresh={props.handlers.refreshGit}
    />
  </>
);
