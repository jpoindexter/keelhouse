import type { ChatConversationRecords } from "./chatConversation";
import type { ProjectSessionsByProject } from "./workspaceStateTypes";

const DEFAULT_PARENT_TITLE = "Current chat";

type OrchestrationDialogInput = {
  activeSessionId: string | null;
  conversations: ChatConversationRecords;
  sessions: ProjectSessionsByProject;
  workspacePath: string | null;
};

export const deriveOrchestrationDialogState = (input: OrchestrationDialogInput) => ({
  activeRunCount: Object.values(input.conversations)
    .filter((conversation) => conversation.activeRunId).length,
  parentTitle: input.sessions[input.workspacePath ?? ""]
    ?.find((session) => session.id === input.activeSessionId)?.title ?? DEFAULT_PARENT_TITLE,
});
