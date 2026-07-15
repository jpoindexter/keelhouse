import { describe, expect, it } from "vitest";
import {
  applyWorkspaceCleanupRecord,
  planMissingWorkspaceCleanup,
} from "./workspaceOpenRecovery";

describe("missing workspace cleanup", () => {
  it("removes only the missing project and its session records", () => {
    const plan = planMissingWorkspaceCleanup({
      path: "/missing",
      recentProjects: ["/missing", "/kept"],
      openProjects: [{ path: "/missing", status: "attention" }, { path: "/kept", status: "running" }],
      sessions: { "/missing": [], "/kept": [] },
      activeSessions: { "/missing": "one", "/kept": "two" },
      projectPanes: { "/missing\none": [1], "/kept\ntwo": [2] },
      activePanes: { "/missing\none": 1, "/kept\ntwo": 2 },
      browserProjects: { "/missing": "http://one", "/kept": "http://two" },
      browserSessions: { "/missing\none": "http://one", "/kept\ntwo": "http://two" },
      harnessRecords: { "/missing\none": { value: 1 }, "/kept\ntwo": { value: 2 } },
      conversations: { "/missing\none": { value: 1 }, "/kept\ntwo": { value: 2 } },
      editorSnapshots: { "/missing\none": { value: 1 }, "/kept\ntwo": { value: 2 } },
      paneLayouts: { "/missing\none": { value: 1 }, "/kept\ntwo": { value: 2 } },
    });

    expect(plan.recentProjects).toEqual(["/kept"]);
    expect(plan.openProjects).toEqual([{ path: "/kept", status: "running" }]);
    expect(Object.keys(plan.sessions)).toEqual(["/kept"]);
    expect(Object.keys(plan.projectPanes)).toEqual(["/kept\ntwo"]);
    expect(Object.keys(plan.conversations)).toEqual(["/kept\ntwo"]);
  });
});

describe("applyWorkspaceCleanupRecord", () => {
  it("keeps the authoritative ref and published state in sync", () => {
    const target = { current: ["/missing"] };
    let published: string[] = [];

    applyWorkspaceCleanupRecord(target, ["/kept"], (value) => {
      published = value;
    });

    expect(target.current).toEqual(["/kept"]);
    expect(published).toEqual(["/kept"]);
  });
});
