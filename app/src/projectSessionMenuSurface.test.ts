import { describe, expect, it } from "vitest";
import { emptyChatConversation, pushChatMessage } from "./chatConversationMutations";
import { deriveProjectSessionMenuState } from "./projectSessionMenuSurface";
import type { ProjectSession } from "./workspaceStateTypes";

const session = (id: string, extra: Partial<ProjectSession> = {}): ProjectSession => ({
  id, status: "running", title: `Chat ${id}`, updatedAt: 1, ...extra,
});

const answered = pushChatMessage(emptyChatConversation(1), {
  id: "m1", role: "assistant", text: "done", timestamp: 2,
});

describe("deriveProjectSessionMenuState", () => {
  it("derives counts, activity, and ownership flags for the menu", () => {
    const state = deriveProjectSessionMenuState({
      activeSessionId: "a",
      chatIdForSession: (root, id) => `${root}\n${id}`,
      conversations: { "/repo\na": { ...answered, activeRunId: "run-1" } },
      projectPath: "/repo",
      session: session("a"),
      sessions: [session("a"), session("b", { archived: true })],
      workspacePath: "/repo",
    });

    expect(state).toEqual({
      activeProjectSessionCount: 1,
      hasAssistantMessage: true,
      hasRunningChildRun: true,
      isActiveSession: true,
      isWorkspaceProject: true,
      projectSessionCount: 2,
    });
  });

  it("marks foreign projects and idle sessions correctly", () => {
    const state = deriveProjectSessionMenuState({
      activeSessionId: "z",
      chatIdForSession: (root, id) => `${root}\n${id}`,
      conversations: {},
      projectPath: "/other",
      session: session("a"),
      sessions: [session("a")],
      workspacePath: "/repo",
    });

    expect(state.hasAssistantMessage).toBe(false);
    expect(state.hasRunningChildRun).toBe(false);
    expect(state.isActiveSession).toBe(false);
    expect(state.isWorkspaceProject).toBe(false);
  });
});
