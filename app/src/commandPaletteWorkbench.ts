import type { FileTreeNode } from "./fileTreeTypes";
import type { SearchDialogCommand } from "./SearchCommandDialog";

type WorkbenchCommandInput = {
  activeComposerHarnessKey: string | null;
  browserUrl: string;
  detectedBrowserUrl: string | null;
  editorDirty: boolean;
  editorLoading: boolean;
  editorSaving: boolean;
  onAttachCurrentFile: () => void;
  onAttachPreview: () => void;
  onCloseEditorTab: () => void;
  onExportPerformance: () => void;
  onFindEditor: () => void;
  onOpenDetectedBrowser: () => void;
  onOpenSettings: () => void;
  onOpenTranscripts: () => void;
  onOpenWorkspace: () => void;
  onQuickOpen: () => void;
  onReloadBrowser: () => void;
  onResetLayout: () => void;
  onSaveEditor: () => void;
  selectedFile: FileTreeNode | null;
  shortcut: (id: string) => string;
  workspacePath: string | null;
};

export const buildWorkspaceOpenCommands = (input: WorkbenchCommandInput): SearchDialogCommand[] => [{
  id: "workspace.open",
  label: "Open Folder",
  detail: "Choose a project folder",
  shortcut: input.shortcut("workspace.open"),
  icon: "folderOpen",
  keywords: ["project", "workspace"],
  run: input.onOpenWorkspace,
}];

export const buildChromeCommands = (input: WorkbenchCommandInput): SearchDialogCommand[] => [{
  id: "transcripts.open",
  label: "Review Transcripts",
  detail: "Saved output from completed panes",
  icon: "file",
  keywords: ["transcript", "history", "output", "log"],
  run: input.onOpenTranscripts,
}, {
  id: "settings.open",
  label: "Open Settings",
  detail: "Agent, layout, browser preview, and Git settings",
  shortcut: input.shortcut("chrome.settings"),
  icon: "settings",
  keywords: ["preferences", "config", "permission", "profile"],
  run: input.onOpenSettings,
}];

export const buildWorkspaceCommands = (input: WorkbenchCommandInput): SearchDialogCommand[] => [{
  id: "perf.snapshot-render-stats",
  label: "Copy Render Perf Snapshot",
  detail: "Write frame-time/IPC-payload/jank stats to docs/qa/perf-budget/render-perf-live.json",
  icon: "file",
  disabled: !input.workspacePath,
  keywords: ["perf", "performance", "frame", "jank", "render", "budget"],
  run: input.onExportPerformance,
}, {
  id: "layout.reset-demo",
  label: "Reset Layout to Demo Default",
  detail: "Threads visible, Files docked right, agent chat centered",
  icon: "workspace",
  keywords: ["layout", "tray", "dock", "first open", "demo"],
  run: input.onResetLayout,
}, {
  id: "workspace.quick-open",
  label: "Quick Open",
  detail: input.workspacePath ? "Open files by name or path" : "Open a folder before quick open",
  shortcut: input.shortcut("workspace.quick-open"),
  icon: "search",
  disabled: !input.workspacePath,
  keywords: ["file", "jump", "cmd p"],
  run: input.onQuickOpen,
}];

export const buildEditorCommands = (input: WorkbenchCommandInput): SearchDialogCommand[] => [{
  id: "editor.save", label: "Save",
  detail: input.selectedFile?.path ?? "Save the active editor file",
  shortcut: input.shortcut("editor.save"), icon: "save",
  disabled: !input.editorDirty || input.editorSaving || input.editorLoading,
  keywords: ["file", "write"], run: input.onSaveEditor,
}, {
  id: "editor.find", label: "Find and Replace",
  detail: input.selectedFile?.name ?? "Open a file to search inside it",
  shortcut: input.shortcut("editor.find"), icon: "search",
  disabled: !input.selectedFile || input.editorLoading,
  keywords: ["search", "editor"], run: input.onFindEditor,
}, {
  id: "editor.close-tab", label: "Close Tab",
  detail: input.selectedFile?.name ?? "No editor tab selected",
  shortcut: input.shortcut("editor.close-tab"), icon: "close",
  disabled: !input.selectedFile, keywords: ["editor"],
  run: () => { if (input.selectedFile) input.onCloseEditorTab(); },
}];

export const buildBrowserCommands = (input: WorkbenchCommandInput): SearchDialogCommand[] => [{
  id: "browser.reload", label: "Reload Preview", detail: input.browserUrl,
  icon: "reload", keywords: ["browser", "preview"], run: input.onReloadBrowser,
}, {
  id: "browser.open-detected", label: "Open Detected Dev Server",
  detail: input.detectedBrowserUrl ?? "No detected local server",
  icon: "browser", disabled: !input.detectedBrowserUrl,
  keywords: ["localhost", "preview", "vite", "next"], run: input.onOpenDetectedBrowser,
}];

export const buildComposerAttachmentCommands = (
  input: WorkbenchCommandInput,
): SearchDialogCommand[] => [{
  id: "composer.attach-current", label: "Attach Current File",
  detail: input.selectedFile?.path ?? "Open a file first", icon: "file",
  disabled: !input.selectedFile || !input.activeComposerHarnessKey,
  keywords: ["composer", "context"], run: input.onAttachCurrentFile,
}, {
  id: "composer.attach-preview", label: "Attach Browser Preview", detail: input.browserUrl,
  icon: "browser", disabled: !input.activeComposerHarnessKey,
  keywords: ["composer", "context", "browser"], run: input.onAttachPreview,
}];
