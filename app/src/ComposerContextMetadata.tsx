import type { ChatProvider, ChatUsage } from "./chatConversation";

export type ComposerContextMetadataProps = {
  branch: string | null;
  changedFiles: number;
  provider: ChatProvider | null;
  repositoryPath: string | null;
  usage: ChatUsage | undefined;
  onProjectSelect: () => void;
};

const repositoryName = (path: string | null) => {
  const normalized = path?.replace(/[\\/]+$/, "");
  return normalized?.split(/[\\/]/).pop() || "No repository";
};

const providerLabel = (provider: ChatProvider | null) => {
  if (provider === "codex") return "Codex";
  if (provider === "claude") return "Claude";
  if (provider === "opencode") return "OpenCode";
  return "Provider unavailable";
};

const contextLabel = (usage: ChatUsage | undefined) => {
  if (!usage) return "Context unavailable";
  const tokens = usage.inputTokens + usage.outputTokens;
  if (tokens < 1_000) return `${tokens} tokens`;
  return `${(tokens / 1_000).toFixed(1)}k tokens`;
};

export function ComposerContextMetadata(props: ComposerContextMetadataProps) {
  return (
    <dl className="composer-context-metadata" aria-label="Composer context metadata">
      <div title={props.repositoryPath ?? undefined}><dt>Project</dt><dd><button type="button" aria-label={`Switch project, ${repositoryName(props.repositoryPath)}`} onClick={props.onProjectSelect}>{repositoryName(props.repositoryPath)}</button></dd></div>
      <div><dt>Branch</dt><dd>{props.branch ?? "No branch"}</dd></div>
      <div><dt>Changes</dt><dd>{props.changedFiles === 1 ? "1 change" : `${props.changedFiles} changes`}</dd></div>
      <div><dt>Provider</dt><dd>{providerLabel(props.provider)}</dd></div>
      <div><dt>Context</dt><dd>{contextLabel(props.usage)}</dd></div>
    </dl>
  );
}
