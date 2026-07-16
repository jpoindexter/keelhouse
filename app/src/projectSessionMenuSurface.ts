import type { ChatConversationRecords } from "./chatConversation";
import type { ProjectSession } from "./workspaceStateTypes";

type ProjectSessionMenuInput = {
  activeSessionId: string | null;
  chatIdForSession: (root: string, sessionId: string) => string;
  conversations: ChatConversationRecords;
  projectPath: string;
  session: ProjectSession;
  sessions: ProjectSession[];
  workspacePath: string | null;
};

export const deriveProjectSessionMenuState = (input: ProjectSessionMenuInput) => {
  const conversation = input.conversations[input.chatIdForSession(input.projectPath, input.session.id)];
  return {
    activeProjectSessionCount: input.sessions.filter((session) => !session.archived).length,
    hasAssistantMessage: Boolean(
      conversation?.messages.some((message) => message.role === "assistant"),
    ),
    hasRunningChildRun: Boolean(conversation?.activeRunId),
    isActiveSession: input.projectPath === input.workspacePath
      && input.session.id === input.activeSessionId,
    isWorkspaceProject: input.projectPath === input.workspacePath,
    projectSessionCount: input.sessions.length,
  };
};
