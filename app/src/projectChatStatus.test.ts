import { describe, expect, it } from "vitest";
import { emptyChatConversation, pushChatMessage } from "./chatConversationMutations";
import {
  projectRailStatusFromConversations,
  projectSessionStatusFromConversations,
} from "./projectChatStatus";

const errored = pushChatMessage(emptyChatConversation(1), {
  id: "m1", role: "error", text: "boom", timestamp: 2,
});
const running = { ...emptyChatConversation(1), activeRunId: "run-1" };

describe("projectRailStatusFromConversations", () => {
  it("reports running while any project chat has an active run", () => {
    expect(projectRailStatusFromConversations({
      "/repo\na": emptyChatConversation(1),
      "/repo\nb": running,
    }, "/repo")).toBe("running");
  });

  it("flags attention when the latest message of a chat errored", () => {
    expect(projectRailStatusFromConversations({ "/repo\na": errored }, "/repo")).toBe("attention");
  });

  it("ignores other projects and reports exited otherwise", () => {
    expect(projectRailStatusFromConversations({ "/other\na": running }, "/repo")).toBe("exited");
  });
});

describe("projectSessionStatusFromConversations", () => {
  it("derives the status from exactly that session's conversation", () => {
    const conversations = { "/repo\na": running, "/repo\nb": errored };

    expect(projectSessionStatusFromConversations(conversations, "/repo", "a")).toBe("running");
    expect(projectSessionStatusFromConversations(conversations, "/repo", "b")).toBe("attention");
    expect(projectSessionStatusFromConversations(conversations, "/repo", "c")).toBe("exited");
  });
});
