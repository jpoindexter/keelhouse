import type { ChatConversation, ChatConversationRecords } from "./chatConversation";
import type { ProjectRailStatus } from "./workspaceStateTypes";

const conversationStatus = (conversation: ChatConversation | undefined): ProjectRailStatus => {
  if (conversation?.activeRunId) return "running";
  if (conversation?.messages[conversation.messages.length - 1]?.role === "error") return "attention";
  return "exited";
};

export const projectRailStatusFromConversations = (
  conversations: ChatConversationRecords,
  projectPath: string,
): ProjectRailStatus => {
  const owned = Object.entries(conversations)
    .filter(([key]) => key.startsWith(`${projectPath}\n`))
    .map(([, conversation]) => conversationStatus(conversation));
  if (owned.includes("running")) return "running";
  if (owned.includes("attention")) return "attention";
  return "exited";
};

export const projectSessionStatusFromConversations = (
  conversations: ChatConversationRecords,
  projectPath: string,
  sessionId: string,
): ProjectRailStatus => conversationStatus(conversations[`${projectPath}\n${sessionId}`]);
