import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => ({})) }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ confirm: vi.fn(async () => false) }));

import { invoke } from "@tauri-apps/api/core";
import { confirm } from "@tauri-apps/plugin-dialog";
import { DEFAULT_AI_CONNECTION_SETTINGS } from "./connectionSettings";
import type { LaunchProfile } from "./launchProfiles";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import { createWorkspaceOpenSurface } from "./workspaceOpenSurface";

const profile: LaunchProfile = {
  id: "codex", label: "Codex", command: "codex", args: [], useLoginShell: false,
};

const createInput = () => ({
  actions: {
    captureCurrentSession: vi.fn(),
    clearBackgroundExits: vi.fn(),
    dirtyTabPaths: ["/repo/a.ts", "/repo/b.ts"],
    editorDirty: true,
    editorTabs: [
      { id: "a", kind: "file" as const, name: "a.ts", path: "/repo/a.ts" },
      { id: "b", kind: "file" as const, name: "b.ts", path: "/repo/b.ts" },
    ],
    flushComposer: vi.fn(async () => {}),
    getDefaultProfile: () => profile,
    getPreviousActivePaneId: () => null,
    getPreviousPanes: () => [] as ManagedTerminalPane[],
    getPreviousRoot: () => null,
    getSelectedFilePath: () => null,
    getStore: () => null,
    openEditorFile: vi.fn(async () => {}),
    setFocusedPane: vi.fn(),
  },
  connectionSettings: { current: structuredClone(DEFAULT_AI_CONNECTION_SETTINGS) },
  lifecycle: {
    clearCurrentWorkspace: vi.fn(),
    deleteProjectChats: vi.fn(async () => {}),
    now: () => 1,
    persistPaneLayout: vi.fn(),
    projectStatus: vi.fn(() => "running" as const),
    records: {
      activePanes: { ref: { current: {} } },
      activeSessions: { ref: { current: {} }, set: vi.fn() },
      browserProjects: { ref: { current: {} }, set: vi.fn() },
      browserSessions: { ref: { current: {} }, set: vi.fn() },
      conversations: { ref: { current: {} }, set: vi.fn() },
      editorSnapshots: { ref: { current: {} } },
      harnessRecords: { ref: { current: {} }, set: vi.fn() },
      openProjects: { ref: { current: [] }, set: vi.fn() },
      paneLayouts: { ref: { current: {} } },
      projectPanes: { ref: { current: {} } },
      recentProjects: { ref: { current: [] }, set: vi.fn() },
      sessions: { ref: { current: {} }, set: vi.fn() },
    },
    restoreBrowser: vi.fn(),
    restoreEditor: vi.fn(),
    sessionStatus: vi.fn(() => "running" as const),
    setFocusedPane: vi.fn(),
    setLaunchError: vi.fn(),
    setManagedPanes: vi.fn(),
  },
  target: {
    activePaneForSession: vi.fn(() => null),
    activePaneIds: { current: {} as Record<string, number> },
    activeSessions: { current: {} },
    getSurfaceMode: () => "chat",
    latest: { current: null as unknown },
    now: () => 1,
    paneLayouts: { current: {} },
    panesByContext: { current: {} },
    panesForSession: vi.fn(() => []),
    requestPaint: vi.fn(),
    resetEditor: vi.fn(),
    resolveProfile: vi.fn(() => profile),
    restoredActiveFileWorkspace: { current: null as string | null },
    savedLabelForSlot: vi.fn(() => null),
    scheduleResize: vi.fn(),
    sessions: { current: {} },
    setFocusedPane: vi.fn(),
    setLaunchError: vi.fn(),
    setManagedPanes: vi.fn(),
    setWorkspacePath: vi.fn(),
    snapshots: { current: {} },
    workspacePath: { current: null as string | null },
  },
});

describe("createWorkspaceOpenSurface", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockClear();
    vi.mocked(confirm).mockClear();
  });

  it("asks before discarding unsaved tabs and stops when declined", async () => {
    const input = createInput();
    const surface = createWorkspaceOpenSurface(input);

    const opened = await surface.requestOpenWorkspace("/next", vi.fn());

    expect(confirm).toHaveBeenCalledWith("Switch workspace and discard 2 unsaved editor tabs?");
    expect(opened).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("clears background exits for the requested project before opening", async () => {
    const input = createInput();
    const surface = createWorkspaceOpenSurface(input);

    await surface.requestOpenWorkspace("/next", vi.fn());

    expect(input.actions.clearBackgroundExits).toHaveBeenCalledWith("/next");
  });
});
