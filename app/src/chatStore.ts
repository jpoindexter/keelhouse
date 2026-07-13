import { invoke } from "@tauri-apps/api/core";
import type { ChatConversation, ChatConversationRecords } from "./chatConversation";
import type { ChatSearchResult } from "./chatDiscovery";

export type LegacyChatImportResult = {
  imported: number;
  alreadyCompleted: boolean;
};

export const loadDurableChatConversations = () =>
  invoke<ChatConversationRecords>("load_chat_conversations");

export const migrateLegacyChatConversations = (conversations: ChatConversationRecords) =>
  invoke<LegacyChatImportResult>("migrate_chat_conversations", { conversations });

export const saveDurableChatConversation = (chatId: string, conversation: ChatConversation) =>
  invoke<boolean>("save_chat_conversation", { chatId, conversation });

export const searchDurableChatMessages = (query: string, bookmarksOnly = false, limit = 60) =>
  invoke<ChatSearchResult[]>("search_chat_messages", { query, bookmarksOnly, limit });

export const deleteDurableChatConversation = (chatId: string) =>
  invoke<void>("delete_chat_conversation", { chatId });

export const deleteDurableProjectChats = (projectPath: string) =>
  invoke<number>("delete_project_chat_conversations", { projectPath });

export const resetDurableChatStore = () => invoke<void>("reset_chat_store");
