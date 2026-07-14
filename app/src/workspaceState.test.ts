import { describe, expect, it } from "vitest";
import {
  activeProjectSessionId,
  ensureProjectSessions,
  forgetActiveFile,
  isMissingWorkspaceError,
  normalizeActiveFileByWorkspace,
  normalizeActiveSessionByProject,
  normalizeOpenProjects,
  normalizeProjectSessionsByProject,
  normalizeRecentProjects,
  newProjectSession,
  openProjectsFromRecent,
  pushRecentProject,
  planProjectClose,
  removeProjectSession,
  removeOpenProject,
  rememberActiveFile,
  removeRecentProject,
  activeSessionsForRail,
  archivedSessionCount,
  sessionRecencyLabel,
  setActiveProjectSession,
  setProjectSessionArchived,
  setProjectSessionPinned,
  setOpenProjectStatus,
  setProjectSessionStatus,
  upsertProjectSession,
  upsertOpenProject,
} from "./workspaceState";

describe("workspace state helpers", () => {
  it("normalizes recent projects by removing invalid values and duplicates", () => {
    expect(normalizeRecentProjects(["/a", "", "/b", "/a", 42, null])).toEqual(["/a", "/b"]);
  });

  it("promotes opened projects and caps the recent list", () => {
    const projects = ["/a", "/b", "/c", "/d", "/e", "/f", "/g", "/h"];
    expect(pushRecentProject(projects, "/c")).toEqual(["/c", "/a", "/b", "/d", "/e", "/f", "/g", "/h"]);
    expect(pushRecentProject(projects, "/i")).toEqual(["/i", "/a", "/b", "/c", "/d", "/e", "/f", "/g"]);
  });

  it("removes missing projects without touching the rest of the list", () => {
    expect(removeRecentProject(["/a", "/b", "/c"], "/b")).toEqual(["/a", "/c"]);
  });

  it("only treats workspace path failures as pruneable", () => {
    expect(isMissingWorkspaceError("Workspace folder does not exist: /missing")).toBe(true);
    expect(isMissingWorkspaceError("Workspace path is not a folder: /tmp/file")).toBe(true);
    expect(isMissingWorkspaceError("Cannot find `claude` in the login-shell PATH.")).toBe(false);
  });

  it("normalizes active file metadata by workspace", () => {
    expect(normalizeActiveFileByWorkspace({ "/a": "/a/src/App.tsx", "/b": 42, "": "/bad" })).toEqual({
      "/a": "/a/src/App.tsx",
    });
  });

  it("remembers and forgets active files without touching other workspaces", () => {
    const remembered = rememberActiveFile({ "/a": "/a/old.ts" }, "/b", "/b/src/main.ts");
    expect(remembered).toEqual({ "/a": "/a/old.ts", "/b": "/b/src/main.ts" });
    expect(forgetActiveFile(remembered, "/a")).toEqual({ "/b": "/b/src/main.ts" });
  });

  it("normalizes open projects from current and legacy store shapes", () => {
    expect(normalizeOpenProjects([{ path: "/a", status: "running" }, "/b", { path: "/a", status: "attention" }, { path: "", status: "running" }, 7])).toEqual([
      { path: "/a", status: "running" },
      { path: "/b", status: "exited" },
    ]);
  });

  it("promotes and updates open project rail entries", () => {
    const open = openProjectsFromRecent(["/a", "/b"]);
    expect(open).toEqual([
      { path: "/a", status: "exited" },
      { path: "/b", status: "exited" },
    ]);
    expect(upsertOpenProject(open, "/b", "running")).toEqual([
      { path: "/b", status: "running" },
      { path: "/a", status: "exited" },
    ]);
    expect(setOpenProjectStatus(open, "/a", "attention")).toEqual([
      { path: "/a", status: "attention" },
      { path: "/b", status: "exited" },
    ]);
    expect(removeOpenProject(open, "/a")).toEqual([{ path: "/b", status: "exited" }]);
  });

  it("plans active and background project closes without losing the fallback", () => {
    const open = openProjectsFromRecent(["/a", "/b", "/c"]);
    expect(planProjectClose(open, "/a", "/a")).toEqual({
      remaining: [
        { path: "/b", status: "exited" },
        { path: "/c", status: "exited" },
      ],
      wasActive: true,
      fallbackPath: "/b",
    });
    expect(planProjectClose(open, "/a", "/b")).toEqual({
      remaining: [
        { path: "/a", status: "exited" },
        { path: "/c", status: "exited" },
      ],
      wasActive: false,
      fallbackPath: "/a",
    });
    expect(planProjectClose([{ path: "/a", status: "running" }], "/a", "/a").fallbackPath).toBeNull();
  });

  it("normalizes project sessions by project", () => {
    expect(
      normalizeProjectSessionsByProject({
        "/a": [
          { id: "one", title: "Build auth", status: "running", updatedAt: 10 },
          { id: "one", title: "Duplicate", status: "attention", updatedAt: 11 },
          { id: "two", title: "  Review diff  ", status: "unknown", updatedAt: Number.NaN },
          { id: "fork", title: "Fork", status: "exited", updatedAt: 12, parentSessionId: "one", parentMessageId: "message-1", forkedAt: 11, checkpointId: "checkpoint-1", checkpointCreatedAt: 10, recoveryCheckpointId: "checkpoint-2" },
          { id: "", title: "Bad", status: "running", updatedAt: 12 },
        ],
        "": [{ id: "bad", title: "Bad", status: "running", updatedAt: 1 }],
        "/empty": [],
      }),
    ).toEqual({
      "/a": [
        { id: "one", title: "Build auth", status: "running", updatedAt: 10 },
        { id: "two", title: "Review diff", status: "exited", updatedAt: 0 },
        { id: "fork", title: "Fork", status: "exited", updatedAt: 12, parentSessionId: "one", parentMessageId: "message-1", forkedAt: 11, checkpointId: "checkpoint-1", checkpointCreatedAt: 10, recoveryCheckpointId: "checkpoint-2" },
      ],
    });
  });

  it("normalizes active session ids by project", () => {
    expect(normalizeActiveSessionByProject({ "/a": "one", "/b": 7, "": "bad" })).toEqual({ "/a": "one" });
  });

  it("creates a default project session only when a project has none", () => {
    expect(ensureProjectSessions({}, "/a", 36)).toEqual({
      "/a": [{ id: "session-10", title: "Current work", status: "exited", updatedAt: 36 }],
    });
    expect(ensureProjectSessions({ "/a": [{ id: "one", title: "Existing", status: "running", updatedAt: 1 }] }, "/a", 36)).toEqual({
      "/a": [{ id: "one", title: "Existing", status: "running", updatedAt: 1 }],
    });
  });

  it("creates, promotes, and updates project sessions", () => {
    const existing = [{ id: "one", title: "Current work", status: "exited" as const, updatedAt: 1 }];
    const next = newProjectSession(existing, 72);
    expect(next).toEqual({ id: "session-20", title: "New chat 2", status: "running", updatedAt: 72 });
    const sessionsByProject = upsertProjectSession({ "/a": existing }, "/a", next);
    expect(sessionsByProject["/a"]).toEqual([next, existing[0]]);
    expect(setProjectSessionStatus(sessionsByProject, "/a", "one", "attention", 80)["/a"]).toEqual([
      next,
      { id: "one", title: "Current work", status: "attention", updatedAt: 80 },
    ]);
    expect(removeProjectSession(sessionsByProject, "/a", "one")["/a"]).toEqual([next]);
    expect(removeProjectSession({ "/a": [next] }, "/a", next.id)).toEqual({ "/a": [next] });
  });

  it("labels session recency in compact relative units", () => {
    const now = 10 * 604_800_000;
    expect(sessionRecencyLabel(now - 20_000, now)).toBe("now");
    expect(sessionRecencyLabel(now - 5 * 60_000, now)).toBe("5m");
    expect(sessionRecencyLabel(now - 4 * 3_600_000, now)).toBe("4h");
    expect(sessionRecencyLabel(now - 2 * 86_400_000, now)).toBe("2d");
    expect(sessionRecencyLabel(now - 3 * 604_800_000, now)).toBe("3w");
    expect(sessionRecencyLabel(0, now)).toBe("");
    expect(sessionRecencyLabel(Number.NaN, now)).toBe("");
  });

  it("archives sessions but protects the last active one and filters the rail", () => {
    const base = {
      "/a": [
        { id: "one", title: "Current work", status: "exited" as const, updatedAt: 1 },
        { id: "two", title: "Task", status: "running" as const, updatedAt: 2 },
      ],
    };
    const archived = setProjectSessionArchived(base, "/a", "two", true);
    expect(archived["/a"].find((s) => s.id === "two")?.archived).toBe(true);
    expect(archivedSessionCount(archived["/a"])).toBe(1);
    expect(activeSessionsForRail(archived["/a"], false).map((s) => s.id)).toEqual(["one"]);
    expect(activeSessionsForRail(archived["/a"], true).map((s) => s.id)).toEqual(["one", "two"]);

    // The last un-archived session cannot be archived.
    const blocked = setProjectSessionArchived(archived, "/a", "one", true);
    expect(blocked).toBe(archived);

    const restored = setProjectSessionArchived(archived, "/a", "two", false);
    expect(restored["/a"].find((s) => s.id === "two")?.archived).toBeUndefined();
  });

  it("pins chats to the top of their project without changing project grouping", () => {
    const base = {
      "/a": [
        { id: "one", title: "First", status: "exited" as const, updatedAt: 3 },
        { id: "two", title: "Second", status: "exited" as const, updatedAt: 2 },
        { id: "three", title: "Third", status: "exited" as const, updatedAt: 1 },
      ],
    };
    const pinned = setProjectSessionPinned(base, "/a", "three", true, 40);
    expect(activeSessionsForRail(pinned["/a"], false).map((session) => session.id)).toEqual(["three", "one", "two"]);
    expect(normalizeProjectSessionsByProject(pinned)["/a"][2].pinnedAt).toBe(40);
    const unpinned = setProjectSessionPinned(pinned, "/a", "three", false);
    expect(activeSessionsForRail(unpinned["/a"], false).map((session) => session.id)).toEqual(["one", "two", "three"]);
  });

  it("resolves active project sessions with fallback to the first row", () => {
    const sessionsByProject = { "/a": [{ id: "one", title: "Current work", status: "exited" as const, updatedAt: 1 }] };
    expect(activeProjectSessionId({ "/a": "missing" }, sessionsByProject, "/a")).toBe("one");
    expect(activeProjectSessionId({ "/a": "one" }, sessionsByProject, "/a")).toBe("one");
    expect(activeProjectSessionId({}, sessionsByProject, "/b")).toBeNull();
    expect(setActiveProjectSession({}, "/a", "one")).toEqual({ "/a": "one" });
  });
});
