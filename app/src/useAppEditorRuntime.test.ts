import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("app editor runtime", () => {
  it("owns editor lifecycle and menu assembly", () => {
    const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
    const runtime = readFileSync(new URL("./useAppEditorRuntime.ts", import.meta.url), "utf8");

    for (const marker of ["useAppEditorSurfaceRuntime(", "appEditorMenusFrom("]) {
      expect(app).not.toContain(marker);
      expect(runtime).toContain(marker);
    }
  });
});
