import { describe, expect, it, vi } from "vitest";
import { executeProjectSessionDelete } from "./projectSessionDelete";

const createWorkflow = (overrides: Partial<Parameters<typeof executeProjectSessionDelete>[0]> = {}) => {
  const calls: string[] = [];
  return {
    calls,
    workflow: {
      closeTerminalPanes: vi.fn(async () => { calls.push("close"); }),
      confirmDelete: vi.fn(async () => { calls.push("confirm"); return true; }),
      deleteHistory: vi.fn(async () => { calls.push("history"); }),
      plan: {
        browserSessionKey: "/repo\ntwo",
        canDelete: true as const,
        chatSessionKey: "/repo\ntwo",
        contextKey: "/repo\ntwo",
        nextActiveSessions: { "/repo": "one" },
        nextSessions: { "/repo": [{ id: "one", status: "exited" as const, title: "One", updatedAt: 1 }] },
        shouldReopenActiveWorkspace: true,
      },
      persistSessions: vi.fn(async () => { calls.push("persist"); }),
      removePersistedRestore: vi.fn(() => { calls.push("restore"); }),
      removeScopedRecords: vi.fn(async () => { calls.push("records"); }),
      reopenActiveWorkspace: vi.fn(async () => { calls.push("reopen"); }),
      title: "Two",
      ...overrides,
    },
  };
};

describe("executeProjectSessionDelete", () => {
  it("deletes session resources in order and reopens the active workspace", async () => {
    const { calls, workflow } = createWorkflow();

    const result = await executeProjectSessionDelete(workflow);

    expect(workflow.confirmDelete).toHaveBeenCalledWith(
      "Delete chat \"Two\"? Its messages and saved workspace context will be removed.",
    );
    expect(calls).toEqual(["confirm", "close", "history", "restore", "records", "persist", "reopen"]);
    expect(workflow.persistSessions).toHaveBeenCalledWith(
      workflow.plan.nextSessions,
      workflow.plan.nextActiveSessions,
    );
    expect(result).toEqual({ status: "deleted" });
  });

  it("stops before history deletion when pane shutdown fails", async () => {
    const { workflow } = createWorkflow({
      closeTerminalPanes: vi.fn(async () => { throw new Error("pane busy"); }),
    });

    const result = await executeProjectSessionDelete(workflow);

    expect(result).toEqual({
      message: "Could not close this chat's terminal panes: Error: pane busy",
      status: "failed",
    });
    expect(workflow.deleteHistory).not.toHaveBeenCalled();
    expect(workflow.persistSessions).not.toHaveBeenCalled();
  });

  it("stops before record removal when durable history deletion fails", async () => {
    const { workflow } = createWorkflow({
      deleteHistory: vi.fn(async () => { throw new Error("history locked"); }),
    });

    const result = await executeProjectSessionDelete(workflow);

    expect(result).toEqual({
      message: "Could not delete this chat's history: Error: history locked",
      status: "failed",
    });
    expect(workflow.removeScopedRecords).not.toHaveBeenCalled();
    expect(workflow.persistSessions).not.toHaveBeenCalled();
  });
});
