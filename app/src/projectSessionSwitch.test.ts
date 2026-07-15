import { describe, expect, it } from "vitest";
import { planProjectSessionSwitch } from "./projectSessionSwitch";

describe("planProjectSessionSwitch", () => {
  it("records the previous status and activates the target session in the current project", () => {
    const planned = planProjectSessionSwitch({
      activeSessions: { "/repo": "one" },
      currentRoot: "/repo",
      now: 100,
      previousStatus: "attention",
      projectPath: "/repo",
      sessionId: "two",
      sessions: {
        "/repo": [
          { id: "one", title: "One", status: "running", updatedAt: 1 },
          { id: "two", title: "Two", status: "exited", updatedAt: 2 },
        ],
      },
      targetStatus: "running",
    });

    expect(planned.sameProject).toBe(true);
    expect(planned.activeSessions).toEqual({ "/repo": "two" });
    expect(planned.sessions["/repo"]).toMatchObject([
      { id: "one", status: "attention", updatedAt: 100 },
      { id: "two", status: "running", updatedAt: 100 },
    ]);
  });
});
