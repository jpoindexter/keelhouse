import { describe, expect, it, vi } from "vitest";
import { emptyChatConversation } from "./chatConversation";
import { createOrchestrationChildActions } from "./orchestrationChildActions";
import type { ProjectSession } from "./workspaceState";

const ref = <T,>(current: T) => ({ current });
const childSession = (): ProjectSession => ({
  id: "child", status: "running", title: "Research", updatedAt: 1,
  orchestration: {
    approvalMode: "ask", budgetSeconds: 300, count: 1, dispatchId: "dispatch",
    index: 0, parentSessionId: "parent", provider: "codex", task: "Research",
    targets: [], worktreeBranch: "agent/research", worktreeMode: "isolated",
    worktreePath: "/tmp/research",
  },
});

const createOptions = () => {
  const childChat = {
    ...emptyChatConversation(1), activeRunId: "run-1",
    messages: [{ id: "answer", role: "assistant" as const, text: "Result", timestamp: 2 }],
  };
  return {
    conversations: ref({ "/repo\nchild": childChat, "/repo\nparent": emptyChatConversation(1) }),
    now: vi.fn(() => 10),
    removeWorktree: vi.fn(async () => {}),
    setNotice: vi.fn(),
    stopRun: vi.fn(async () => {}),
    updateConversation: vi.fn(),
    updateSessionMetadata: vi.fn(async () => {}),
  };
};

describe("createOrchestrationChildActions", () => {
  it("stops the child's active run and reports its title", async () => {
    const options = createOptions();
    const actions = createOrchestrationChildActions(options);

    await actions.stopChildRun("/repo", childSession());

    expect(options.stopRun).toHaveBeenCalledWith("run-1");
    expect(options.setNotice).toHaveBeenCalledWith("Stopping Research");
  });

  it("returns the latest assistant result to the parent chat", async () => {
    const options = createOptions();
    const actions = createOrchestrationChildActions(options);

    const returned = await actions.returnChildResult("/repo", childSession());

    expect(returned).toBe(true);
    expect(options.updateConversation).toHaveBeenCalledWith("/repo\nparent", expect.any(Function));
    expect(options.updateSessionMetadata).toHaveBeenCalledWith(
      "/repo", "child", expect.objectContaining({ returnedAt: 10 }),
    );
  });

  it("removes an isolated worktree and clears its persisted metadata", async () => {
    const options = createOptions();
    const actions = createOrchestrationChildActions(options);

    await actions.removeChildWorktree("/repo", childSession());

    expect(options.removeWorktree).toHaveBeenCalledWith({
      branch: "agent/research", root: "/repo", worktreePath: "/tmp/research",
    });
    expect(options.updateSessionMetadata).toHaveBeenCalledWith(
      "/repo", "child", expect.objectContaining({
        worktreeBranch: undefined, worktreePath: undefined,
      }),
    );
    expect(options.setNotice).toHaveBeenCalledWith("Removed Research worktree");
  });
});
