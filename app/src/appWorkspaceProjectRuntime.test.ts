import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("app workspace project runtime", () => {
  it("owns session restore, workspace opening, and project closing outside App", () => {
    const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
    const runtime = readFileSync(new URL("./appWorkspaceProjectRuntime.ts", import.meta.url), "utf8");

    for (const marker of [
      "createSessionSnapshotCapture({", "createSessionSnapshotRestore({",
      "createWorkspaceOpenSurface({", "createProjectCloseController(",
    ]) {
      expect(app).not.toContain(marker);
      expect(runtime).toContain(marker);
    }
  });
});
