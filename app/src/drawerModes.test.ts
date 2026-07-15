import { describe, expect, it } from "vitest";
import { DRAWER_MODES, drawerTitleFor } from "./drawerModes";

describe("drawer modes", () => {
  it("uses the project-chat product label and configured labels for other modes", () => {
    expect(drawerTitleFor("projects")).toBe("Project chats");
    expect(drawerTitleFor("files")).toBe("Files");
    expect(drawerTitleFor("browser")).toBe("Browser");
    expect(DRAWER_MODES.map((mode) => mode.id)).toEqual([
      "projects", "files", "git", "browser", "settings",
    ]);
  });
});
