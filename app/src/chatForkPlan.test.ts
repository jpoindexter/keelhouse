import { describe, expect, it } from "vitest";
import { createChatForkPlan } from "./chatForkPlan";
import type { ChatConversation } from "./chatConversation";
import type { ProjectSession } from "./workspaceState";

const sourceConversation: ChatConversation = {
  messages: [
    { id: "m1", role: "user", text: "start", timestamp: 1 },
    { id: "m2", role: "assistant", text: "answer", timestamp: 2 },
    { id: "m3", role: "tool", text: "after", timestamp: 3 },
  ],
  provider: "codex",
  revision: 3,
  runStatus: "complete",
  updatedAt: 3,
};

const sourceSession: ProjectSession = {
  id: "session-source",
  status: "exited",
  title: "Chrome polish",
  updatedAt: 1,
};

describe("chat fork plan", () => {
  it("creates a child session and forked conversation at the selected message", () => {
    const plan = createChatForkPlan({
      checkpoint: { createdAt: 444, id: "checkpoint-1" },
      existingSessions: [sourceSession],
      messageId: "m2",
      now: 10,
      sourceChatId: "project\nsession-source",
      sourceConversation,
      sourceSessionId: "session-source",
    });

    expect(plan?.session).toMatchObject({
      checkpointCreatedAt: 444,
      checkpointId: "checkpoint-1",
      forkedAt: 10,
      parentMessageId: "m2",
      parentSessionId: "session-source",
      status: "exited",
      title: "Fork of Chrome polish",
    });
    expect(plan?.forkedConversation.messages.map((message) => message.id)).toEqual(["m1", "m2"]);
  });

  it("advances generated session ids until they do not collide", () => {
    const collidingSession = { ...sourceSession, id: `session-${(10).toString(36)}` };
    const plan = createChatForkPlan({
      checkpoint: null,
      existingSessions: [sourceSession, collidingSession],
      messageId: "m1",
      now: 10,
      sourceChatId: "project\nsession-source",
      sourceConversation,
      sourceSessionId: "session-source",
    });

    expect(plan?.session.id).toBe(`session-${(11).toString(36)}`);
    expect(plan?.session.checkpointId).toBeUndefined();
  });
});
