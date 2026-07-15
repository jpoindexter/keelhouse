import { describe, expect, it, vi } from "vitest";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import { executeTerminalPaneClose } from "./terminalPaneCloseWorkflow";

const profile = {
  args: [],
  command: "/bin/zsh",
  id: "shell",
  label: "Shell",
  useLoginShell: false,
};

const panes: ManagedTerminalPane[] = [
  {
    createdAt: 1,
    cwd: "/repo",
    exitCode: null,
    id: 7,
    label: "Dev",
    profile,
    slot: 0,
    state: "running",
  },
  {
    createdAt: 2,
    cwd: "/repo",
    exitCode: null,
    id: 8,
    label: null,
    profile,
    slot: 1,
    state: "running",
  },
];

const createWorkflow = (decision: "approved" | "denied" = "approved") => {
  const calls: string[] = [];
  return {
    calls,
    workflow: {
      clearPaneSnapshot: vi.fn(() => { calls.push("snapshot"); }),
      closePane: vi.fn(async () => { calls.push("close"); return 8; }),
      currentPanes: vi.fn(() => panes),
      focusPane: vi.fn(async () => { calls.push("focus"); }),
      gateAction: vi.fn(async () => decision),
      markIntentionallyTerminated: vi.fn(() => { calls.push("mark"); }),
      pane: panes[0],
      projectStatus: vi.fn(() => "running" as const),
      requestPaint: vi.fn(() => { calls.push("paint"); }),
      scheduleResize: vi.fn(() => { calls.push("resize"); }),
      sessionStatus: vi.fn(() => "running" as const),
      setError: vi.fn((error: string | null) => { calls.push(`error:${error}`); }),
      setLatestSnapshot: vi.fn(() => { calls.push("latest"); }),
      setSessionPanes: vi.fn(() => { calls.push("panes"); }),
      unmarkIntentionallyTerminated: vi.fn(() => { calls.push("unmark"); }),
      updateProjectStatus: vi.fn(async () => { calls.push("project"); }),
      updateSessionStatus: vi.fn(async () => { calls.push("session"); }),
    },
  };
};

describe("executeTerminalPaneClose", () => {
  it("does nothing when close approval is denied", async () => {
    const { workflow } = createWorkflow("denied");

    const closed = await executeTerminalPaneClose(workflow);

    expect(closed).toBe(false);
    expect(workflow.closePane).not.toHaveBeenCalled();
  });

  it("closes the pane and synchronizes the next active pane in order", async () => {
    const { calls, workflow } = createWorkflow();

    const closed = await executeTerminalPaneClose(workflow);

    expect(closed).toBe(true);
    expect(calls).toEqual([
      "mark", "close", "snapshot", "panes", "focus", "latest", "paint",
      "error:null", "project", "session", "resize",
    ]);
    expect(workflow.gateAction).toHaveBeenCalledWith(expect.objectContaining({
      kind: "close-pane",
      risk: "destructive",
      target: "Dev",
    }));
    expect(workflow.setSessionPanes).toHaveBeenCalledWith([panes[1]], 8);
    expect(workflow.setLatestSnapshot).toHaveBeenCalledWith(8);
  });

  it("unmarks an unclosed pane and marks statuses for attention when close fails", async () => {
    const { calls, workflow } = createWorkflow();
    workflow.closePane.mockRejectedValueOnce(new Error("backend unavailable"));

    const closed = await executeTerminalPaneClose(workflow);

    expect(closed).toBe(false);
    expect(workflow.setError).toHaveBeenCalledWith("Error: backend unavailable");
    expect(workflow.updateProjectStatus).toHaveBeenCalledWith("attention");
    expect(workflow.updateSessionStatus).toHaveBeenCalledWith("attention");
    expect(calls).toContain("unmark");
  });
});
