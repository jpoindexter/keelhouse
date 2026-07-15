import { describe, expect, it } from "vitest";
import { planPaneExit } from "./paneExitPlan";

const pane = (state: "running" | "exited" = "exited") => ({
  id: 7,
  profile: { id: "shell", label: "Shell", command: "zsh", args: [], kind: "shell" as const, useLoginShell: true },
  cwd: "/project",
  slot: 0,
  label: "Build",
  state,
  exitCode: state === "exited" ? 1 : null,
  createdAt: 1,
});

describe("planPaneExit", () => {
  it("attributes a failed background exit to its owning project chat", () => {
    expect(planPaneExit({
      paneId: 7,
      command: "npm test",
      code: 1,
      message: "failed",
      intentionallyTerminated: false,
      contextRoot: "/project",
      contextSessionId: "chat-a",
      workspaceRoot: "/other",
      activePaneId: null,
      activeSessionId: "chat-b",
      panes: [pane()],
    })).toMatchObject({
      root: "/project",
      sessionId: "chat-a",
      status: "exited",
      activity: { label: "Command failed", status: "error" },
      backgroundExit: { paneId: "7", projectPath: "/project", label: "Build", failed: true },
      showLaunchError: false,
    });
  });

  it("does not raise background attention for an intentional termination", () => {
    const plan = planPaneExit({
      paneId: 7,
      command: "zsh",
      code: 0,
      message: "stopped",
      intentionallyTerminated: true,
      contextRoot: "/project",
      contextSessionId: "chat-a",
      workspaceRoot: "/project",
      activePaneId: 7,
      activeSessionId: "chat-a",
      panes: [pane()],
    });
    expect(plan.activity).toMatchObject({ label: "Process terminated", status: "exited" });
    expect(plan.backgroundExit).toBeNull();
    expect(plan.showLaunchError).toBe(false);
  });
});
