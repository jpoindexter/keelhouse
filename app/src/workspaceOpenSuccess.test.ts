import { describe, expect, it } from "vitest";
import { planWorkspaceOpenSuccess } from "./workspaceOpenSuccess";

describe("planWorkspaceOpenSuccess", () => {
  it("moves status from the previous project to the opened workspace session", () => {
    const planned = planWorkspaceOpenSuccess({
      activeSessions: { "/old": "old-session" },
      now: 100,
      openProjects: [{ path: "/old", status: "running" }],
      previousRoot: "/old",
      previousStatus: "attention",
      projectStatus: "running",
      recentProjects: ["/old"],
      root: "/new",
      sessionStatus: "running",
      sessions: {
        "/old": [{ id: "old-session", title: "Old", status: "running", updatedAt: 1 }],
      },
    });

    expect(planned.recentProjects).toEqual(["/new", "/old"]);
    expect(planned.openProjects).toEqual([
      { path: "/new", status: "running" },
      { path: "/old", status: "attention" },
    ]);
    expect(planned.sessionId).toBe("session-2s");
    expect(planned.activeSessions).toEqual({
      "/old": "old-session",
      "/new": "session-2s",
    });
    expect(planned.sessions["/old"][0]).toMatchObject({
      status: "attention",
      updatedAt: 100,
    });
    expect(planned.sessions["/new"][0]).toMatchObject({
      id: "session-2s",
      status: "running",
      updatedAt: 100,
    });
  });
});
