import { describe, expect, it } from "vitest";
import { planWorkspaceOpenFailure } from "./workspaceOpenFailure";

describe("planWorkspaceOpenFailure", () => {
  it("marks the workspace and its active session as needing attention", () => {
    const planned = planWorkspaceOpenFailure({
      activeSessions: {},
      now: 100,
      openProjects: [],
      path: "/repo",
      sessions: {},
    });

    expect(planned.openProjects).toEqual([
      { path: "/repo", status: "attention" },
    ]);
    expect(planned.activeSessions).toEqual({
      "/repo": "session-2s",
    });
    expect(planned.sessions["/repo"][0]).toMatchObject({
      id: "session-2s",
      status: "attention",
      updatedAt: 100,
    });
  });
});
