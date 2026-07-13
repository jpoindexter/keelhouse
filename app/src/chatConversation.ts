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
  approvalRequestId?: number;
  approvalMethod?: string;
  bookmarked?: boolean;
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
    bookmarked: value.bookmarked === true ? true : undefined,
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
  const output = textValue(item.aggregatedOutput ?? item.aggregated_output).trim();
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
  if (type === "agent_message" || type === "agentMessage") {
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
  if (type === "command_execution" || type === "commandExecution") {
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
  if (type === "file_change" || type === "fileChange") {
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
  if (
    type === "mcp_tool_call" || type === "mcpToolCall"
    || type === "dynamicToolCall" || type === "collabAgentToolCall"
    || type === "web_search" || type === "webSearch"
  ) {
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

const appendItemDelta = (
  conversation: ChatConversation,
  runId: string,
  providerItemId: string,
  delta: string,
  kind: "assistant" | "tool",
  now: number,
): ChatConversation => {
  if (!providerItemId || !delta) return conversation;
  const itemId = `${runId}:${providerItemId}`;
  const index = conversation.messages.findIndex((message) => message.itemId === itemId);
  if (index < 0) {
    return pushMessage(conversation, {
      id: messageId(kind, now, itemId),
      role: kind,
      title: kind === "tool" ? "Running command" : undefined,
      text: delta,
      itemId,
      status: "running",
      timestamp: now,
    });
  }
  const messages = [...conversation.messages];
  const current = messages[index];
  const separator = kind === "tool" && current.text && !current.text.includes("\n\n") ? "\n\n" : "";
  messages[index] = {
    ...current,
    text: `${current.text}${separator}${delta}`,
    status: "running",
    timestamp: now,
  };
  return { ...conversation, messages, updatedAt: now };
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
    if (conversation.activeRunId !== envelope.runId) return conversation;
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
  const method = textValue(envelope.event.method);
  const params = isRecord(envelope.event.params) ? envelope.event.params : envelope.event;
  const eventType = textValue(envelope.event.type) || method;
  if (eventType === "thread.started") {
    const providerThreadId = textValue(envelope.event.thread_id);
    return providerThreadId ? { ...conversation, providerThreadId, updatedAt: now } : conversation;
  }
  if (eventType === "thread/started") {
    const thread = isRecord(params.thread) ? params.thread : null;
    const providerThreadId = thread ? textValue(thread.id) : "";
    return providerThreadId ? { ...conversation, providerThreadId, updatedAt: now } : conversation;
  }
  if (eventType === "item.started" || eventType === "item.completed") {
    const item = isRecord(envelope.event.item) ? envelope.event.item : null;
    const message = item ? itemMessage(item, eventType, now, envelope.runId) : null;
    return message ? upsertItemMessage(conversation, message) : conversation;
  }
  if (eventType === "item/started" || eventType === "item/completed") {
    const item = isRecord(params.item) ? params.item : null;
    const normalizedType = eventType === "item/started" ? "item.started" : "item.completed";
    const message = item ? itemMessage(item, normalizedType, now, envelope.runId) : null;
    return message ? upsertItemMessage(conversation, message) : conversation;
  }
  if (eventType === "item/agentMessage/delta") {
    return appendItemDelta(
      conversation,
      envelope.runId,
      textValue(params.itemId),
      textValue(params.delta),
      "assistant",
      now,
    );
  }
  if (eventType === "item/commandExecution/outputDelta" || eventType === "item/fileChange/outputDelta") {
    return appendItemDelta(
      conversation,
      envelope.runId,
      textValue(params.itemId),
      textValue(params.delta),
      "tool",
      now,
    );
  }
  if (
    eventType === "item/commandExecution/requestApproval"
    || eventType === "item/fileChange/requestApproval"
    || eventType === "item/permissions/requestApproval"
  ) {
    const requestId = typeof envelope.event.id === "number" ? envelope.event.id : -1;
    if (requestId < 0) return conversation;
    const command = textValue(params.command);
    const cwd = textValue(params.cwd);
    const target = textValue(params.grantRoot);
    const reason = textValue(params.reason);
    const details = [command, target && `Target: ${target}`, cwd && `Working directory: ${cwd}`, reason]
      .filter(Boolean)
      .join("\n");
    const kind = eventType.includes("commandExecution")
      ? "Command approval"
      : eventType.includes("fileChange") ? "File change approval" : "Permission approval";
    return upsertItemMessage(conversation, {
      id: messageId("approval", now, `${envelope.runId}-${requestId}`),
      role: "tool",
      title: kind,
      text: details || "Codex requested permission to continue.",
      itemId: `${envelope.runId}:approval-${requestId}`,
      status: "running",
      timestamp: now,
      approvalRequestId: requestId,
      approvalMethod: eventType,
    });
  }
  if (eventType === "approval.resolved") {
    const requestId = typeof envelope.event.requestId === "number" ? envelope.event.requestId : -1;
    const decision = textValue(envelope.event.decision);
    const index = conversation.messages.findIndex((message) => message.approvalRequestId === requestId);
    if (index < 0) return conversation;
    const messages = [...conversation.messages];
    const approved = decision === "accept" || decision === "acceptForSession";
    messages[index] = {
      ...messages[index],
      title: approved ? "Approved" : "Denied",
      text: `${messages[index].text}\n\nDecision: ${decision}`,
      status: approved ? "complete" : "error",
      timestamp: now,
    };
    return { ...conversation, messages, updatedAt: now };
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
  if (eventType === "thread/tokenUsage/updated") {
    const tokenUsage = isRecord(params.tokenUsage) ? params.tokenUsage : null;
    const total = tokenUsage && isRecord(tokenUsage.total) ? tokenUsage.total : null;
    return total ? { ...conversation, usage: normalizeUsage(total) ?? conversation.usage } : conversation;
  }
  if (eventType === "turn/completed") {
    const turn = isRecord(params.turn) ? params.turn : null;
    const status = turn ? textValue(turn.status) : "completed";
    const completed = completeRunningStatus(conversation, now);
    if (status === "interrupted") {
      return {
        ...completed,
        runStatus: "interrupted",
        messages: completed.messages.map((message) =>
          message.role === "status" && message.text === "Completed"
            ? { ...message, text: "Stopped" }
            : message
        ),
      };
    }
    if (status === "failed") {
      const error = turn && isRecord(turn.error) ? textValue(turn.error.message) : "Codex could not complete this turn.";
      return pushMessage({ ...completed, runStatus: "error" }, {
        id: messageId("error", now, envelope.runId),
        role: "error",
        text: error,
        status: "error",
        timestamp: now,
      });
    }
    return completed;
  }
  return conversation;
};
