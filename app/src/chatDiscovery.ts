import type { ChatConversationRecords, ChatMessageRole } from "./chatConversation";
import type { ProjectSessionsByProject } from "./workspaceState";

export type ChatSearchResult = {
  chatId: string;
  projectPath: string;
  sessionId: string;
  messageId?: string;
  role: ChatMessageRole | "title";
  snippet: string;
  timestamp: number;
  bookmarked: boolean;
};

export type ChatSearchViewResult = ChatSearchResult & {
  projectName: string;
  title: string;
  archived: boolean;
  pinned: boolean;
};

const basename = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? path;

export const chatDiscoveryKey = (result: Pick<ChatSearchResult, "chatId" | "messageId" | "role">) =>
  `${result.chatId}\n${result.messageId ?? result.role}`;

export const mergeChatDiscoveryResults = (
  messageResults: ChatSearchResult[],
  sessionsByProject: ProjectSessionsByProject,
  conversations: ChatConversationRecords,
  query: string,
  bookmarksOnly = false,
): ChatSearchViewResult[] => {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const combined = [...messageResults];
  if (!bookmarksOnly && normalizedQuery.length >= 2) {
    for (const [projectPath, sessions] of Object.entries(sessionsByProject)) {
      for (const session of sessions) {
        if (!session.title.toLocaleLowerCase().includes(normalizedQuery)) continue;
        const chatId = `${projectPath}\n${session.id}`;
        const firstMessage = conversations[chatId]?.messages.find((message) => message.role === "user");
        combined.push({
          chatId,
          projectPath,
          sessionId: session.id,
          role: "title",
          snippet: firstMessage?.text ?? session.title,
          timestamp: session.updatedAt,
          bookmarked: false,
        });
      }
    }
  }

  const seen = new Set<string>();
  return combined
    .filter((result) => {
      const key = chatDiscoveryKey(result);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((result) => {
      const session = sessionsByProject[result.projectPath]?.find((item) => item.id === result.sessionId);
      const currentMessage = result.messageId
        ? conversations[result.chatId]?.messages.find((message) => message.id === result.messageId)
        : null;
      return {
        ...result,
        bookmarked: currentMessage?.bookmarked ?? result.bookmarked,
        projectName: basename(result.projectPath),
        title: session?.title ?? "Recovered chat",
        archived: Boolean(session?.archived),
        pinned: Boolean(session?.pinnedAt),
      };
    })
    .sort((a, b) => Number(b.bookmarked) - Number(a.bookmarked) || b.timestamp - a.timestamp);
};
