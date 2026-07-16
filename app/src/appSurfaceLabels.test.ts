import { describe, expect, it } from "vitest";
import { deriveAppSurfaceLabels } from "./appSurfaceLabels";
import type { ProjectSession } from "./workspaceStateTypes";

const session = (id: string, title: string): ProjectSession => ({
  id, status: "running", title, updatedAt: 1,
});

describe("deriveAppSurfaceLabels", () => {
  it("reports a working primary surface while a run is active", () => {
    const labels = deriveAppSurfaceLabels({
      activeRunId: "run-1",
      activeSessionId: "a",
      sessions: [session("a", "Fix bug")],
      trayMode: "terminal",
      workspacePath: "/repo/keelhouse",
    });

    expect(labels).toEqual({
      activeSessionTitle: "Fix bug",
      activeWorkspaceName: "keelhouse",
      primarySurfaceLabel: "Codex",
      primarySurfaceState: "starting",
      primarySurfaceStatusLabel: "Working",
      utilityTrayStatusLabel: "Terminal",
    });
  });

  it("falls back to idle, placeholder names, and chat defaults", () => {
    const labels = deriveAppSurfaceLabels({
      activeRunId: undefined,
      activeSessionId: null,
      sessions: [],
      trayMode: "processes",
      workspacePath: null,
    });

    expect(labels).toMatchObject({
      activeSessionTitle: "No chat",
      activeWorkspaceName: "Open workspace",
      primarySurfaceState: "idle",
      primarySurfaceStatusLabel: "Ready",
      utilityTrayStatusLabel: "Processes",
    });
  });

  it("labels an unknown active session as a new chat", () => {
    const labels = deriveAppSurfaceLabels({
      activeRunId: undefined,
      activeSessionId: "missing",
      sessions: [session("a", "Fix bug")],
      trayMode: "terminal",
      workspacePath: "/repo",
    });

    expect(labels.activeSessionTitle).toBe("New chat");
  });
});
