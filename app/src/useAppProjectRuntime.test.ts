import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("app project runtime", () => {
  it("owns conversation, workspace-open, and project-session assembly", () => {
    const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
    const runtime = readFileSync(new URL("./useAppProjectRuntime.ts", import.meta.url), "utf8");

    for (const marker of [
      "useAppConversationBridge(",
      "appWorkspaceProjectRuntimeFrom(",
      "appProjectSessionRuntimeFrom(",
    ]) {
      expect(app).not.toContain(marker);
      expect(runtime).toContain(marker);
    }
  });
});
