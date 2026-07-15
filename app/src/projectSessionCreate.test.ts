import { describe, expect, it } from "vitest";
import { planProjectSessionCreate } from "./projectSessionCreate";

describe("planProjectSessionCreate", () => {
  it("creates an exited session and makes it active for the project", () => {
    const planned = planProjectSessionCreate({
      activeSessions: { "/repo": "one" },
      now: 100,
      projectPath: "/repo",
      sessions: {
        "/repo": [{ id: "one", title: "Current work", status: "running", updatedAt: 1 }],
      },
    });

    expect(planned.session).toMatchObject({
      id: "session-2s",
      status: "exited",
      title: "New chat 2",
      updatedAt: 100,
    });
    expect(planned.sessions["/repo"].map((session) => session.id)).toEqual(["session-2s", "one"]);
    expect(planned.activeSessions).toEqual({ "/repo": "session-2s" });
  });
});
