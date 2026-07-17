import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("editor workspace runtime", () => {
  it("owns selected-file restoration and tree watching outside App", () => {
    const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
    const runtime = readFileSync(new URL("./useEditorWorkspaceRuntime.ts", import.meta.url), "utf8");

    expect(app).not.toContain("reconcileActiveFileNode(");
    expect(app).not.toContain("useWorkspaceTreeWatcher({");
    expect(runtime).toContain("reconcileActiveFileNode(");
    expect(runtime).toContain("useWorkspaceTreeWatcher({");
    expect(runtime).toContain("restoredActiveFileWorkspaceRef");
  });
});
