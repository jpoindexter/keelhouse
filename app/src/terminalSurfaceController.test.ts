import { describe, expect, it, vi } from "vitest";
import type { AgentSessionHandle, AgentSessionHandleDescriptor } from "./agentSessionHandle";
import type { LaunchProfile } from "./launchProfiles";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import { createTerminalSurfaceActions, terminalSurfaceDepsFromHook } from "./terminalSurfaceController";

const profile: LaunchProfile = {
  id: "codex", label: "Codex", command: "codex", args: [], useLoginShell: false,
};
const pane = (id: number): ManagedTerminalPane => ({
  createdAt: id, cwd: "/repo", exitCode: null, id, label: null, profile, slot: id - 1, state: "running",
});
const descriptor: AgentSessionHandleDescriptor = {
  activity: { label: "Running", status: "running", updatedAt: 5 },
  agentProfileId: "codex", agentProfileLabel: "Codex", approvalMode: "ask",
  createdAt: 1, cwd: "/repo", exitCode: null, id: "pane:1", label: "Codex",
  paneId: 1, processState: "running", projectId: "/repo", projectSessionId: "chat",
};
const handle: AgentSessionHandle = {
  ...descriptor,
  close: vi.fn(async () => {}), interrupt: vi.fn(async () => {}),
  readTail: vi.fn(async () => "tail"), send: vi.fn(async () => {}),
};

const createDeps = () => ({
  activeAgentDescriptor: () => descriptor as AgentSessionHandleDescriptor | null,
  activeAgentHandle: () => handle as AgentSessionHandle | null,
  activePane: () => pane(1) as ManagedTerminalPane | null,
  activePaneId: { current: 1 as number | null },
  activePaneIds: { current: { "/repo\nchat": 1 } as Record<string, number> },
  approvalMode: () => "ask" as const,
  closePane: vi.fn(async () => 2 as number | null),
  copyText: vi.fn(async () => {}),
  createPane: vi.fn(async () => 9),
  createWorktree: vi.fn(async () => ({ branch: "agent/task", path: "/tmp/task" })),
  createWorktreePane: vi.fn(async () => 10),
  defaultProfile: () => profile,
  finalizePane: vi.fn(async () => {}),
  focusPane: vi.fn(async () => {}),
  gateAction: vi.fn(async () => "approved" as const),
  getChanging: () => false,
  getPanes: vi.fn(() => [pane(1), pane(2)]),
  getProjectStatus: vi.fn(() => "running" as const),
  getSessionId: vi.fn(() => "chat" as string | null),
  getWorkspacePath: vi.fn(() => "/repo" as string | null),
  getWorkspacePathOrState: vi.fn(() => "/repo" as string | null),
  getWorktrees: () => [],
  intentionallyTerminatedPaneIds: new Set<number>(),
  latest: { current: { rows: 1 } as unknown },
  now: () => 10,
  paste: vi.fn(async () => {}),
  persistWorktreeRecord: vi.fn(),
  persistWorktreeRemoval: vi.fn(),
  promptWorktreeLabel: async () => "task" as string | null,
  readClipboard: vi.fn(async () => "clip" as string | null),
  recordActivity: vi.fn(),
  recordCreated: vi.fn(),
  recordCreatedWorktree: vi.fn(),
  removeWorktree: vi.fn(async () => {}),
  requestPaint: vi.fn(),
  restartPane: vi.fn(async () => 7),
  savedLabel: vi.fn(() => null),
  scheduleResize: vi.fn(),
  selection: { current: null as unknown },
  selectionText: vi.fn(() => "selected"),
  sendClearKey: vi.fn(async () => {}),
  setChanging: vi.fn(),
  setComposerError: vi.fn(),
  setFocusedPane: vi.fn(),
  setLaunchError: vi.fn(),
  setPaneExited: vi.fn(() => [pane(1), pane(2)]),
  setSessionPanes: vi.fn(),
  snapshots: { current: {} as Record<number, unknown> },
  statusForPanes: vi.fn(() => "running" as const),
  terminatePane: vi.fn(async () => {}),
  updateProjectStatus: vi.fn(async () => {}),
  updateSessionStatus: vi.fn(async () => {}),
});

describe("createTerminalSurfaceActions", () => {
  it("focuses panes through the shared pane ownership refs", async () => {
    const deps = createDeps();
    const surface = createTerminalSurfaceActions(deps);

    expect(await surface.focusTerminalPane(2, "agent")).toBe(true);

    expect(deps.focusPane).toHaveBeenCalledWith(2);
    expect(deps.activePaneIds.current["/repo\nchat"]).toBe(2);
  });

  it("interrupts the active agent session through the shared handle", async () => {
    const deps = createDeps();
    const surface = createTerminalSurfaceActions(deps);

    expect(await surface.interruptActivePane()).toBe(true);

    expect(handle.interrupt).toHaveBeenCalled();
    expect(deps.setComposerError).toHaveBeenCalledWith(null);
  });

  it("copies the terminal selection through the shared snapshot refs", async () => {
    const deps = createDeps();
    deps.selection.current = { anchor: 1 };
    const surface = createTerminalSurfaceActions(deps);

    await surface.copyTerminalSelection();

    expect(deps.selectionText).toHaveBeenCalledWith({ rows: 1 }, { anchor: 1 });
    expect(deps.copyText).toHaveBeenCalledWith("selected");
  });

  it("terminates a pane and marks it intentionally terminated", async () => {
    const deps = createDeps();
    const surface = createTerminalSurfaceActions(deps);

    expect(await surface.terminateTerminalPane(pane(1))).toBe(true);

    expect(deps.terminatePane).toHaveBeenCalledWith(1);
    expect(deps.intentionallyTerminatedPaneIds).toContain(1);
  });
});

describe("terminalSurfaceDepsFromHook", () => {
  it("maps the terminal hook bundle onto the surface dependency names", () => {
    const deps = createDeps();
    const hook = {
      activePaneIdRef: deps.activePaneId,
      activePaneIdsRef: deps.activePaneIds,
      intentionallyTerminatedPaneIdsRef: { current: deps.intentionallyTerminatedPaneIds },
      panesForSession: deps.getPanes,
      projectStatusForRoot: deps.getProjectStatus,
      setFocusedPane: deps.setFocusedPane,
      setPaneState: (paneId: number, state: "exited", exitCode: number | null) => {
        void paneId; void state; void exitCode;
        return deps.setPaneExited();
      },
      setSessionPanes: deps.setSessionPanes,
      snapshotsRef: deps.snapshots,
      statusForPanes: deps.statusForPanes,
    };

    const mapped = terminalSurfaceDepsFromHook(hook, deps);

    expect(mapped.activePaneId).toBe(deps.activePaneId);
    expect(mapped.getPanes).toBe(deps.getPanes);
    expect(mapped.getProjectStatus).toBe(deps.getProjectStatus);
    expect(mapped.snapshots).toBe(deps.snapshots);
    expect(mapped.setPaneExited(1)).toHaveLength(2);
  });
});
