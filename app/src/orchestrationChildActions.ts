import {
  appendToolChatMessage, type ChatConversation, type ChatConversationRecords,
} from "./chatConversation";
import { executeOrchestrationChildResult } from "./orchestrationChildResult";
import type { ProjectSession, ProjectSessionOrchestration } from "./workspaceState";

type Ref<T> = { current: T };

type OrchestrationChildActionsOptions = {
  conversations: Ref<ChatConversationRecords>;
  now: () => number;
  removeWorktree: (input: {
    branch: string; root: string; worktreePath: string;
  }) => Promise<unknown>;
  setNotice: (notice: string) => void;
  stopRun: (runId: string) => Promise<unknown>;
  updateConversation: (
    chatId: string, updater: (conversation: ChatConversation) => ChatConversation,
  ) => unknown;
  updateSessionMetadata: (
    projectPath: string, sessionId: string, metadata: ProjectSessionOrchestration,
  ) => Promise<unknown>;
};

const sessionKey = (projectPath: string, sessionId: string) => `${projectPath}\n${sessionId}`;

const stopChildRun = async (
  options: OrchestrationChildActionsOptions, projectPath: string, session: ProjectSession,
) => {
  const runId = options.conversations.current[sessionKey(projectPath, session.id)]?.activeRunId;
  if (!runId) return;
  await options.stopRun(runId);
  options.setNotice(`Stopping ${session.title}`);
};

const returnChildResult = (
  options: OrchestrationChildActionsOptions, projectPath: string, session: ProjectSession,
) => executeOrchestrationChildResult({
  childConversation: options.conversations.current[sessionKey(projectPath, session.id)],
  now: options.now,
  returnResult: ({ itemId, parentSessionId, text, title }) => {
    options.updateConversation(
      sessionKey(projectPath, parentSessionId),
      (conversation) => appendToolChatMessage(conversation, title, text, itemId),
    );
  },
  session,
  setNotice: options.setNotice,
  updateSessionMetadata: (metadata) =>
    options.updateSessionMetadata(projectPath, session.id, metadata),
});

const removeChildWorktree = async (
  options: OrchestrationChildActionsOptions, projectPath: string, session: ProjectSession,
) => {
  const metadata = session.orchestration;
  if (!metadata?.worktreePath || !metadata.worktreeBranch) return;
  await options.removeWorktree({
    branch: metadata.worktreeBranch, root: projectPath, worktreePath: metadata.worktreePath,
  });
  await options.updateSessionMetadata(projectPath, session.id, {
    ...metadata, worktreePath: undefined, worktreeBranch: undefined,
  });
  options.setNotice(`Removed ${session.title} worktree`);
};

export const createOrchestrationChildActions = (options: OrchestrationChildActionsOptions) => ({
  removeChildWorktree: (projectPath: string, session: ProjectSession) =>
    removeChildWorktree(options, projectPath, session),
  returnChildResult: (projectPath: string, session: ProjectSession) =>
    returnChildResult(options, projectPath, session),
  stopChildRun: (projectPath: string, session: ProjectSession) =>
    stopChildRun(options, projectPath, session),
});
