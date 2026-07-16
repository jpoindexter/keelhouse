import type { MouseEvent } from "react";
import type { AgentComposerSurfaceProps } from "./AgentComposerSurface";
import type { AgentConversationPanelProps } from "./AgentConversationPanel";
import type { ChatThreadSurfaceProps } from "./ChatThreadSurface";
import type { ComposerAttachment } from "./composerHarness";
import type { ChatMessage } from "./chatConversation";
import type { ChatApprovalDecision } from "./chatRunControls";
import type { ContextMenuItem } from "./ContextMenu";
import type { FileTreeNode } from "./fileTreeTypes";
import type { useComposerRuntime } from "./useComposerRuntime";
import type { useConversationRuntime } from "./useConversationRuntime";
import type { useShellLayout } from "./useShellLayout";

type ConversationRuntime = ReturnType<typeof useConversationRuntime>;
type ComposerRuntime = ReturnType<typeof useComposerRuntime>;


type AgentConversationPanelInput = {
  activeAgentSession: { selectedAgentActivityLog: ChatThreadSurfaceProps["events"] };
  activeChat: ConversationRuntime["activeChat"];
  aiConnectionSettings: { providerModels: AgentComposerSurfaceProps["configuredModels"] };
  appMenuAssembly: { composerContextMenuItems: () => ContextMenuItem[]; openComposerAddMenu: (event: MouseEvent) => void };
  chatConversationActions: {
    forkFromMessage: (message: ChatThreadSurfaceProps["conversation"]["messages"][number]) => Promise<unknown>;
    toggleBookmark: ChatThreadSurfaceProps["onToggleBookmark"];
  };
  chatRunControls: {
    resolveChatApproval: (message: ChatMessage, decision: ChatApprovalDecision) => Promise<unknown>;
    stopActiveChatRun: () => Promise<unknown>;
  };
  composerAttachments: ComposerRuntime["composerAttachments"];
  composerError: string | null;
  composerHistoryNavigation: { showNext: () => void; showPrevious: () => void };
  composerLocal: ComposerRuntime["composerLocal"];
  composerMentionQuery: string | null;
  composerMentionResults: FileTreeNode[];
  composerNotice: string | null;
  composerSending: boolean;
  composerSettingsActions: {
    setApprovalMode: (mode: AgentComposerSurfaceProps["approvalMode"]) => Promise<unknown>;
    setGoal: (goal: string, options?: { log: boolean }) => Promise<unknown>;
    setReasoningEffort: AgentComposerSurfaceProps["onReasoningChange"];
    setRuntime: AgentComposerSurfaceProps["onRuntimeChange"];
  };
  composerSurface: { submitComposerDraft: (prompt?: string) => Promise<unknown> };
  contextMenuHost: { openContextMenu: (event: MouseEvent, items: ContextMenuItem[]) => void };
  editorSurface: { reviewRunCardFile: (path: string) => Promise<unknown> };
  focusedChatMessageId: string | null;
  gitStatusHook: { status: { branch: string | null; staged: number; unstaged: number; untracked: number } | null };
  setComposerNotice: (notice: string | null) => void;
  setSettingsOpen: (open: boolean) => void;
  shellLayout: ReturnType<typeof useShellLayout>;
  workspacePath: string | null;
};

const chatThreadPropsFrom = (input: AgentConversationPanelInput): ChatThreadSurfaceProps => ({
  conversation: input.activeChat.activeChatConversation,
  events: input.activeAgentSession.selectedAgentActivityLog,
  hidden: false,
  onSuggestion: (draft) => input.composerLocal.setLocalState(input.activeChat.activeComposerHarnessKey, draft, input.composerLocal.history),
  onRetry: (prompt) => void input.composerSurface.submitComposerDraft(prompt),
  onApprovalDecision: (message, decision) => void input.chatRunControls.resolveChatApproval(message, decision),
  onToggleBookmark: input.chatConversationActions.toggleBookmark,
  onForkMessage: (message) => void input.chatConversationActions.forkFromMessage(message),
  onReviewFile: (path) => void input.editorSurface.reviewRunCardFile(path),
  focusMessageId: input.focusedChatMessageId,
});

