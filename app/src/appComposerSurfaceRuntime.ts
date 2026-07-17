import { invoke } from "@tauri-apps/api/core";
import type { AgentApprovalMode, AgentSessionHandle } from "./agentSessionHandle";
import { createChatRunControls } from "./chatRunControls";
import { chatProviderLabel, type ChatProvider } from "./chatConversation";
import type { createChatConversationActions } from "./chatConversationActions";
import { createComposerHistoryNavigation } from "./composerHistoryNavigation";
import type { createComposerHarnessEventLog } from "./composerHarnessEvents";
import { composerReasoningLabel } from "./ComposerReasoningPicker";
import { createComposerSettingsActions } from "./composerSettingsActions";
import { createComposerSurface } from "./composerSurfaceController";
import type { AiConnectionSettings } from "./connectionSettings";
import type { createProjectSessionMetadataActions } from "./projectSessionMetadataActions";
import type { createTerminalSurfaceActions } from "./terminalSurfaceController";
import type { useAppShellDomain } from "./useAppShellDomain";
import type { useComposerRuntime } from "./useComposerRuntime";
import type { useConversationRuntime } from "./useConversationRuntime";
import type { useWorkspaceDomain } from "./useWorkspaceDomain";
import type { createWorkspacePicker } from "./workspacePicker";

type Cell = { t: string; f: [number, number, number]; b: [number, number, number]; bold: boolean };
type Snapshot = {
  cols: number; rows: number; cx: number; cy: number; cvis: boolean; sb: number; cells: Cell[];
};
type AppShell = ReturnType<typeof useAppShellDomain>;
type ComposerRuntime = ReturnType<typeof useComposerRuntime>;
type Conversation = ReturnType<typeof useConversationRuntime>;
type Workspace = ReturnType<typeof useWorkspaceDomain<Snapshot>>;

type ComposerSurfaceRuntimeInput = {
  activeChat: Conversation["activeChat"];
  agentActivityHook: Conversation["agentActivityHook"];
  chatConversationActions: ReturnType<typeof createChatConversationActions>;
  chatIdForSession: (root: string, sessionId: string) => string;
  composerLocal: ComposerRuntime["composerLocal"];
  composerSending: boolean;
  composerWorkspace: Workspace["composerWorkspace"];
  editorSession: Workspace["editorSession"];
  getActiveHandle: () => AgentSessionHandle | null;
  getEditorSurface: () => { openEditorSearch: () => void };
  getSaveEditorFile: () => () => Promise<boolean>;
  getTerminalLabel: () => string | null;
  getTerminalSurface: () => ReturnType<typeof createTerminalSurfaceActions>;
  logComposerHarnessEvent: ReturnType<typeof createComposerHarnessEventLog>;
  pickWorkspace: ReturnType<typeof createWorkspacePicker>;
  profiles: Workspace["profiles"];
  projectSessionMetadata: ReturnType<typeof createProjectSessionMetadataActions>;
  settingsRef: { current: AiConnectionSettings };
  setComposerError: AppShell["setComposerError"];
  setActionNotice: AppShell["chrome"]["setActionNotice"];
  setComposerNotice: AppShell["setComposerNotice"];
  setComposerSending: AppShell["setComposerSending"];
  setOrchestrationError: AppShell["setOrchestrationError"];
  setOrchestrationLaunching: AppShell["setOrchestrationLaunching"];
  setOrchestrationOpen: AppShell["setOrchestrationOpen"];
  workspacePathRef: { current: string | null };
  persistence: Workspace["persistence"];
};

