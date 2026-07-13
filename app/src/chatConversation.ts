export type ChatProvider = "codex";

export type ChatMessageRole = "user" | "assistant" | "tool" | "status" | "error";

export type ChatMessage = {
  id: string;
  role: ChatMessageRole;
  text: string;
  timestamp: number;
  itemId?: string;
  title?: string;
  status?: "running" | "complete" | "error";
};

export type ChatUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
};

export type ChatRunStatus = "idle" | "running" | "complete" | "error" | "interrupted";

export type ChatConversation = {
  provider: ChatProvider;
  providerThreadId?: string;
  activeRunId?: string;
  messages: ChatMessage[];
  updatedAt: number;
  revision: number;
  runStatus: ChatRunStatus;
  usage?: ChatUsage;
};

export type ChatConversationRecords = Record<string, ChatConversation>;

export type ChatRunEnvelope = {
  runId: string;
  chatId: string;
  provider: ChatProvider;
  stream: "stdout" | "stderr" | "lifecycle";
  event?: unknown;
  line?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value != null;

const textValue = (value: unknown): string => typeof value === "string" ? value : "";

const messageId = (prefix: string, timestamp: number, suffix = "") =>
  `${prefix}-${Math.max(0, Math.floor(timestamp)).toString(36)}${suffix ? `-${suffix}` : ""}`;

export const emptyChatConversation = (now = Date.now()): ChatConversation => ({
  provider: "codex",
  messages: [],
  updatedAt: now,
  revision: 0,
  runStatus: "idle",
});

const nonNegativeInteger = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const normalizeUsage = (value: unknown): ChatUsage | undefined => {
  if (!isRecord(value)) return undefined;
  return {
    inputTokens: nonNegativeInteger(value.inputTokens ?? value.input_tokens),
    cachedInputTokens: nonNegativeInteger(value.cachedInputTokens ?? value.cached_input_tokens),
    outputTokens: nonNegativeInteger(value.outputTokens ?? value.output_tokens),
  };
};

const normalizeRunStatus = (value: unknown, staleActiveRun: boolean): ChatRunStatus => {
  if (staleActiveRun) return "interrupted";
  return value === "running" || value === "complete" || value === "error" || value === "interrupted"
    ? value
    : "idle";
};

const normalizeMessage = (value: unknown): ChatMessage | null => {
  if (!isRecord(value)) return null;
  const role = value.role;
  if (!(["user", "assistant", "tool", "status", "error"] as unknown[]).includes(role)) return null;
  const text = textValue(value.text);
  const id = textValue(value.id);
  const timestamp = typeof value.timestamp === "number" && Number.isFinite(value.timestamp) ? value.timestamp : 0;
  if (!id || !text || !timestamp) return null;
  const status = value.status;
  return {
    id,
    role: role as ChatMessageRole,
    text,
    timestamp,
    itemId: textValue(value.itemId) || undefined,
    title: textValue(value.title) || undefined,
    status: status === "running" || status === "complete" || status === "error" ? status : undefined,
  };
};

export const normalizeChatConversationRecords = (value: unknown): ChatConversationRecords => {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([key, entry]) => {
    if (!key.trim() || !isRecord(entry)) return [];
    const staleActiveRun = Boolean(textValue(entry.activeRunId));
    const messages = Array.isArray(entry.messages)
      ? entry.messages.map(normalizeMessage).filter((message): message is ChatMessage => Boolean(message)).map((message) =>
        staleActiveRun && message.status === "running"
          ? { ...message, text: "Interrupted when Keelhouse last closed.", status: "error" as const }
          : message
      )
      : [];
    const updatedAt = typeof entry.updatedAt === "number" && Number.isFinite(entry.updatedAt)
      ? entry.updatedAt
      : messages[messages.length - 1]?.timestamp ?? Date.now();
    return [[key, {
      provider: "codex" as const,
      providerThreadId: textValue(entry.providerThreadId) || undefined,
      activeRunId: undefined,
      messages,
      updatedAt,
      revision: nonNegativeInteger(entry.revision) + (staleActiveRun ? 1 : 0),
      runStatus: normalizeRunStatus(entry.runStatus, staleActiveRun),
      usage: normalizeUsage(entry.usage),
    }]];
  }));
};

const pushMessage = (conversation: ChatConversation, message: ChatMessage): ChatConversation => ({
  ...conversation,
  messages: [...conversation.messages, message],
  updatedAt: message.timestamp,
});

export const appendUserChatMessage = (
  conversation: ChatConversation,
  text: string,
  now = Date.now(),
): ChatConversation => pushMessage(conversation, {
  id: messageId("user", now),
  role: "user",
  text: text.trim(),
  timestamp: now,
});

export const chatTitleFromPrompt = (prompt: string, maxLength = 52): string => {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
};

export const startChatRun = (
  conversation: ChatConversation,
  runId: string,
  now = Date.now(),
): ChatConversation => {
  const statusMessage: ChatMessage = {
    id: messageId("status", now, runId),
    role: "status",
    text: "Working",
    title: "Codex",
    status: "running",
    timestamp: now,
  };
  return {
    ...conversation,
    activeRunId: runId,
    runStatus: "running",
    messages: [...conversation.messages, statusMessage],
    updatedAt: now,
  };
};

