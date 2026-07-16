import { describe, expect, it, vi } from "vitest";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import { createProjectCloseController, projectCloseFromHook } from "./projectCloseController";

const ref = <T,>(current: T) => ({ current });
const profile = { id: "shell", label: "Shell", command: "/bin/zsh", args: [], useLoginShell: false };
const pane: ManagedTerminalPane = {
  createdAt: 1, cwd: "/repo", exitCode: null, id: 7, label: null,
  profile, slot: 0, state: "running",
};

const createOptions = () => ({
  activePanes: ref<Record<string, number>>({ "/repo\nsession": 7 }),
  clearActiveWorkspace: vi.fn(),
  closePane: vi.fn(async () => {}),
  confirmClose: vi.fn(async () => true),
  conversations: ref<Record<string, { activeRunId?: string | null }>>({}),
  deleteStoredFolder: vi.fn(async () => {}),
  dirtyTabCount: 0,
  getPanes: vi.fn((path: string) => path === "/repo" ? [pane] : []),
  hasSelectedFile: vi.fn(() => false),
  intentionallyTerminatedPaneIds: new Set<number>(),
  openProjects: ref([
    { path: "/repo", status: "running" as const },
    { path: "/fallback", status: "exited" as const },
  ]),
  openWorkspace: vi.fn(async () => true),
  persistOpenProjects: vi.fn(async () => {}),
  projectPanes: ref<Record<string, ManagedTerminalPane[]>>({ "/repo\nsession": [pane] }),
  saveStore: vi.fn(async () => {}),
  setActionNotice: vi.fn(),
  setLaunchError: vi.fn(),
  snapshots: ref<Record<number, unknown>>({ 7: { rows: 1 } }),
  stopChatRun: vi.fn(async () => {}),
  stopWorkspaceWatcher: vi.fn(async () => {}),
  workspacePath: ref<string | null>("/repo"),
});

describe("createProjectCloseController", () => {
  it("switches to a fallback before closing the active project", async () => {
    const options = createOptions();
    const controller = createProjectCloseController(options);

    const closed = await controller.closeProjectDirect("/repo");

    expect(closed).toBe(true);
    expect(options.openWorkspace).toHaveBeenCalledWith("/fallback");
    expect(options.closePane).toHaveBeenCalledWith(7);
    expect(options.persistOpenProjects).toHaveBeenCalledWith([
      { path: "/fallback", status: "exited" },
    ]);
    expect(options.setActionNotice).toHaveBeenCalledWith("Closed repo");
  });

  it("clears the workspace when the last open project closes", async () => {
    const options = createOptions();
    options.openProjects.current = [{ path: "/repo", status: "running" }];
    const controller = createProjectCloseController(options);

    const closed = await controller.closeProjectDirect("/repo");

    expect(closed).toBe(true);
    expect(options.stopWorkspaceWatcher).toHaveBeenCalledOnce();
    expect(options.workspacePath.current).toBeNull();
    expect(options.clearActiveWorkspace).toHaveBeenCalledOnce();
    expect(options.deleteStoredFolder).toHaveBeenCalledOnce();
  });

  it("defers an active-project close when the selected editor tab is dirty", async () => {
    const options = createOptions();
    options.dirtyTabCount = 1;
    options.hasSelectedFile.mockReturnValue(true);
    const controller = createProjectCloseController(options);
    const deferNavigation = vi.fn();

    const closed = await controller.requestCloseProject(
      { path: "/repo", status: "running" }, deferNavigation,
    );

    expect(closed).toBe(false);
    expect(deferNavigation).toHaveBeenCalledOnce();
    expect(options.closePane).not.toHaveBeenCalled();
  });
});

describe("projectCloseFromHook", () => {
  it("maps pane-hook refs onto the close controller names", () => {
    const options = createOptions();
    const hook = {
      activePaneIdsRef: options.activePanes,
      intentionallyTerminatedPaneIdsRef: { current: options.intentionallyTerminatedPaneIds },
      panesByContextRef: options.projectPanes,
      panesForProject: options.getPanes,
      snapshotsRef: options.snapshots,
    };

    const mapped = projectCloseFromHook(hook, options);

    expect(mapped.activePanes).toBe(options.activePanes);
    expect(mapped.getPanes).toBe(options.getPanes);
    expect(mapped.projectPanes).toBe(options.projectPanes);
    expect(mapped.snapshots).toBe(options.snapshots);
    expect(mapped.intentionallyTerminatedPaneIds).toBe(options.intentionallyTerminatedPaneIds);
  });
});
