import { describe, expect, it } from "vitest";
import { emptyChatConversation } from "./chatConversationMutations";
import { deriveOrchestrationDialogState } from "./orchestrationDialogState";
import type { ProjectSession } from "./workspaceStateTypes";

const session = (id: string, title: string): ProjectSession => ({
  id, status: "running", title, updatedAt: 1,
});

describe("deriveOrchestrationDialogState", () => {
  it("counts active runs across every conversation and names the parent chat", () => {
    const state = deriveOrchestrationDialogState({
      activeSessionId: "b",
      conversations: {
        "/repo\na": { ...emptyChatConversation(1), activeRunId: "r1" },
        "/repo\nb": emptyChatConversation(1),
        "/other\nc": { ...emptyChatConversation(1), activeRunId: "r2" },
      },
      sessions: { "/repo": [session("a", "First"), session("b", "Second")] },
      workspacePath: "/repo",
    });

    expect(state).toEqual({ activeRunCount: 2, parentTitle: "Second" });
  });

  it("falls back to the default title without a matching session", () => {
    const state = deriveOrchestrationDialogState({
      activeSessionId: "missing",
      conversations: {},
      sessions: {},
      workspacePath: null,
    });

    expect(state).toEqual({ activeRunCount: 0, parentTitle: "Current chat" });
  });
});
