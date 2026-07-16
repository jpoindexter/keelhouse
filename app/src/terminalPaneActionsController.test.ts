import { describe, expect, it, vi } from "vitest";
import type { LaunchProfile } from "./launchProfiles";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import { createTerminalPaneActionsController } from "./terminalPaneActionsController";
import type { WorktreeRecord } from "./worktrees";

const ref = <T,>(current: T) => ({ current });
const profile: LaunchProfile = {
  id: "codex", label: "Codex", command: "codex", args: [], useLoginShell: false,
};
const pane = (id: number, slot = id - 1): ManagedTerminalPane => ({
  createdAt: id, cwd: "/repo", exitCode: null, id, label: null,
  profile, slot, state: "running",
});
const worktree: WorktreeRecord = {
  branch: "agent/task", createdAt: 1, label: "task", paneId: "1",
  path: "/tmp/task", projectRoot: "/repo",
};

const createOptions = () => ({
  activeAgentDescriptor: null,
  activePaneId: ref<number | null>(1),
  activePaneIds: ref<Record<string, number>>({ "/repo\nchat": 1 }),
  closePane: vi.fn(async () => 2 as number | null),
  createPane: vi.fn(async () => 9),
  createWorktreePane: vi.fn(async () => 10),
  createWorktree: vi.fn(async () => ({ branch: "agent/task", path: "/tmp/task" })),
  defaultProfile: vi.fn(() => profile),
  finalizePane: vi.fn(async () => {}),
  focusPane: vi.fn(async () => {}),
  gateAction: vi.fn(async () => "approved" as const),
  getChanging: vi.fn(() => false),
  getPanes: vi.fn(() => [pane(1), pane(2)]),
  getProjectStatus: vi.fn(() => "running" as const),
  getSessionId: vi.fn(() => "chat" as string | null),
  getWorkspacePath: vi.fn(() => "/repo" as string | null),
  getWorktrees: vi.fn(() => [worktree]),
  intentionallyTerminatedPaneIds: new Set<number>(),
  latest: ref<unknown>(null),
  now: vi.fn(() => 10),
  persistWorktreeRecord: vi.fn(),
  persistWorktreeRemoval: vi.fn(),
  promptWorktreeLabel: vi.fn(() => "task" as string | null),
  recordCreated: vi.fn(),
  recordCreatedWorktree: vi.fn(),
  removeWorktree: vi.fn(async () => {}),
  requestPaint: vi.fn(),
  savedLabel: vi.fn(() => null),
  scheduleResize: vi.fn(),
  selection: ref<unknown>({ anchor: 1 }),
  setChanging: vi.fn(),
  setError: vi.fn(),
  setFocusedPane: vi.fn(),
  setSessionPanes: vi.fn(),
  snapshots: ref<Record<number, unknown>>({ 1: { rows: 1 }, 2: { rows: 2 } }),
  statusForPanes: vi.fn(() => "running" as const),
  updateProjectStatus: vi.fn(async () => {}),
  updateSessionStatus: vi.fn(async () => {}),
});

describe("createTerminalPaneActionsController", () => {
  it("focuses a pane and restores its owned snapshot", async () => {
    const options = createOptions();
    const actions = createTerminalPaneActionsController(options);

    expect(await actions.focusTerminalPane(2, "agent")).toBe(true);

    expect(options.focusPane).toHaveBeenCalledWith(2);
    expect(options.activePaneIds.current["/repo\nchat"]).toBe(2);
    expect(options.latest.current).toEqual({ rows: 2 });
    expect(options.selection.current).toBeNull();
  });

  it("creates a pane in the active project session", async () => {
    const options = createOptions();
    const actions = createTerminalPaneActionsController(options);

    expect(await actions.createTerminalPane()).toBe(true);

    expect(options.createPane).toHaveBeenCalledWith("/repo", profile);
    expect(options.recordCreated).toHaveBeenCalledWith(
      expect.objectContaining({ id: 9 }), "/repo", "chat",
    );
    expect(options.finalizePane).toHaveBeenCalledWith(
      "/repo", expect.arrayContaining([expect.objectContaining({ id: 9 })]), profile,
    );
  });

  it("closes an owned pane and clears its snapshot", async () => {
    const options = createOptions();
    const actions = createTerminalPaneActionsController(options);

    expect(await actions.closeTerminalPane(1)).toBe(true);

    expect(options.closePane).toHaveBeenCalledWith(1);
    expect(options.intentionallyTerminatedPaneIds).toContain(1);
    expect(options.snapshots.current[1]).toBeUndefined();
  });

  it("creates and removes an isolated worktree pane", async () => {
    const options = createOptions();
    const actions = createTerminalPaneActionsController(options);

    expect(await actions.createWorktreePane()).toBe(true);
    expect(options.createWorktree).toHaveBeenCalledWith("/repo", "task");
    expect(options.createWorktreePane).toHaveBeenCalledWith("/tmp/task", profile, "/repo");
    expect(options.persistWorktreeRecord).toHaveBeenCalledWith(expect.objectContaining({ branch: "agent/task" }));

    expect(await actions.closeWorktreePane(1)).toBe(true);
    expect(options.removeWorktree).toHaveBeenCalledWith("/repo", worktree);
    expect(options.persistWorktreeRemoval).toHaveBeenCalledWith("1");
  });
});
