import { describe, expect, it } from "vitest";

import {
  addWorktree,
  normalizeWorktrees,
  removeWorktreeByPaneId,
  worktreeForPaneId,
  worktreesForProject,
  type WorktreeRecord,
} from "./worktrees";

const record = (paneId: string, projectRoot = "/a"): WorktreeRecord => ({
  paneId,
  projectRoot,
  path: `${projectRoot}/.worktrees/fix`,
  branch: "worktree/fix",
  label: "Fix API flow",
  createdAt: 1000,
});

describe("worktree records", () => {
  it("adds, dedupes by pane, and removes by pane id", () => {
    let list = addWorktree([], record("p1"));
    list = addWorktree(list, record("p2"));
    list = addWorktree(list, { ...record("p1"), label: "renamed" });
    expect(list).toHaveLength(2);
    expect(list.find((w) => w.paneId === "p1")?.label).toBe("renamed");

    const cleared = removeWorktreeByPaneId(list, "p1");
    expect(cleared.map((w) => w.paneId)).toEqual(["p2"]);
  });

  it("looks up by pane id and filters by project", () => {
    const list = [record("p1", "/a"), record("p2", "/b")];
    expect(worktreeForPaneId(list, "p1")?.projectRoot).toBe("/a");
    expect(worktreeForPaneId(list, null)).toBeNull();
    expect(worktreeForPaneId(list, "missing")).toBeNull();
    expect(worktreesForProject(list, "/b")).toHaveLength(1);
  });

  it("normalizes stored records and drops malformed rows", () => {
    expect(normalizeWorktrees([record("p1"), { paneId: "bad" }, "nope"])).toHaveLength(1);
    expect(normalizeWorktrees(null)).toEqual([]);
  });
});
