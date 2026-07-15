import { shouldPromptForDirtyDraft } from "./draftProtection";
import type { FileTreeNode } from "./fileTreeTypes";

type RequestWorkspaceOpenInput = {
  confirmDiscard: (count: number) => Promise<boolean>;
  deferNavigation: () => void;
  dirtyTabPaths: string[];
  editorDirty: boolean;
  editorTabs: FileTreeNode[];
  openEditorFile: (file: FileTreeNode) => Promise<unknown>;
  openWorkspace: (path: string) => Promise<boolean>;
  path: string;
  selectedFilePath: string | null;
};

export const requestWorkspaceOpen = async ({
  confirmDiscard,
  deferNavigation,
  dirtyTabPaths,
  editorDirty,
  editorTabs,
  openEditorFile,
  openWorkspace,
  path,
  selectedFilePath,
}: RequestWorkspaceOpenInput) => {
  if (dirtyTabPaths.length > 1) {
    if (!await confirmDiscard(dirtyTabPaths.length)) return false;
  } else if (dirtyTabPaths.length === 1) {
    const dirtyTab = editorTabs.find((tab) => tab.path === dirtyTabPaths[0]);
    if (dirtyTab && dirtyTab.path !== selectedFilePath) await openEditorFile(dirtyTab);
    deferNavigation();
    return false;
  } else if (shouldPromptForDirtyDraft(editorDirty, selectedFilePath, { kind: "workspace", path })) {
    deferNavigation();
    return false;
  }
  return openWorkspace(path);
};
