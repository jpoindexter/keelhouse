import { describe, expect, it, vi } from "vitest";
import { executeWorkspaceOpenFailure } from "./workspaceOpenFailureWorkflow";

const state = {
  activePanes: { "/missing\nchat": 1 },
  activeSessions: { "/missing": "chat" },
  browserProjects: { "/missing": "http://localhost:3000" },
  browserSessions: { "/missing\nchat": "http://localhost:3000" },
  conversations: { "/missing\nchat": { id: "conversation" } },
  editorSnapshots: { "/missing\nchat": { id: "editor" } },
  harnessRecords: { "/missing\nchat": { id: "harness" } },
  openProjects: [{ path: "/missing", status: "attention" as const }],
  paneLayouts: { "/missing\nchat": { id: "layout" } },
  projectPanes: { "/missing\nchat": [1] },
  recentProjects: ["/missing"],
  sessions: { "/missing": [{ id: "chat", title: "Chat", status: "attention" as const, updatedAt: 1 }] },
};

describe("executeWorkspaceOpenFailure", () => {
  it("applies and persists missing-workspace cleanup", async () => {
    const applyMissingCleanup = vi.fn();
    const persistMissingCleanup = vi.fn().mockResolvedValue(undefined);
    const applyFailure = vi.fn();

    const result = await executeWorkspaceOpenFailure({
      applyFailure,
      applyMissingCleanup,
      message: "Workspace folder does not exist: /missing",
      now: 10,
      path: "/missing",
      persistFailure: vi.fn(),
      persistMissingCleanup,
      state,
    });

    expect(result).toBe("missing");
    expect(applyFailure).not.toHaveBeenCalled();
    expect(applyMissingCleanup).toHaveBeenCalledWith(expect.objectContaining({
      activeSessions: {},
      openProjects: [],
      recentProjects: [],
      sessions: {},
    }));
    expect(persistMissingCleanup).toHaveBeenCalledWith(applyMissingCleanup.mock.calls[0][0]);
  });

  it("applies and persists an attention state for other failures", async () => {
    const applyFailure = vi.fn();
    const persistFailure = vi.fn().mockResolvedValue(undefined);
    const applyMissingCleanup = vi.fn();

    const result = await executeWorkspaceOpenFailure({
      applyFailure,
      applyMissingCleanup,
      message: "Cannot launch terminal profile",
      now: 20,
      path: "/repo",
      persistFailure,
      persistMissingCleanup: vi.fn(),
      state: { ...state, activeSessions: {}, openProjects: [], sessions: {} },
    });

    expect(result).toBe("failed");
    expect(applyMissingCleanup).not.toHaveBeenCalled();
    expect(applyFailure).toHaveBeenCalledWith(expect.objectContaining({
      openProjects: [{ path: "/repo", status: "attention" }],
    }));
    expect(persistFailure).toHaveBeenCalledWith(applyFailure.mock.calls[0][0]);
  });
});