const upsertItemMessage = (
  conversation: ChatConversation,
  message: ChatMessage,
): ChatConversation => {
  const index = message.itemId
    ? conversation.messages.findIndex((entry) => entry.itemId === message.itemId)
    : -1;
  if (index < 0) return pushMessage(conversation, message);
  const messages = [...conversation.messages];
  messages[index] = { ...messages[index], ...message };
  return { ...conversation, messages, updatedAt: message.timestamp };
};

const commandText = (item: Record<string, unknown>) => {
  const command = textValue(item.command) || "Command";
  const output = textValue(item.aggregated_output).trim();
  return output ? `${command}\n\n${output}` : command;
};

const itemMessage = (
  item: Record<string, unknown>,
  eventType: string,
  now: number,
  runId: string,
): ChatMessage | null => {
  const type = textValue(item.type);
  const providerItemId = textValue(item.id);
  const itemId = providerItemId ? `${runId}:${providerItemId}` : undefined;
  const running = eventType === "item.started";
  if (type === "agent_message") {
    const text = textValue(item.text).trim();
    return text ? {
      id: messageId("assistant", now, itemId),
      role: "assistant",
      text,
      itemId,
      status: running ? "running" : "complete",
      timestamp: now,
    } : null;
  }
  if (type === "command_execution") {
    const status = textValue(item.status);
    return {
      id: messageId("tool", now, itemId),
      role: "tool",
      title: running ? "Running command" : status === "failed" ? "Command failed" : "Ran command",
      text: commandText(item),
      itemId,
      status: running ? "running" : status === "failed" ? "error" : "complete",
      timestamp: now,
    };
  }
  if (type === "file_change") {
    const changes = Array.isArray(item.changes)
      ? item.changes.flatMap((change) => isRecord(change) ? [textValue(change.path)].filter(Boolean) : [])
      : [];
    return {
      id: messageId("tool", now, itemId),
      role: "tool",
      title: running ? "Editing files" : "Edited files",
      text: changes.length > 0 ? changes.join("\n") : "Workspace files changed",
      itemId,
      status: running ? "running" : "complete",
      timestamp: now,
    };
  }
  if (type === "mcp_tool_call" || type === "web_search") {
    const name = textValue(item.tool) || textValue(item.query) || type.replace(/_/g, " ");
    return {
      id: messageId("tool", now, itemId),
      role: "tool",
      title: running ? "Using tool" : "Used tool",
      text: name,
      itemId,
      status: running ? "running" : "complete",
      timestamp: now,
    };
  }
  if (type === "error") {
    const text = textValue(item.message).trim();
    return text ? {
      id: messageId("error", now, itemId),
      role: "error",
      text,
      itemId,
      status: "error",
      timestamp: now,
    } : null;
  }
  return null;
};

const completeRunningStatus = (conversation: ChatConversation, now: number): ChatConversation => ({
  ...conversation,
  activeRunId: undefined,
  runStatus: "complete",
  messages: conversation.messages.map((message) =>
    message.role === "status" && message.status === "running"
      ? { ...message, text: "Completed", status: "complete" as const, timestamp: now }
      : message
  ),
  updatedAt: now,
});

export const applyChatRunEnvelope = (
  conversation: ChatConversation,
  envelope: ChatRunEnvelope,
  now = Date.now(),
): ChatConversation => {
  if (envelope.stream === "lifecycle") {
    if (!isRecord(envelope.event) || textValue(envelope.event.type) !== "run.completed") return conversation;
    const exitCode = typeof envelope.event.exitCode === "number" ? envelope.event.exitCode : 1;
    const completed = completeRunningStatus(conversation, now);
    return exitCode === 0 ? completed : pushMessage({ ...completed, runStatus: "error" }, {
      id: messageId("error", now, envelope.runId),
      role: "error",
      text: textValue(envelope.event.message) || `Codex exited with status ${exitCode}.`,
      status: "error",
      timestamp: now,
    });
  }
  if (envelope.stream !== "stdout" || !isRecord(envelope.event)) return conversation;
  const eventType = textValue(envelope.event.type);
  if (eventType === "thread.started") {
    const providerThreadId = textValue(envelope.event.thread_id);
    return providerThreadId ? { ...conversation, providerThreadId, updatedAt: now } : conversation;
  }
  if (eventType === "item.started" || eventType === "item.completed") {
    const item = isRecord(envelope.event.item) ? envelope.event.item : null;
    const message = item ? itemMessage(item, eventType, now, envelope.runId) : null;
    return message ? upsertItemMessage(conversation, message) : conversation;
  }
  if (eventType === "turn.failed") {
    const error = isRecord(envelope.event.error) ? textValue(envelope.event.error.message) : "Codex could not complete this turn.";
    return pushMessage({ ...completeRunningStatus(conversation, now), runStatus: "error" }, {
      id: messageId("error", now, envelope.runId),
      role: "error",
      text: error,
      status: "error",
      timestamp: now,
    });
  }
  if (eventType === "turn.completed") {
    return {
      ...completeRunningStatus(conversation, now),
      usage: normalizeUsage(envelope.event.usage) ?? conversation.usage,
    };
  }
  return conversation;
};
