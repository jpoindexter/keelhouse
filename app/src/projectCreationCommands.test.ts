import { invoke } from "@tauri-apps/api/core";
import { describe, expect, it, vi } from "vitest";

import { projectCreationCommands } from "./projectCreationCommands";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (command: string) => command === "create_local_project"
    ? { path: "/projects/Keel Demo" }
    : undefined),
}));

describe("projectCreationCommands", () => {
  it("maps project creation and Git initialization to typed Tauri commands", async () => {
    expect(await projectCreationCommands.create("/projects", "Keel Demo"))
      .toEqual({ path: "/projects/Keel Demo" });
    expect(invoke).toHaveBeenCalledWith("create_local_project", {
      parent: "/projects", name: "Keel Demo",
    });

    await projectCreationCommands.initializeGit("/projects/Keel Demo");
    expect(invoke).toHaveBeenCalledWith("initialize_project_git", {
      path: "/projects/Keel Demo",
    });
  });
});
