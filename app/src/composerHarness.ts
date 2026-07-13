import type { AgentApprovalMode } from "./agentSessionHandle";

export type ComposerAttachmentKind = "file" | "browser" | "screenshot" | "image";
export type ComposerReasoningEffort = "default" | "low" | "medium" | "high" | "xhigh";

export type ComposerAttachment = {
  id: string;
  kind: ComposerAttachmentKind;
  label: string;
  target: string;
  createdAt: number;
};

export type ComposerHarnessState = {
  approvalMode: AgentApprovalMode;
  goal: string;
  model: string;
  reasoningEffort: ComposerReasoningEffort;
  selectedProfileId: string;
  attachments: ComposerAttachment[];
  draft: string;
  history: string[];
};

export type ComposerHarnessRecords = Record<string, ComposerHarnessState>;

export const MAX_COMPOSER_ATTACHMENTS = 6;

export const defaultComposerHarnessState = (selectedProfileId = "codex"): ComposerHarnessState => ({
  approvalMode: "ask",
  goal: "",
  model: "",
  reasoningEffort: "default",
  selectedProfileId,
  attachments: [],
  draft: "",
  history: [],
});

export const normalizeAgentApprovalMode = (value: unknown): AgentApprovalMode =>
  value === "approveSafe" || value === "fullAccess" || value === "ask" ? value : "ask";

export const normalizeComposerReasoningEffort = (value: unknown): ComposerReasoningEffort =>
  value === "low" || value === "medium" || value === "high" || value === "xhigh" ? value : "default";

export const normalizeComposerAttachment = (value: unknown): ComposerAttachment | null => {
  if (typeof value !== "object" || value == null || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const id = typeof item.id === "string" ? item.id.trim() : "";
  const kind = item.kind === "file" || item.kind === "browser" || item.kind === "screenshot" || item.kind === "image" ? item.kind : null;
  const label = typeof item.label === "string" ? item.label.trim() : "";
  const target = typeof item.target === "string" ? item.target.trim() : "";
  const createdAt = typeof item.createdAt === "number" && Number.isFinite(item.createdAt) ? item.createdAt : 0;
  if (!id || !kind || !label || !target) return null;
  return { id, kind, label, target, createdAt };
};

export const normalizeComposerHarnessState = (
  value: unknown,
  fallbackProfileId = "codex",
): ComposerHarnessState => {
  if (typeof value !== "object" || value == null || Array.isArray(value)) return defaultComposerHarnessState(fallbackProfileId);
  const item = value as Record<string, unknown>;
  const selectedProfileId = typeof item.selectedProfileId === "string" && item.selectedProfileId.trim()
    ? item.selectedProfileId.trim()
    : fallbackProfileId;
  return {
    approvalMode: normalizeAgentApprovalMode(item.approvalMode),
    goal: typeof item.goal === "string" ? item.goal.trim().slice(0, 160) : "",
    model: typeof item.model === "string" ? item.model.trim().slice(0, 128) : "",
    reasoningEffort: normalizeComposerReasoningEffort(item.reasoningEffort),
    selectedProfileId,
    attachments: Array.isArray(item.attachments)
      ? item.attachments.flatMap((attachment) => {
          const normalized = normalizeComposerAttachment(attachment);
          return normalized ? [normalized] : [];
        }).slice(0, MAX_COMPOSER_ATTACHMENTS)
      : [],
    draft: typeof item.draft === "string" ? item.draft.slice(0, 100_000) : "",
    history: Array.isArray(item.history)
      ? item.history.flatMap((entry) => typeof entry === "string" && entry.trim() ? [entry.slice(0, 100_000)] : []).slice(-20)
      : [],
  };
};

export const normalizeComposerHarnessRecords = (
  value: unknown,
  fallbackProfileId = "codex",
): ComposerHarnessRecords => {
  if (typeof value !== "object" || value == null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key.trim().length > 0)
      .map(([key, record]) => [key, normalizeComposerHarnessState(record, fallbackProfileId)] as const),
  );
};

export const upsertComposerAttachment = (
  attachments: ComposerAttachment[],
  attachment: ComposerAttachment,
) => [attachment, ...attachments.filter((item) => item.id !== attachment.id)].slice(0, MAX_COMPOSER_ATTACHMENTS);

export const removeComposerAttachment = (attachments: ComposerAttachment[], id: string) =>
  attachments.filter((attachment) => attachment.id !== id);

export const createComposerAttachment = (
  input: Omit<ComposerAttachment, "id" | "createdAt"> & Partial<Pick<ComposerAttachment, "id" | "createdAt">>,
  timestamp = Date.now(),
): ComposerAttachment => ({
  ...input,
  id: input.id ?? `${input.kind}:${timestamp}:${input.target}`,
  createdAt: input.createdAt ?? timestamp,
});

export const composerPromptPayload = (draft: string, state: ComposerHarnessState) => {
  const context: string[] = [];
  if (state.goal) context.push(`Goal: ${state.goal}`);
  if (state.attachments.length > 0) {
    context.push(
      [
        "Attachments:",
        ...state.attachments.map((attachment) => `- ${attachment.kind}: ${attachment.label} (${attachment.target})`),
      ].join("\n"),
    );
  }
  return context.length > 0 ? `${context.join("\n\n")}\n\n${draft}` : draft;
};
