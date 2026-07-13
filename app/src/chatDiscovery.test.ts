import { describe, expect, it } from "vitest";
import { mergeChatDiscoveryResults } from "./chatDiscovery";

describe("chat discovery", () => {
  const sessions = {
    "/work/alpha": [
      { id: "one", title: "Fix login race", status: "exited" as const, updatedAt: 20, pinnedAt: 18 },
      { id: "two", title: "Archived audit", status: "exited" as const, updatedAt: 10, archived: true },
    ],
  };
  const conversations = {
    "/work/alpha\none": {
      provider: "codex" as const,
      messages: [{ id: "u1", role: "user" as const, text: "Inspect authentication", timestamp: 5 }],
      updatedAt: 20,
      revision: 1,
      runStatus: "complete" as const,
    },
  };

  it("merges SQLite message hits with project and chat metadata", () => {
    const results = mergeChatDiscoveryResults([
      {
        chatId: "/work/alpha\none",
        projectPath: "/work/alpha",
        sessionId: "one",
        messageId: "a1",
        role: "assistant",
        snippet: "The authentication race is in refresh.ts",
        timestamp: 30,
        bookmarked: true,
      },
    ], sessions, conversations, "authentication");
    expect(results[0]).toMatchObject({ projectName: "alpha", title: "Fix login race", pinned: true, bookmarked: true });
  });

  it("adds title-only matches and preserves archive state", () => {
    const [result] = mergeChatDiscoveryResults([], sessions, conversations, "archived", false);
    expect(result).toMatchObject({ chatId: "/work/alpha\ntwo", role: "title", title: "Archived audit", archived: true });
  });

  it("does not mix title matches into the bookmark view", () => {
    expect(mergeChatDiscoveryResults([], sessions, conversations, "archived", true)).toEqual([]);
  });
});
