import { describe, expect, it, vi } from "vitest";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import { executeTerminalWorktreePaneCreate } from "./terminalWorktreePaneCreateWorkflow";

const profile = {
  args: ["-l"],
  command: "/bin/zsh",
  id: "shell",
  label: "Shell",
  useLoginShell: false,
};

const createWorkflow = (decision: "approved" | "denied" = "approved") => {
  const calls: string[] = [];
  const workflow = {
    createPane: vi.fn(async () => { calls.push("pane"); return 7; }),
    createWorktree: vi.fn(async () => {
      calls.push("worktree");
      return { branch: "feature/dev", path: "/repo/.worktrees/dev" };
    }),
    currentPanes: vi.fn(() => [] as ManagedTerminalPane[]),
    finalizePane: vi.fn(async () => { calls.push("finalize"); }),
    gateAction: vi.fn(async () => decision),
    now: vi.fn(() => 100),
    persistRecord: vi.fn(() => { calls.push("persist"); }),
    profile,
    projectRoot: "/repo",
    promptLabel: vi.fn(() => "  Dev  "),
    recordCreated: vi.fn(() => { calls.push("record"); }),
    setChanging: vi.fn((changing: boolean) => { calls.push(`changing:${changing}`); }),
    setError: vi.fn((error: string) => { calls.push(`error:${error}`); }),
    setSessionPanes: vi.fn(() => { calls.push("session"); }),
    updateProjectStatus: vi.fn(async () => { calls.push("project"); }),
    updateSessionStatus: vi.fn(async () => { calls.push("status"); }),
  };
  return { calls, workflow };
};

describe("executeTerminalWorktreePaneCreate", () => {
  it("creates and persists an approved worktree pane in order", async () => {
    const { calls, workflow } = createWorkflow();

    const created = await executeTerminalWorktreePaneCreate(workflow);

    expect(created).toBe(true);
    expect(workflow.gateAction).toHaveBeenCalledWith(expect.objectContaining({
      kind: "create-worktree",
      target: "Dev in /repo",
    }));
    expect(workflow.setSessionPanes).toHaveBeenCalledWith(
      [expect.objectContaining({ cwd: "/repo/.worktrees/dev", id: 7, label: "Dev" })], 7,
    );
    expect(calls).toEqual([
      "changing:true", "worktree", "pane", "session", "persist", "record", "finalize",
      "changing:false",
    ]);
  });

  it("does not mutate state when approval is denied", async () => {
    const { workflow } = createWorkflow("denied");

    const created = await executeTerminalWorktreePaneCreate(workflow);

    expect(created).toBe(false);
    expect(workflow.createWorktree).not.toHaveBeenCalled();
    expect(workflow.setChanging).not.toHaveBeenCalled();
  });

  it("does not request approval for an empty worktree label", async () => {
    const { workflow } = createWorkflow();
    workflow.promptLabel.mockReturnValueOnce("   ");

    const created = await executeTerminalWorktreePaneCreate(workflow);

    expect(created).toBe(false);
    expect(workflow.gateAction).not.toHaveBeenCalled();
  });

  it("marks project and session attention when backend creation fails", async () => {
    const { calls, workflow } = createWorkflow();
    workflow.createWorktree.mockRejectedValueOnce(new Error("git unavailable"));

    const created = await executeTerminalWorktreePaneCreate(workflow);

    expect(created).toBe(false);
    expect(workflow.setError).toHaveBeenCalledWith("Error: git unavailable");
    expect(workflow.updateProjectStatus).toHaveBeenCalledWith("attention");
    expect(workflow.updateSessionStatus).toHaveBeenCalledWith("attention");
    expect(calls[calls.length - 1]).toBe("changing:false");
  });
});
