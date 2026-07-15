import { forkChatConversation, type ChatConversation } from "./chatConversation";
import { newProjectSession, type ProjectSession } from "./workspaceState";

type ForkCheckpoint = {
  createdAt?: number;
  id: string;
};

type CreateChatForkPlanInput = {
  checkpoint: ForkCheckpoint | null;
  existingSessions: ProjectSession[];
  messageId: string;
  now: number;
  sourceChatId: string;
  sourceConversation: ChatConversation;
  sourceSessionId: string;
};

export type ChatForkPlan = {
  forkedConversation: ChatConversation;
  session: ProjectSession;
  sourceTitle: string;
};

const nextForkTimestamp = (existingSessions: ProjectSession[], now: number) => {
  let timestamp = now;
  while (existingSessions.some((session) => session.id === `session-${timestamp.toString(36)}`)) timestamp += 1;
  return timestamp;
};

export const createChatForkPlan = ({
  checkpoint,
  existingSessions,
  messageId,
  now,
  sourceChatId,
  sourceConversation,
  sourceSessionId,
}: CreateChatForkPlanInput): ChatForkPlan | null => {
  const sourceTitle = existingSessions.find((session) => session.id === sourceSessionId)?.title ?? "chat";
  const forkedAt = nextForkTimestamp(existingSessions, now);
  const forkedConversation = forkChatConversation(sourceConversation, sourceChatId, messageId, forkedAt);
  if (!forkedConversation) return null;
  return {
    forkedConversation,
    session: {
      ...newProjectSession(existingSessions, forkedAt),
      checkpointCreatedAt: checkpoint?.createdAt,
      checkpointId: checkpoint?.id,
      forkedAt,
      parentMessageId: messageId,
      parentSessionId: sourceSessionId,
      status: "exited",
      title: `Fork of ${sourceTitle}`,
    },
    sourceTitle,
  };
};
