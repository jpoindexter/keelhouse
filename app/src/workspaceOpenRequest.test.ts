import { describe, expect, it, vi } from "vitest";
import { requestWorkspaceOpen } from "./workspaceOpenRequest";

describe("requestWorkspaceOpen", () => {
  it("opens a background dirty tab before deferring workspace navigation", async () => {
    const operations: string[] = [];
    const dirtyTab = { id: "/repo/a.ts", name: "a.ts", path: "/repo/a.ts", kind: "file" as const };
    const openWorkspace = vi.fn(async () => true);

    const opened = await requestWorkspaceOpen({
      confirmDiscard: vi.fn(async () => true),
      deferNavigation: () => { operations.push("defer"); },
      dirtyTabPaths: [dirtyTab.path],
      editorDirty: true,
      editorTabs: [dirtyTab],
      openEditorFile: async () => { operations.push("open-dirty-tab"); },
      openWorkspace,
      path: "/next",
      selectedFilePath: "/repo/b.ts",
    });

    expect(opened).toBe(false);
    expect(operations).toEqual(["open-dirty-tab", "defer"]);
    expect(openWorkspace).not.toHaveBeenCalled();
  });
});
