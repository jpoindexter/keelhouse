import { describe, expect, it, vi } from "vitest";
import { emptyChatConversation, type ChatConversation } from "./chatConversation";
import { defaultComposerHarnessState } from "./composerHarness";
import { createComposerSettingsActions } from "./composerSettingsActions";

const createActions = () => {
  let harness = defaultComposerHarnessState("codex");
  let conversation: ChatConversation = {
    ...emptyChatConversation(),
    provider: "codex",
    providerThreadId: "thread-1",
  };
  const dependencies = {
    getRuntimeState: vi.fn(() => ({
      activeRunId: undefined as string | undefined,
      chatId: "/repo\nsession-1" as string | null,
      provider: "codex" as const,
    })),
    labelProvider: vi.fn((provider: string) => provider === "codex" ? "Codex" : "Claude"),
    labelReasoning: vi.fn((effort: string) => effort),
    logEvent: vi.fn(),
    now: vi.fn(() => 100),
    updateConversation: vi.fn((_chatId: string, updater: (current: ChatConversation) => ChatConversation) => {
      conversation = updater(conversation);
      return conversation;
    }),
    updateHarness: vi.fn(async (updater) => {
      harness = updater(harness);
      return harness;
    }),
    updateScopedSetting: vi.fn(async () => true),
  };
  return {
    actions: createComposerSettingsActions(dependencies),
    dependencies,
    getConversation: () => conversation,
    getHarness: () => harness,
  };
};

describe("createComposerSettingsActions", () => {
  it("persists and logs an approval mode change", async () => {
    const { actions, dependencies, getHarness } = createActions();

    await actions.setApprovalMode("fullAccess");

    expect(dependencies.updateScopedSetting).toHaveBeenCalledWith("approvalMode", "fullAccess");
    expect(getHarness().approvalMode).toBe("fullAccess");
    expect(dependencies.logEvent).toHaveBeenCalledWith("Permission mode changed", "fullAccess");
  });

  it("bounds the goal and logs only committed non-empty values", async () => {
    const { actions, dependencies, getHarness } = createActions();
    const goal = "x".repeat(200);

    await actions.setGoal(goal, { log: true });

    expect(getHarness().goal).toHaveLength(160);
    expect(dependencies.logEvent).toHaveBeenCalledWith("Goal updated", "x".repeat(160));
  });

  it("switches provider and model while clearing the provider thread", async () => {
    const { actions, dependencies, getConversation, getHarness } = createActions();

    await actions.setRuntime("claude", "  sonnet  ");

    expect(dependencies.updateScopedSetting).toHaveBeenCalledWith("agentProfileId", "claude");
    expect(getHarness()).toMatchObject({ model: "sonnet", selectedProfileId: "claude" });
    expect(getConversation()).toMatchObject({ provider: "claude", updatedAt: 100 });
    expect(getConversation().providerThreadId).toBeUndefined();
    expect(dependencies.logEvent).toHaveBeenCalledWith("Chat provider changed", "Claude");
    expect(dependencies.logEvent).toHaveBeenCalledWith("Chat model changed", "sonnet");
  });

  it("does not change runtime while a chat run is active", async () => {
    const { actions, dependencies } = createActions();
    dependencies.getRuntimeState.mockReturnValueOnce({
      activeRunId: "run-1",
      chatId: "/repo\nsession-1",
      provider: "codex",
    });

    await actions.setRuntime("claude", "sonnet");

    expect(dependencies.updateHarness).not.toHaveBeenCalled();
    expect(dependencies.updateConversation).not.toHaveBeenCalled();
    expect(dependencies.logEvent).not.toHaveBeenCalled();
  });

  it("updates an empty model for the current provider without resetting its thread", async () => {
    const { actions, dependencies, getConversation, getHarness } = createActions();

    await actions.setRuntime("codex", "   ");

    expect(getHarness().model).toBe("");
    expect(getConversation().providerThreadId).toBe("thread-1");
    expect(dependencies.updateScopedSetting).not.toHaveBeenCalled();
    expect(dependencies.updateConversation).not.toHaveBeenCalled();
    expect(dependencies.logEvent).toHaveBeenCalledWith("Chat model changed", "Codex default");
  });

  it("updates and logs reasoning effort", async () => {
    const { actions, dependencies, getHarness } = createActions();

    await actions.setReasoningEffort("high");

    expect(getHarness().reasoningEffort).toBe("high");
    expect(dependencies.logEvent).toHaveBeenCalledWith("Reasoning effort changed", "high");
  });
});