const composerStateFrom = (input: AgentConversationPanelInput) => ({
  activeRun: Boolean(input.activeChat.activeChatConversation.activeRunId),
  approvalMode: input.activeChat.activeComposerHarness.approvalMode,
  attachments: input.activeChat.activeComposerHarness.attachments,
  configuredModels: input.aiConnectionSettings.providerModels,
  draft: input.composerLocal.draft, error: input.composerError, goal: input.activeChat.activeComposerHarness.goal,
  hasHarness: Boolean(input.activeChat.activeComposerHarnessKey),
  hasHistory: input.composerLocal.history.length > 0,
  historyCursorActive: input.composerLocal.historyIndex != null,
  mentionResults: input.composerMentionQuery != null ? input.composerMentionResults : [],
  model: input.activeChat.activeComposerHarness.model, notice: input.composerNotice,
  provider: input.activeChat.activeComposerProvider,
  reasoningEffort: input.activeChat.activeComposerHarness.reasoningEffort, sending: input.composerSending,
  metadata: {
    branch: input.gitStatusHook.status?.branch ?? null,
    changedFiles: input.gitStatusHook.status
      ? input.gitStatusHook.status.staged + input.gitStatusHook.status.unstaged + input.gitStatusHook.status.untracked
      : 0,
    provider: input.activeChat.activeComposerProvider,
    repositoryPath: input.workspacePath,
    usage: input.activeChat.activeChatConversation.usage,
  },
});

const composerHandlersFrom = (input: AgentConversationPanelInput) => ({
  onApprovalChange: (mode: AgentComposerSurfaceProps["approvalMode"]) => void input.composerSettingsActions.setApprovalMode(mode),
  onAttachMention: (file: FileTreeNode) => {
    input.composerLocal.setLocalState(input.activeChat.activeComposerHarnessKey, input.composerLocal.draft.replace(/@[^\s@]*$/, ""), input.composerLocal.history);
    void input.composerAttachments.attachWorkspaceFile(file);
  },
  onClearGoal: () => void input.composerSettingsActions.setGoal(""),
  onContextMenu: (event: MouseEvent) => input.contextMenuHost.openContextMenu(event, input.appMenuAssembly.composerContextMenuItems()),
  onDismissNotice: () => input.setComposerNotice(null),
  onDraftChange: (draft: string) => {
    input.composerLocal.setLocalState(input.activeChat.activeComposerHarnessKey, draft, input.composerLocal.history);
    input.composerLocal.setHistoryIndex(null);
  },
  onGoalChange: (goal: string) => void input.composerSettingsActions.setGoal(goal),
  onGoalCommit: () => void input.composerSettingsActions.setGoal(input.activeChat.activeComposerHarness.goal, { log: true }),
  onManageModels: () => input.setSettingsOpen(true),
  onNextHistory: input.composerHistoryNavigation.showNext,
  onOpenAddMenu: input.appMenuAssembly.openComposerAddMenu,
  onPasteImage: () => void input.composerAttachments.pasteImage(),
  onPreviousHistory: input.composerHistoryNavigation.showPrevious,
  onReasoningChange: input.composerSettingsActions.setReasoningEffort,
  onRemoveAttachment: (attachment: ComposerAttachment) => void input.composerAttachments.removeAttachment(attachment),
  onReviewContext: () => void input.composerAttachments.reviewContext(),
  onRuntimeChange: input.composerSettingsActions.setRuntime,
  onStop: () => void input.chatRunControls.stopActiveChatRun(),
  onSubmit: () => void input.composerSurface.submitComposerDraft(),
});

export const agentConversationPanelPropsFrom = (
  input: AgentConversationPanelInput,
): AgentConversationPanelProps => ({
  surfaceMode: input.shellLayout.agentSurfaceMode,
  chat: chatThreadPropsFrom(input),
  composer: { ...composerStateFrom(input), ...composerHandlersFrom(input) } as AgentComposerSurfaceProps,
});
