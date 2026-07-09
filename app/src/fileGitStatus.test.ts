import { describe, expect, it } from "vitest";
import {
  absolutePathForGitFile,
  decorateFileTreeWithGitStatus,
  gitStatusForFile,
} from "./fileGitStatus";

describe("file git status helpers", () => {
  it("classifies short git status codes for file rail markers", () => {
    expect(gitStatusForFile({ path: "src/app.ts", index: " ", worktree: "M" })).toMatchObject({
      code: "modified",
      token: "M",
      label: "Modified",
    });
    expect(gitStatusForFile({ path: "src/new.ts", index: "?", worktree: "?" })).toMatchObject({
      code: "untracked",
      token: "U",
      label: "Untracked",
    });
    expect(gitStatusForFile({ path: "src/dead.ts", index: " ", worktree: "D" })).toMatchObject({
      code: "deleted",
      token: "D",
      label: "Deleted",
    });
    expect(gitStatusForFile({ path: "src/staged.ts", index: "M", worktree: " " })).toMatchObject({
      code: "staged",
      token: "S",
      label: "Staged",
    });
  });

  it("resolves git paths relative to the workspace root", () => {
    expect(absolutePathForGitFile("/repo/", "/src/app.ts")).toBe("/repo/src/app.ts");
  });

  it("decorates existing tree nodes and inserts deleted files", () => {
    const nodes = [
      {
        id: "/repo/src",
        name: "src",
        path: "/repo/src",
        kind: "directory" as const,
        children: [
          { id: "/repo/src/app.ts", name: "app.ts", path: "/repo/src/app.ts", kind: "file" as const },
        ],
      },
    ];

    expect(
      decorateFileTreeWithGitStatus("/repo", nodes, [
        { path: "src/app.ts", index: " ", worktree: "M" },
        { path: "src/deleted.ts", index: " ", worktree: "D" },
      ]),
    ).toEqual([
      {
        id: "/repo/src",
        name: "src",
        path: "/repo/src",
        kind: "directory",
        gitStatus: undefined,
        children: [
          {
            id: "/repo/src/app.ts",
            name: "app.ts",
            path: "/repo/src/app.ts",
            kind: "file",
            gitStatus: {
              code: "modified",
              token: "M",
              label: "Modified",
              relativePath: "src/app.ts",
              index: " ",
              worktree: "M",
            },
            children: undefined,
          },
          {
            id: "/repo/src/deleted.ts",
            name: "deleted.ts",
            path: "/repo/src/deleted.ts",
            kind: "file",
            gitStatus: {
              code: "deleted",
              token: "D",
              label: "Deleted",
              relativePath: "src/deleted.ts",
              index: " ",
              worktree: "D",
            },
          },
        ],
      },
    ]);
  });
});
