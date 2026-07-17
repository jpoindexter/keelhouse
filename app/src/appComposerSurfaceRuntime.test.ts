import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("app composer surface runtime", () => {
  it("owns composer actions, run controls, history, and settings outside App", () => {
    const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
    const runtime = readFileSync(new URL("./appComposerSurfaceRuntime.ts", import.meta.url), "utf8");

    for (const marker of [
      "createComposerSurface({", "createChatRunControls({",
      "createComposerHistoryNavigation({", "createComposerSettingsActions({",
    ]) {
      expect(app).not.toContain(marker);
      expect(runtime).toContain(marker);
    }
  });
});
