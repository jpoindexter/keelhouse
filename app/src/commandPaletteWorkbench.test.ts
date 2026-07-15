import { describe, expect, it, vi } from "vitest";
import type { FileTreeNode } from "./fileTreeTypes";
import {
  buildBrowserCommands,
  buildChromeCommands,
  buildComposerAttachmentCommands,
  buildEditorCommands,
  buildWorkspaceCommands,
  buildWorkspaceOpenCommands,
} from "./commandPaletteWorkbench";

const selectedFile: FileTreeNode = {
  id: "/repo/App.tsx",
  kind: "file",
  name: "App.tsx",
  path: "/repo/App.tsx",
};

const createInput = () => ({
  activeComposerHarnessKey: "/repo\nsession",
  browserUrl: "http://localhost:5173",
  detectedBrowserUrl: "http://localhost:5173",
  editorDirty: true,
  editorLoading: false,
  editorSaving: false,
  onAttachCurrentFile: vi.fn(),
  onAttachPreview: vi.fn(),
  onCloseEditorTab: vi.fn(),
  onExportPerformance: vi.fn(),
  onFindEditor: vi.fn(),
  onOpenDetectedBrowser: vi.fn(),
  onOpenSettings: vi.fn(),
  onOpenTranscripts: vi.fn(),
  onOpenWorkspace: vi.fn(),
  onQuickOpen: vi.fn(),
  onReloadBrowser: vi.fn(),
  onResetLayout: vi.fn(),
  onSaveEditor: vi.fn(),
  selectedFile,
  shortcut: vi.fn((id: string) => `shortcut:${id}`),
  workspacePath: "/repo",
});

describe("workbench command palette builders", () => {
  it("routes every fixed workbench command to its supplied action", () => {
    const input = createInput();
    const commands = [
      ...buildWorkspaceOpenCommands(input),
      ...buildChromeCommands(input),
      ...buildWorkspaceCommands(input),
      ...buildEditorCommands(input),
      ...buildBrowserCommands(input),
      ...buildComposerAttachmentCommands(input),
    ];

    for (const command of commands) command.run();

    expect(input.onOpenWorkspace).toHaveBeenCalledOnce();
    expect(input.onOpenTranscripts).toHaveBeenCalledOnce();
    expect(input.onOpenSettings).toHaveBeenCalledOnce();
    expect(input.onExportPerformance).toHaveBeenCalledOnce();
    expect(input.onResetLayout).toHaveBeenCalledOnce();
    expect(input.onQuickOpen).toHaveBeenCalledOnce();
    expect(input.onSaveEditor).toHaveBeenCalledOnce();
    expect(input.onFindEditor).toHaveBeenCalledOnce();
    expect(input.onCloseEditorTab).toHaveBeenCalledOnce();
    expect(input.onReloadBrowser).toHaveBeenCalledOnce();
    expect(input.onOpenDetectedBrowser).toHaveBeenCalledOnce();
    expect(input.onAttachCurrentFile).toHaveBeenCalledOnce();
    expect(input.onAttachPreview).toHaveBeenCalledOnce();
  });

  it("disables workspace and editor commands when their required context is absent", () => {
    const input = {
      ...createInput(),
      activeComposerHarnessKey: "",
      detectedBrowserUrl: null,
      editorDirty: false,
      selectedFile: null,
      workspacePath: null,
    };
    const commands = [
      ...buildWorkspaceCommands(input),
      ...buildEditorCommands(input),
      ...buildBrowserCommands(input),
      ...buildComposerAttachmentCommands(input),
    ];

    for (const id of [
      "perf.snapshot-render-stats", "workspace.quick-open", "editor.save", "editor.find",
      "editor.close-tab", "browser.open-detected", "composer.attach-current", "composer.attach-preview",
    ]) expect(commands.find((command) => command.id === id)?.disabled).toBe(true);
  });
});
