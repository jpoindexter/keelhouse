import { describe, expect, it } from "vitest";
import {
  appendUserChatMessage,
  applyChatRunEnvelope,
  chatTitleFromPrompt,
  emptyChatConversation,
  forkChatConversation,
  normalizeChatConversationRecords,
  startChatRun,
} from "./chatConversation";
import type { ChatConversation } from "./chatConversation";

describe("chat conversations", () => {
  it("forks history through the selected message with independent provider state", () => {
    const source: ChatConversation = {
      provider: "codex",
      providerThreadId: "provider-thread-1",
      messages: [
        { id: "user-1", role: "user", text: "First", timestamp: 1 },
        { id: "assistant-1", role: "assistant", text: "Answer", timestamp: 2 },
        { id: "user-2", role: "user", text: "Second", timestamp: 3 },
      ],
      updatedAt: 3,
      revision: 7,
      runStatus: "complete",
      usage: { inputTokens: 9, cachedInputTokens: 2, outputTokens: 4 },
    };

    expect(forkChatConversation(source, "/repo\nsource", "assistant-1", 20)).toEqual({
      provider: "codex",
      messages: source.messages.slice(0, 2),
      updatedAt: 20,
      revision: 0,
      runStatus: "idle",
      fork: {
        parentChatId: "/repo\nsource",
        parentMessageId: "assistant-1",
        forkedAt: 20,
      },
    });
  });

  it("rejects fork targets that are missing, non-conversational, or still running", () => {
    const running = startChatRun(emptyChatConversation(1), "run-1", 2);
    expect(forkChatConversation(running, "source", running.messages[0].id, 3)).toBeNull();
    const complete = { ...running, activeRunId: undefined, runStatus: "complete" as const };
    expect(forkChatConversation(complete, "source", running.messages[0].id, 3)).toBeNull();
    expect(forkChatConversation(complete, "source", "missing", 3)).toBeNull();
  });

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

  it("renders provider-native deltas progressively and completes the same message", () => {
    const running = startChatRun(emptyChatConversation(1), "run-1", 2);
    const first = applyChatRunEnvelope(running, {
      runId: "run-1",
      chatId: "chat",
      provider: "codex",
      stream: "stdout",
      event: {
        method: "item/agentMessage/delta",
        params: { itemId: "message-1", delta: "Hello" },
      },
    }, 3);
    const second = applyChatRunEnvelope(first, {
      runId: "run-1",
      chatId: "chat",
      provider: "codex",
      stream: "stdout",
      event: {
        method: "item/agentMessage/delta",
        params: { itemId: "message-1", delta: " world" },
      },
    }, 4);
    const completed = applyChatRunEnvelope(second, {
      runId: "run-1",
      chatId: "chat",
      provider: "codex",
      stream: "stdout",
      event: {
        method: "item/completed",
        params: { item: { id: "message-1", type: "agentMessage", text: "Hello world" } },
      },
    }, 5);
    expect(first.messages[first.messages.length - 1]).toMatchObject({ text: "Hello", status: "running" });
    expect(second.messages[second.messages.length - 1]).toMatchObject({ text: "Hello world", status: "running" });
    expect(completed.messages[completed.messages.length - 1]).toMatchObject({ text: "Hello world", status: "complete" });
    expect(completed.messages.filter((message) => message.role === "assistant")).toHaveLength(1);
  });

  it("normalizes app-server tools, usage, and completed turns", () => {
    const running = startChatRun(emptyChatConversation(1), "run-1", 2);
    const tool = applyChatRunEnvelope(running, {
      runId: "run-1",
      chatId: "chat",
      provider: "codex",
      stream: "stdout",
      event: {
        method: "item/completed",
        params: {
          item: {
            id: "command-1",
            type: "commandExecution",
            command: "npm test",
            aggregatedOutput: "passed",
            status: "completed",
          },
        },
      },
    }, 3);
    const used = applyChatRunEnvelope(tool, {
      runId: "run-1",
      chatId: "chat",
      provider: "codex",
      stream: "stdout",
      event: {
        method: "thread/tokenUsage/updated",
        params: {
          tokenUsage: { total: { inputTokens: 12, cachedInputTokens: 4, outputTokens: 6 } },
        },
      },
    }, 4);
    const completed = applyChatRunEnvelope(used, {
      runId: "run-1",
      chatId: "chat",
      provider: "codex",
      stream: "stdout",
      event: {
        method: "turn/completed",
        params: { turn: { status: "completed" } },
      },
    }, 5);
    expect(completed.messages[1]).toMatchObject({
      role: "tool",
      text: "npm test\n\npassed",
      status: "complete",
    });
    expect(completed.usage).toEqual({ inputTokens: 12, cachedInputTokens: 4, outputTokens: 6 });
    expect(completed.runStatus).toBe("complete");
    expect(completed.activeRunId).toBeUndefined();
  });

  it("keeps provider approvals scoped to the requesting run", () => {
    const running = startChatRun(emptyChatConversation(1), "run-1", 2);
    const pending = applyChatRunEnvelope(running, {
      runId: "run-1",
      chatId: "chat",
      provider: "codex",
      stream: "stdout",
      event: {
        jsonrpc: "2.0",
        id: 41,
        method: "item/commandExecution/requestApproval",
        params: { command: "git push", cwd: "/repo", reason: "Publish changes" },
      },
    }, 3);
    expect(pending.messages[pending.messages.length - 1]).toMatchObject({
      title: "Command approval",
      text: "git push\nWorking directory: /repo\nPublish changes",
      status: "running",
      approvalRequestId: 41,
      approvalRunId: "run-1",
    });
    const resolved = applyChatRunEnvelope(pending, {
      runId: "run-1",
      chatId: "chat",
      provider: "codex",
      stream: "stdout",
      event: { type: "approval.resolved", requestId: 41, decision: "decline", resolution: "user" },
    }, 4);
    expect(resolved.messages[resolved.messages.length - 1]).toMatchObject({
      title: "Denied",
      status: "error",
      approvalDecision: "decline",
      approvalResolution: "user",
      approvalRunId: "run-1",
      approvalResolvedAt: 4,
    });
  });

  it("restores durable approval attribution after relaunch", () => {
    const restored = normalizeChatConversationRecords({
      "/repo\nsession-1": {
        provider: "codex",
        messages: [{
          id: "approval-1",
          role: "tool",
          text: "git push\n\nDecision: decline",
          title: "Denied",
          status: "error",
          timestamp: 20,
          approvalRequestId: 41,
          approvalMethod: "item/commandExecution/requestApproval",
          approvalDecision: "decline",
          approvalResolution: "timeout",
          approvalRunId: "run-1",
          approvalResolvedAt: 19,
        }],
        updatedAt: 20,
        revision: 2,
        runStatus: "error",
      },
    });

    expect(restored["/repo\nsession-1"].messages[0]).toMatchObject({
      approvalRequestId: 41,
      approvalMethod: "item/commandExecution/requestApproval",
      approvalDecision: "decline",
      approvalResolution: "timeout",
      approvalRunId: "run-1",
      approvalResolvedAt: 19,
    });
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

  it("normalizes durable fork lineage", () => {
    const restored = normalizeChatConversationRecords({
      "/repo\nfork": {
        provider: "codex",
        messages: [{ id: "user-1", role: "user", text: "Hello", timestamp: 3 }],
        updatedAt: 4,
        revision: 0,
        runStatus: "idle",
        fork: { parentChatId: "/repo\nsource", parentMessageId: "assistant-1", forkedAt: 2 },
      },
    });
    expect(restored["/repo\nfork"].fork).toEqual({
      parentChatId: "/repo\nsource",
      parentMessageId: "assistant-1",
      forkedAt: 2,
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
