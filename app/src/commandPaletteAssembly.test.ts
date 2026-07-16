import { describe, expect, it, vi } from "vitest";
import {
  assembleCommandPaletteCommands,
  visibleCommandPaletteCommands,
} from "./commandPaletteAssembly";
import { DRAWER_MODES } from "./drawerModes";
import type { LaunchProfile } from "./launchProfiles";
import type { SearchDialogCommand } from "./SearchCommandDialog";

const profile: LaunchProfile = {
  id: "zsh", label: "zsh", command: "zsh", args: [], useLoginShell: true,
};

const createInput = () => ({
  chats: {
    activeRun: false, activeSessionId: null as string | null,
    onOpenSearchResult: vi.fn(), onOpenSession: vi.fn(), onParallel: vi.fn(),
    openProjects: [], projectSessions: {}, searchResults: [],
    workspacePath: null as string | null,
  },
  navigation: {
    drawerModes: DRAWER_MODES, editorTabs: [], files: [],
    onFocusWorktree: vi.fn(), onLayoutChange: vi.fn(), onOpenFile: vi.fn(),
    onShowDrawer: vi.fn(), onTrayModeChange: vi.fn(), terminalPanes: [],
    workbenchLayout: "right" as const, workspacePath: null as string | null, worktrees: [],
  },
  runAppCommand: vi.fn(),
  terminal: {
    activePane: null, activePaneLabel: null as string | null, canClose: false,
    launchProfileChanging: false, onClear: vi.fn(), onClose: vi.fn(),
    onCreatePane: vi.fn(), onCreateWorktreePane: vi.fn(), onFind: vi.fn(),
    onKill: vi.fn(), onRemoveWorktree: vi.fn(), onRestart: vi.fn(),
    shortcut: vi.fn(() => ""), terminalProfile: profile,
    workspacePath: null as string | null, worktrees: [],
  },
  workbench: {
    activeComposerHarnessKey: null as string | null, browserUrl: "",
    detectedBrowserUrl: null as string | null, editorDirty: false,
    editorLoading: false, editorSaving: false,
    onAttachCurrentFile: vi.fn(), onAttachPreview: vi.fn(), onCloseEditorTab: vi.fn(),
    onExportPerformance: vi.fn(), onFindEditor: vi.fn(), onOpenDetectedBrowser: vi.fn(),
    onOpenSettings: vi.fn(), onOpenTranscripts: vi.fn(), onOpenWorkspace: vi.fn(),
    onQuickOpen: vi.fn(), onReloadBrowser: vi.fn(), onResetLayout: vi.fn(),
    onSaveEditor: vi.fn(), selectedFile: null, shortcut: vi.fn(() => ""),
    workspacePath: null as string | null,
  },
});

const command = (id: number, source: SearchDialogCommand["source"]): SearchDialogCommand => ({
  detail: "detail", icon: "send", id: `cmd.${source}.${id}`, label: `test command ${id}`,
  run: () => {}, source,
});

describe("assembleCommandPaletteCommands", () => {
  it("maps composer app commands into runnable palette entries", () => {
    const input = createInput();

    const commands = assembleCommandPaletteCommands(input);

    const save = commands.find((entry) => entry.id === "composer.save");
    expect(save).toBeDefined();
    expect(save?.label).toBe("App Command >save");
    save?.run();
    expect(input.runAppCommand).toHaveBeenCalledWith("save");
    for (const id of ["composer.find", "composer.open-folder", "composer.clear-terminal", "composer.help"]) {
      expect(commands.some((entry) => entry.id === id)).toBe(true);
    }
  });
});

describe("visibleCommandPaletteCommands", () => {
  it("shows six chat and six other commands when the query is empty", () => {
    const commands = [
      ...Array.from({ length: 8 }, (_, index) => command(index, "chats")),
      ...Array.from({ length: 8 }, (_, index) => command(index + 100, "commands")),
    ];

    const visible = visibleCommandPaletteCommands(commands, "");

    expect(visible).toHaveLength(12);
    expect(visible.slice(0, 6).every((entry) => entry.source === "chats")).toBe(true);
    expect(visible.slice(6).every((entry) => entry.source !== "chats")).toBe(true);
  });

  it("caps query results at 120 filtered commands", () => {
    const commands = Array.from({ length: 130 }, (_, index) => command(index, "commands"));

    const visible = visibleCommandPaletteCommands(commands, "test command");

    expect(visible).toHaveLength(120);
  });
});
