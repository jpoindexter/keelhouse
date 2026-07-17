import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("app terminal surface runtime", () => {
  it("owns terminal actions, active handle, tray controls, rename, and resize outside App", () => {
    const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
    const runtime = readFileSync(new URL("./appTerminalSurfaceRuntime.ts", import.meta.url), "utf8");

    for (const marker of [
      "createTerminalSurfaceActions<", "createActiveAgentSessionHandle({",
      "createUtilityTrayControls({", "createTerminalPaneRename({", "createTerminalResize({",
    ]) {
      expect(app).not.toContain(marker);
      expect(runtime).toContain(marker);
    }
  });
});
