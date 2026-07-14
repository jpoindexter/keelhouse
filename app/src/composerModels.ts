import { chatProviderLabel, type ChatProvider } from "./chatConversation";

export type ComposerModelChoice = {
  provider: ChatProvider;
  id: string;
  label: string;
  detail: string;
};

const SUGGESTED_MODELS: Record<ChatProvider, string[]> = {
  codex: ["gpt-5.6-sol"],
  claude: ["sonnet", "opus", "haiku"],
};

export const composerModelChoices = (
  configuredModels: Partial<Record<ChatProvider, string>>,
  selectedProvider: ChatProvider,
  selectedModel: string,
): ComposerModelChoice[] => {
  const choices: ComposerModelChoice[] = [];
  for (const provider of ["codex", "claude"] as const) {
    const providerLabel = chatProviderLabel(provider);
    choices.push({ provider, id: "", label: `${providerLabel} default`, detail: "Use the provider's current default" });
    const configured = configuredModels[provider]?.trim() ?? "";
    const current = provider === selectedProvider ? selectedModel.trim() : "";
    const ids = [configured, current, ...SUGGESTED_MODELS[provider]].filter(Boolean);
    for (const id of [...new Set(ids)]) {
      choices.push({
        provider,
        id,
        label: id,
        detail: id === configured ? "Configured in Connections" : id === current ? "Current chat" : "Suggested model",
      });
    }
  }
  return choices;
};

export const filterComposerModels = (choices: ComposerModelChoice[], query: string) => {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return choices;
  return choices.filter((choice) =>
    [choice.label, choice.id, choice.detail, chatProviderLabel(choice.provider)]
      .some((value) => value.toLocaleLowerCase().includes(needle)),
  );
};
