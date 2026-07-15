import { describe, expect, it } from "vitest";
import { planCheckpointRestore } from "./checkpointRestorePlan";
import type { WorkspaceCheckpointPreview } from "./workspaceCheckpoints";

const preview: WorkspaceCheckpointPreview = {
  checkpoint: {
    baseCommit: "abc",
    createdAt: 1,
    fileCount: 2,
    id: "checkpoint-1",
    label: "checkpoint",
  },
  files: [
    { action: "write", path: "README.md" },
    { action: "delete", path: "src/old.ts" },
  ],
  previewToken: "token",
};

describe("checkpoint restore plan", () => {
  it("tracks affected paths, relative dirty paths, and active file action", () => {
    const plan = planCheckpointRestore({
      dirtyTabPaths: ["/repo/README.md", "/repo/notes.md"],
      preview,
      projectPath: "/repo",
      selectedFilePath: "/repo/src/old.ts",
    });

    expect(Array.from(plan.affectedAbsolutePaths)).toEqual(["/repo/README.md", "/repo/src/old.ts"]);
    expect(plan.activeFileAction).toBe("delete");
    expect(plan.protectedDirtyPath).toBe("/repo/README.md");
    expect(plan.relativeDirtyPaths).toEqual(["README.md", "notes.md"]);
  });

  it("returns no active file action when the selected file is unaffected", () => {
    const plan = planCheckpointRestore({
      dirtyTabPaths: [],
      preview,
      projectPath: "/repo",
      selectedFilePath: "/repo/src/current.ts",
    });

    expect(plan.activeFileAction).toBeNull();
    expect(plan.protectedDirtyPath).toBeNull();
  });
});
