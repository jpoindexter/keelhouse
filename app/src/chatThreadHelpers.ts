import type { ChatMessage } from "./chatConversation";
import type { RunCardKind } from "./runCards";

export const CHAT_SUGGESTIONS = [
  "Inspect this project and tell me what needs attention first.",
  "Run the relevant tests and fix the first real failure.",
  "Review the current Git changes before I commit.",
];

export const runCardIcon = (kind: RunCardKind) => {
  if (kind === "thinking") return "loading" as const;
  if (kind === "plan") return "logs" as const;
  if (kind === "file") return "file" as const;
  if (kind === "approval") return "shield" as const;
  if (kind === "command") return "terminal" as const;
  return "agent" as const;
};

export const messageLabel = (message: ChatMessage, providerLabel: string) => {
  if (message.role === "user") return "You";
  if (message.role === "assistant") return providerLabel;
  return message.title ?? (message.role === "error" ? "Error" : "Activity");
};

export const groupMessagesIntoTurns = (messages: ChatMessage[]) => {
  const turns: { id: string; messages: ChatMessage[] }[] = [];
  for (const message of messages) {
    if (message.role === "user" || turns.length === 0) turns.push({ id: message.id, messages: [message] });
    else turns[turns.length - 1].messages.push(message);
  }
  return turns;
};

export const isNearChatBottom = (scrollHeight: number, scrollTop: number, clientHeight: number, threshold = 56) =>
  scrollHeight - scrollTop - clientHeight <= threshold;

export const chatElapsedLabel = (startedAt: number, endedAt: number) => {
  const seconds = Math.max(0, Math.round((endedAt - startedAt) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};

export const retryPromptForTurn = (messages: ChatMessage[]) =>
  messages.find((message) => message.role === "user")?.text ?? "";

export const toolStatusLabel = (message: ChatMessage) => {
  if (message.status === "running") return "Running";
  if (message.status === "error") return "Failed";
  return "Done";
};

export const toolStatusIcon = (message: ChatMessage) => {
  if (message.status === "running") return "loading" as const;
  if (message.status === "error") return "error" as const;
  return "check" as const;
};
