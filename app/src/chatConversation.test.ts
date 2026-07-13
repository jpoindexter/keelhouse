import { describe, expect, it } from "vitest";
import {
  appendUserChatMessage,
  applyChatRunEnvelope,
  chatTitleFromPrompt,
  emptyChatConversation,
  normalizeChatConversationRecords,
  startChatRun,
} from "./chatConversation";

describe("chat conversations", () => {
  it("keeps user messages and provider thread ids independent from terminal panes", () => {
    const user = appendUserChatMessage(emptyChatConversation(1), "Inspect the repo", 2);
    const running = startChatRun(user, "run-1", 3);
    const threaded = applyChatRunEnvelope(running, {
      runId: "run-1",
      chatId: "/repo\nsession-1",
      provider: "codex",
      stream: "stdout",
      event: { type: "thread.started", thread_id: "thread-1" },
    }, 4);
    expect(threaded.providerThreadId).toBe("thread-1");
    expect(threaded.runStatus).toBe("running");
    expect(threaded.messages.map((message) => message.role)).toEqual(["user", "status"]);
  });

  it("renders structured assistant and command events as chat items", () => {
    const running = startChatRun(emptyChatConversation(1), "run-1", 2);
    const command = applyChatRunEnvelope(running, {
      runId: "run-1",
      chatId: "chat",
      provider: "codex",
      stream: "stdout",
      event: { type: "item.completed", item: { id: "cmd-1", type: "command_execution", command: "npm test", aggregated_output: "ok", status: "completed" } },
    }, 3);
    const assistant = applyChatRunEnvelope(command, {
      runId: "run-1",
      chatId: "chat",
      provider: "codex",
      stream: "stdout",
      event: { type: "item.completed", item: { id: "msg-1", type: "agent_message", text: "Tests pass." } },
    }, 4);
    const complete = applyChatRunEnvelope(assistant, {
      runId: "run-1",
      chatId: "chat",
      provider: "codex",
      stream: "stdout",
      event: { type: "turn.completed", usage: {} },
    }, 5);
    expect(complete.activeRunId).toBeUndefined();
    expect(complete.runStatus).toBe("complete");
    expect(complete.messages.map((message) => [message.role, message.text])).toEqual([
      ["status", "Completed"],
      ["tool", "npm test\n\nok"],
      ["assistant", "Tests pass."],
    ]);
  });

  it("normalizes stored chats and never restores a stale running state", () => {
    expect(normalizeChatConversationRecords({
      "/repo\nsession-1": {
        provider: "codex",
        providerThreadId: "thread-1",
        activeRunId: "stale",
        updatedAt: 4,
        revision: 1,
        runStatus: "interrupted",
        messages: [{ id: "user-1", role: "user", text: "Hello", timestamp: 3 }],
      },
      bad: null,
    })).toEqual({
      "/repo\nsession-1": {
        provider: "codex",
        providerThreadId: "thread-1",
        activeRunId: undefined,
        updatedAt: 4,
        revision: 2,
        runStatus: "interrupted",
        messages: [{ id: "user-1", role: "user", text: "Hello", timestamp: 3, itemId: undefined, title: undefined, status: undefined }],
      },
    });
  });

  it("keeps complete history and records provider usage", () => {
    const messages = Array.from({ length: 350 }, (_, index) => ({
      id: `message-${index}`,
      role: "assistant" as const,
      text: `Message ${index}`,
      timestamp: index + 1,
    }));
    const normalized = normalizeChatConversationRecords({
      "/repo\nsession-1": {
        provider: "codex",
        updatedAt: 400,
        revision: 4,
        runStatus: "complete",
        usage: { input_tokens: 10, cached_input_tokens: 3, output_tokens: 7 },
        messages,
      },
    });
    expect(normalized["/repo\nsession-1"].messages).toHaveLength(350);
    expect(normalized["/repo\nsession-1"].usage).toEqual({
      inputTokens: 10,
      cachedInputTokens: 3,
      outputTokens: 7,
    });
  });

  it("does not replace an older turn when the provider reuses an item id", () => {
    const previous = {
      ...emptyChatConversation(1),
      messages: [{
        id: "assistant-old",
        role: "assistant" as const,
        text: "First response",
        itemId: "run-1:item-0",
        timestamp: 2,
      }],
    };
    const next = applyChatRunEnvelope(previous, {
      runId: "run-2",
      chatId: "/repo\nsession-1",
      provider: "codex",
      stream: "stdout",
      event: { type: "item.completed", item: { id: "item-0", type: "agent_message", text: "Second response" } },
    }, 3);
    expect(next.messages.map((message) => message.text)).toEqual(["First response", "Second response"]);
    expect(next.messages[1].itemId).toBe("run-2:item-0");
  });

  it("derives compact chat titles from the first prompt", () => {
    expect(chatTitleFromPrompt("  Fix   the failing tests\nthen review git  ")).toBe("Fix the failing tests then review git");
    expect(chatTitleFromPrompt("abcdefghijklmnopqrstuvwxyz", 12)).toBe("abcdefghijk…");
  });
});
