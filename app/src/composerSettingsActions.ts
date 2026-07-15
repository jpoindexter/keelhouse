import type { AgentApprovalMode } from "./agentSessionHandle";
import type { ChatConversation, ChatProvider } from "./chatConversation";
import type { ComposerHarnessState, ComposerReasoningEffort } from "./composerHarness";

type ComposerRuntimeState = {
  activeRunId: string | undefined;
  chatId: string | null;
  provider: ChatProvider | null;
};

type ComposerSettingsDependencies = {
  getRuntimeState: () => ComposerRuntimeState;
  labelProvider: (provider: ChatProvider) => string;
  labelReasoning: (effort: ComposerReasoningEffort) => string;
  logEvent: (label: string, detail: string) => void;
  now: () => number;
  updateConversation: (
    chatId: string,
    updater: (conversation: ChatConversation) => ChatConversation,
  ) => ChatConversation;
  updateHarness: (
    updater: (state: ComposerHarnessState) => ComposerHarnessState,
  ) => Promise<ComposerHarnessState | null>;
  updateScopedSetting: (
    key: "agentProfileId" | "approvalMode",
    value: AgentApprovalMode | ChatProvider,
  ) => Promise<unknown>;
};

const setApprovalMode = async (
  dependencies: ComposerSettingsDependencies,
  approvalMode: AgentApprovalMode,
) => {
  await dependencies.updateScopedSetting("approvalMode", approvalMode);
  const next = await dependencies.updateHarness((state) => ({ ...state, approvalMode }));
  if (next) dependencies.logEvent("Permission mode changed", approvalMode);
};

const setGoal = async (
  dependencies: ComposerSettingsDependencies,
  goal: string,
  options: { log?: boolean },
) => {
  const next = await dependencies.updateHarness((state) => ({
    ...state,
    goal: goal.slice(0, 160),
  }));
  if (options.log && next?.goal) dependencies.logEvent("Goal updated", next.goal);
};

const setRuntime = async (
  dependencies: ComposerSettingsDependencies,
  provider: ChatProvider,
  model: string,
) => {
  const runtime = dependencies.getRuntimeState();
  if (!runtime.chatId || runtime.activeRunId) return;
  const providerChanged = provider !== runtime.provider;
  if (providerChanged) await dependencies.updateScopedSetting("agentProfileId", provider);
  const normalizedModel = model.trim().slice(0, 128);
  await dependencies.updateHarness((state) => ({
    ...state, selectedProfileId: provider, model: normalizedModel,
  }));
  if (providerChanged) {
    dependencies.updateConversation(runtime.chatId, (conversation) => ({
      ...conversation, provider, providerThreadId: undefined, updatedAt: dependencies.now(),
    }));
    dependencies.logEvent("Chat provider changed", dependencies.labelProvider(provider));
  }
  dependencies.logEvent(
    "Chat model changed", normalizedModel || `${dependencies.labelProvider(provider)} default`,
  );
};

const setReasoningEffort = async (
  dependencies: ComposerSettingsDependencies,
  reasoningEffort: ComposerReasoningEffort,
) => {
  const next = await dependencies.updateHarness((state) => ({ ...state, reasoningEffort }));
  if (next) {
    dependencies.logEvent("Reasoning effort changed", dependencies.labelReasoning(reasoningEffort));
  }
};

export const createComposerSettingsActions = (dependencies: ComposerSettingsDependencies) => ({
  setApprovalMode: (mode: AgentApprovalMode) => setApprovalMode(dependencies, mode),
  setGoal: (goal: string, options: { log?: boolean } = {}) => setGoal(dependencies, goal, options),
  setReasoningEffort: (effort: ComposerReasoningEffort) =>
    setReasoningEffort(dependencies, effort),
  setRuntime: (provider: ChatProvider, model: string) => setRuntime(dependencies, provider, model),
});
