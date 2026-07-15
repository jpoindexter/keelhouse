import { describe, expect, it, vi } from "vitest";
import { persistMissingWorkspaceCleanup } from "./workspaceOpenRecoveryPersistence";

describe("persistMissingWorkspaceCleanup", () => {
  it("persists cleanup records around durable chat deletion in order", async () => {
    const operations: string[] = [];
    const store = {
      delete: vi.fn(async (key: string) => { operations.push(`delete:${key}`); }),
      save: vi.fn(async () => { operations.push("save"); }),
      set: vi.fn(async (key: string) => { operations.push(`set:${key}`); }),
    };

    await persistMissingWorkspaceCleanup({
      beforeDeleteFolder: () => { operations.push("clear-active"); },
      cleanup: {
        activeSessions: {}, browserProjects: {}, browserSessions: {},
        editorSnapshots: {}, harnessRecords: {}, openProjects: [],
        paneLayouts: {}, recentProjects: [], sessions: {},
      },
      deleteProjectChats: async () => { operations.push("delete-chats"); },
      onDeleteError: vi.fn(),
      path: "/missing",
      store,
    });

    expect(operations).toEqual([
      "set:recentFolders", "set:openProjects", "set:projectSessions",
      "set:activeSessionByProject", "set:browserPreviewByProject",
      "set:browserPreviewBySession", "set:composerHarnessBySession",
      "delete-chats", "set:sessionEditorSnapshots",
      "set:paneLayoutsBySession", "clear-active", "delete:folder", "save",
    ]);
  });
});