const composerSurfaceFrom = (input: ComposerSurfaceRuntimeInput) => createComposerSurface({
  chatIdForSession: input.chatIdForSession,
  clearTerminal: () => input.getTerminalSurface().clearActiveTerminal(),
  gateAction: (action) => input.agentActivityHook.gateAppAction(action, input.getActiveHandle()),
  getActiveConversation: () => input.activeChat.activeChatConversation,
  getActiveProvider: () => input.activeChat.activeComposerProvider,
  getActiveSessionId: () => input.activeChat.activeSessionId,
  getActiveSessions: () => input.persistence.activeSessionByProjectRef.current,
  getChatId: () => input.activeChat.activeComposerHarnessKey,
  getComposerDraft: () => input.composerLocal.draft,
  getComposerHistory: () => input.composerLocal.history,
  getComposerSending: () => input.composerSending,
  getConversations: () => input.composerWorkspace.chatConversationsRef.current,
  getHarness: () => input.activeChat.activeComposerHarness,
  getHarnessRecords: () => input.composerWorkspace.composerHarnessBySessionRef.current,
  getSelectedFilePath: () => input.editorSession.selectedFile?.path ?? null,
  getSessions: () => input.persistence.projectSessionsRef.current,
  getSettings: () => input.settingsRef.current,
  getTerminalLabel: input.getTerminalLabel,
  getWorkspacePath: () => input.workspacePathRef.current,
  now: Date.now,
  openSearch: () => input.getEditorSurface().openEditorSearch(),
  orchestrationGateAction: input.agentActivityHook.gateAppAction,
  persistHarnessRecords: input.composerWorkspace.persistComposerHarnessRecords,
  persistSessions: input.persistence.persistProjectSessions,
  pickWorkspace: input.pickWorkspace,
  recordActivity: (event) => input.agentActivityHook.recordAgentActivity(input.getActiveHandle(), event),
  removeWorktree: (worktree) => invoke("remove_project_worktree", worktree),
  replaceConversations: input.composerWorkspace.setChatConversations,
  resolveProfileLabel: (id) => input.profiles.resolveProfile(id).label,
  saveFile: () => input.getSaveEditorFile()(),
  setActionNotice: input.setActionNotice,
  setComposerError: input.setComposerError,
  setComposerHistoryIndex: input.composerLocal.setHistoryIndex,
  setComposerLocalState: input.composerLocal.setLocalState,
  setComposerNotice: input.setComposerNotice,
  setComposerSending: input.setComposerSending,
  setOrchestrationError: input.setOrchestrationError,
  setOrchestrationLaunching: input.setOrchestrationLaunching,
  setOrchestrationOpen: input.setOrchestrationOpen,
  stopRun: (runId) => invoke("stop_chat_run", { runId }),
  updateConversation: input.chatConversationActions.updateConversation,
  updateHarness: input.composerLocal.updateHarness,
  updateSessionMetadata: (root, sessionId, orchestration) =>
    input.projectSessionMetadata.updateSessionMetadata(root, sessionId, { orchestration }),
});

const chatRunControlsFrom = (input: ComposerSurfaceRuntimeInput) => createChatRunControls({
  getActiveRunId: () => input.activeChat.activeChatConversation.activeRunId,
  respondApproval: ({ decision, requestId, runId }) =>
    invoke("respond_chat_approval", { runId, requestId, decision }),
  setError: input.setComposerError,
  stopRun: (runId) => invoke("stop_chat_run", { runId }),
});

const composerHistoryFrom = (input: ComposerSurfaceRuntimeInput) => createComposerHistoryNavigation({
  getChatId: () => input.activeChat.activeComposerHarnessKey,
  getHistory: () => input.composerLocal.history,
  getHistoryIndex: () => input.composerLocal.historyIndex,
  setHistoryIndex: input.composerLocal.setHistoryIndex,
  setLocalState: input.composerLocal.setLocalState,
});

const composerSettingsFrom = (input: ComposerSurfaceRuntimeInput) => createComposerSettingsActions({
  getRuntimeState: () => ({
    activeRunId: input.activeChat.activeChatConversation.activeRunId,
    chatId: input.activeChat.activeComposerHarnessKey,
    provider: input.activeChat.activeComposerProvider,
  }),
  labelProvider: chatProviderLabel,
  labelReasoning: composerReasoningLabel,
  logEvent: input.logComposerHarnessEvent,
  now: Date.now,
  updateConversation: input.chatConversationActions.updateConversation,
  updateHarness: input.composerLocal.updateHarness,
  updateScopedSetting: (key, value) => key === "approvalMode"
    ? input.composerWorkspace.updateScopedSetting("chat", "approvalMode", value as AgentApprovalMode)
    : input.composerWorkspace.updateScopedSetting("chat", "agentProfileId", value as ChatProvider),
});

export const appComposerSurfaceRuntimeFrom = (input: ComposerSurfaceRuntimeInput) => ({
  chatRunControls: chatRunControlsFrom(input),
  composerHistoryNavigation: composerHistoryFrom(input),
  composerSettingsActions: composerSettingsFrom(input),
  composerSurface: composerSurfaceFrom(input),
});
