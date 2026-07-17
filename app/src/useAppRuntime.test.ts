import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("app runtime", () => {
  it("owns the remaining app composition outside the root component", () => {
    const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
    const runtime = readFileSync(new URL("./useAppRuntime.ts", import.meta.url), "utf8");

    for (const marker of [
      "useAppFoundationRuntime<", "useAppProjectRuntime(",
      "appInteractionSurfaceRuntimeFrom(", "useAppEditorRuntime(",
      "useAppTerminalRuntime(", "buildSettingsActions(",
    ]) {
      expect(app).not.toContain(marker);
      expect(runtime).toContain(marker);
    }
    expect(app).toContain("useAppRuntime()");
  });
});
