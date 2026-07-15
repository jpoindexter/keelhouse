import { describe, expect, it, vi } from "vitest";
import type { LaunchProfile } from "./launchProfiles";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import { executeTerminalPaneCreate } from "./terminalPaneCreateWorkflow";

const profile: LaunchProfile = {
  args: ["-l"],
  command: "/bin/zsh",
  id: "shell",
  label: "Shell",
  useLoginShell: false,
};

const existingPane: ManagedTerminalPane = {
  createdAt: 1,
  cwd: "/repo",
  exitCode: null,
  id: 3,
  label: null,
  profile,
  slot: 0,
  state: "running",
};

const createWorkflow = (decision: "approved" | "denied" = "approved") => {
  const calls: string[] = [];
  return {
    calls,
    workflow: {
      createPane: vi.fn(async () => { calls.push("create"); return 9; }),
      currentPanes: vi.fn(() => [existingPane]),
      finalizePane: vi.fn(async () => { calls.push("finalize"); }),
      gateAction: vi.fn(async () => decision),
      now: vi.fn(() => 1234),
      profile,
      recordCreated: vi.fn(() => { calls.push("activity"); }),
      requestedBy: "agent" as const,
      root: "/repo",
      savedLabel: vi.fn(() => "Shell 2"),
      setChanging: vi.fn((changing: boolean) => { calls.push(`changing:${changing}`); }),
      setError: vi.fn((error: string) => { calls.push(`error:${error}`); }),
      setSessionPanes: vi.fn(() => { calls.push("panes"); }),
      updateProjectStatus: vi.fn(async () => { calls.push("project"); }),
      updateSessionStatus: vi.fn(async () => { calls.push("session"); }),
    },
  };
};

describe("executeTerminalPaneCreate", () => {
  it("does nothing when creation approval is denied", async () => {
    const { workflow } = createWorkflow("denied");

    const created = await executeTerminalPaneCreate(workflow);

    expect(created).toBe(false);
    expect(workflow.createPane).not.toHaveBeenCalled();
    expect(workflow.setChanging).not.toHaveBeenCalled();
  });

  it("creates and finalizes the next pane in order", async () => {
    const { calls, workflow } = createWorkflow();

    const created = await executeTerminalPaneCreate(workflow);

    expect(created).toBe(true);
    expect(calls).toEqual([
      "changing:true", "create", "panes", "activity", "finalize", "changing:false",
    ]);
    expect(workflow.gateAction).toHaveBeenCalledWith(expect.objectContaining({
      kind: "create-pane",
      requestedBy: "agent",
      target: "Shell in /repo",
    }));
    expect(workflow.setSessionPanes).toHaveBeenCalledWith([
      existingPane,
      expect.objectContaining({ id: 9, label: "Shell 2", slot: 1, state: "running" }),
    ], 9);
    expect(workflow.savedLabel).toHaveBeenCalledWith(1);
  });

  it("marks statuses for attention and clears changing state when creation fails", async () => {
    const { calls, workflow } = createWorkflow();
    workflow.createPane.mockRejectedValueOnce(new Error("create failed"));

    const created = await executeTerminalPaneCreate(workflow);

    expect(created).toBe(false);
    expect(workflow.setError).toHaveBeenCalledWith("Error: create failed");
    expect(workflow.updateProjectStatus).toHaveBeenCalledWith("attention");
    expect(workflow.updateSessionStatus).toHaveBeenCalledWith("attention");
    expect(calls[calls.length - 1]).toBe("changing:false");
  });
});
