import { describe, expect, it } from "vitest";
import { checkpointPreviewMessage } from "./workspaceCheckpoints";

describe("workspace checkpoint previews", () => {
  it("lists exact writes and deletes and explains recovery", () => {
    const message = checkpointPreviewMessage({
      checkpoint: {
        id: "checkpoint-1",
        label: "Fork state",
        createdAt: 1,
        baseCommit: "abc",
        fileCount: 2,
      },
      files: [
        { path: "src/App.tsx", action: "write" },
        { path: "old.txt", action: "delete" },
      ],
      previewToken: "token",
    });

    expect(message).toContain("Write src/App.tsx");
    expect(message).toContain("Delete old.txt");
    expect(message).toContain("recovery checkpoint");
    expect(message).toContain("Staged files remain staged");
  });
});
