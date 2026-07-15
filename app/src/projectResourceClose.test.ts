import { describe, expect, it, vi } from "vitest";
import { closeProjectResources } from "./projectResourceClose";
import type { ManagedTerminalPane } from "./managedTerminalPane";

const pane: ManagedTerminalPane = {
  createdAt: 1,
  cwd: "/repo",
  exitCode: null,
  id: 7,
  label: null,
  profile: { id: "shell", label: "Shell", command: "/bin/zsh", args: [], useLoginShell: false },
  slot: 0,
  state: "running",
};

describe("closeProjectResources", () => {
  it("stops runs and panes before removing project-owned records", async () => {
    const closePane = vi.fn(async () => undefined);
    const stopChatRun = vi.fn(async () => undefined);
    const intentionallyTerminatedPaneIds = new Set<number>();
    const snapshots: Record<number, unknown> = { 7: { rows: 1 } };

    const closed = await closeProjectResources({
      activePanes: { "/repo\nsession": 7, "/kept\nsession": 8 },
      closePane,
      conversations: {
        "/repo\nsession": { activeRunId: "run-1" },
        "/kept\nsession": { activeRunId: "run-2" },
      },
      intentionallyTerminatedPaneIds,
      panes: [pane],
      projectPanes: { "/repo\nsession": [pane], "/kept\nsession": [] },
      projectPath: "/repo",
      snapshots,
      stopChatRun,
    });

    expect(stopChatRun).toHaveBeenCalledWith("run-1");
    expect(closePane).toHaveBeenCalledWith(7);
    expect(intentionallyTerminatedPaneIds).toContain(7);
    expect(snapshots[7]).toBeUndefined();
    expect(Object.keys(closed.projectPanes)).toEqual(["/kept\nsession"]);
    expect(Object.keys(closed.activePanes)).toEqual(["/kept\nsession"]);
  });
});
