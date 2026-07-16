import type { ContextMenuItem } from "./ContextMenu";
import type { FileTreeNode } from "./fileTreeTypes";
import type { AppIconName } from "./icons";
import type { ActiveDiffReview, GitFileAction } from "./useGitDiffReview";

type MenuOptions = {
  danger?: boolean;
  disabled?: boolean;
  icon?: AppIconName;
  shortcut?: string;
};

type EditorContextMenuActions = {
  closeDiff: () => unknown;
  closeTab: (file: FileTreeNode) => unknown;
  copyDiff: () => unknown;
  copyPath: (path: string) => unknown;
  find: () => unknown;
  openDiffFile: () => unknown;
  openExternal: () => unknown;
  openTab: (file: FileTreeNode) => unknown;
  revealNode: (file: FileTreeNode) => unknown;
  revealSelected: () => unknown;
  runGitAction: (action: GitFileAction, file: ActiveDiffReview["file"]) => unknown;
  save: () => unknown;
  shortcut: (id: string) => string;
};

type EditorContextMenuState = {
  editorDirty: boolean;
  editorLoading: boolean;
  editorSaving: boolean;
  selectedFile: FileTreeNode | null;
};

type DiffContextMenuState = {
  canDiscard: boolean;
  canOpenFile: boolean;
  canStage: boolean;
  canUnstage: boolean;
  loading: boolean;
  review: ActiveDiffReview | null;
};

const menuItem = (
  id: string,
  label: string,
  onSelect: () => unknown,
  options: MenuOptions = {},
): ContextMenuItem => ({ id, label, onSelect, ...options });

export const buildEditorTabContextMenuItems = (
  tab: FileTreeNode,
  actions: EditorContextMenuActions,
): ContextMenuItem[] => [
  menuItem("tab.open", "Open", () => actions.openTab(tab), { icon: "file" }),
  menuItem("tab.close", "Close Tab", () => actions.closeTab(tab), {
    icon: "close", shortcut: actions.shortcut("editor.close-tab"),
  }),
  menuItem("tab.reveal", "Reveal in Finder", () => actions.revealNode(tab), { icon: "folderOpen" }),
  menuItem("tab.copy-path", "Copy Path", () => actions.copyPath(tab.path), { icon: "file" }),
];

export const buildEditorContextMenuItems = (
  state: EditorContextMenuState,
  actions: EditorContextMenuActions,
): ContextMenuItem[] => [
  menuItem("editor.save", "Save", actions.save, {
    icon: "save", shortcut: actions.shortcut("editor.save"),
    disabled: !state.editorDirty || state.editorSaving || state.editorLoading,
  }),
  menuItem("editor.find", "Find and Replace", actions.find, {
    icon: "search", shortcut: actions.shortcut("editor.find"),
    disabled: !state.selectedFile || state.editorLoading,
  }),
  menuItem("editor.open-external", "Open Externally", actions.openExternal, {
    icon: "file", disabled: !state.selectedFile,
  }),
  menuItem("editor.reveal", "Reveal in Finder", actions.revealSelected, {
    icon: "folderOpen", disabled: !state.selectedFile,
  }),
  menuItem("editor.copy-path", "Copy File Path", () => {
    if (state.selectedFile) return actions.copyPath(state.selectedFile.path);
  }, { icon: "file", disabled: !state.selectedFile }),
];

export const buildDiffContextMenuItems = (
  state: DiffContextMenuState,
  actions: EditorContextMenuActions,
): ContextMenuItem[] => {
  if (!state.review) return [];
  return [
    menuItem("diff.stage", "Stage File", () => actions.runGitAction("stage", state.review!.file), {
      icon: "git", disabled: !state.canStage || state.loading,
    }),
    menuItem("diff.unstage", "Unstage File", () => actions.runGitAction("unstage", state.review!.file), {
      icon: "git", disabled: !state.canUnstage || state.loading,
    }),
    menuItem("diff.discard", "Discard Unstaged Changes", () => actions.runGitAction("discard", state.review!.file), {
      icon: "error", danger: true, disabled: !state.canDiscard || state.loading,
    }),
    menuItem("diff.copy", "Copy Shown Diff", actions.copyDiff, {
      icon: "copy", disabled: state.review.response.diff.length === 0,
    }),
    menuItem("diff.open", "Open File", actions.openDiffFile, {
      icon: "file", disabled: !state.canOpenFile,
    }),
    menuItem("diff.close", "Close Diff", actions.closeDiff, { icon: "close" }),
  ];
};
