import type { BrowserPreviewRecords } from "./browserPreview";
import type { ChatConversationRecords } from "./chatConversation";
import type { ComposerHarnessRecords } from "./composerHarness";
import { planProjectSessionDelete, type ProjectSessionDeletePlan } from "./deleteProjectSessionPlan";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import { executeProjectSessionDelete } from "./projectSessionDelete";
import { planSessionScopedRecordRemoval } from "./sessionScopedRecords";
import { applyWorkspaceCleanupRecord } from "./workspaceOpenRecovery";
import type {
  ActiveSessionByProject, ProjectSession, ProjectSessionsByProject,
} from "./workspaceState";

type Ref<T> = { current: T };
type ReadyDeletePlan = Extract<ProjectSessionDeletePlan, { canDelete: true }>;

type ProjectSessionDeletionControllerOptions<TSnapshot> = {
  activePanes: Ref<Record<string, number>>;
  activeSessionId: string | null;
  activeSessions: Ref<ActiveSessionByProject>;
  browserSessions: Ref<BrowserPreviewRecords>;
  closePane: (paneId: number) => Promise<unknown>;
  composerHarness: Ref<ComposerHarnessRecords>;
  confirmDelete: (message: string) => Promise<boolean>;
  conversations: Ref<ChatConversationRecords>;
  deleteHistory: (key: string) => Promise<unknown>;
  getPanes: (projectPath: string, sessionId: string) => ManagedTerminalPane[];
  intentionallyTerminatedPaneIds: Set<number>;
  persistBrowserSessions: (records: BrowserPreviewRecords) => Promise<unknown>;
  persistComposerHarness: (records: ComposerHarnessRecords) => Promise<unknown>;
  persistSessions: (
    sessions: ProjectSessionsByProject, activeSessions: ActiveSessionByProject,
  ) => Promise<unknown>;
  projectPanes: Ref<Record<string, ManagedTerminalPane[]>>;
  removePersistedRestore: (projectPath: string, sessionId: string) => void;
  reopenActiveWorkspace: (projectPath: string) => Promise<unknown>;
  sessions: Ref<ProjectSessionsByProject>;
  setBrowserSessions: (records: BrowserPreviewRecords) => void;
  setConversations: (records: ChatConversationRecords) => void;
  setError: (message: string) => void;
  snapshots: Ref<Record<number, TSnapshot>>;
  workspacePath: Ref<string | null>;
};

const closePanes = async <TSnapshot>(
  options: ProjectSessionDeletionControllerOptions<TSnapshot>, projectPath: string, sessionId: string,
) => {
  for (const pane of options.getPanes(projectPath, sessionId)) {
    options.intentionallyTerminatedPaneIds.add(pane.id);
    try {
      await options.closePane(pane.id);
    } catch (error) {
      options.intentionallyTerminatedPaneIds.delete(pane.id);
      throw error;
    }
    delete options.snapshots.current[pane.id];
  }
};

const removeScopedRecords = async <TSnapshot>(
  options: ProjectSessionDeletionControllerOptions<TSnapshot>, plan: ReadyDeletePlan,
) => {
  const removed = planSessionScopedRecordRemoval({
    activePanes: options.activePanes.current,
    browserSessionKey: plan.browserSessionKey, browserSessions: options.browserSessions.current,
    chatSessionKey: plan.chatSessionKey, composerHarness: options.composerHarness.current,
    contextKey: plan.contextKey, conversations: options.conversations.current,
    projectPanes: options.projectPanes.current,
  });
  applyWorkspaceCleanupRecord(options.activePanes, removed.activePanes);
  applyWorkspaceCleanupRecord(options.projectPanes, removed.projectPanes);
  applyWorkspaceCleanupRecord(options.browserSessions, removed.browserSessions, options.setBrowserSessions);
  applyWorkspaceCleanupRecord(options.conversations, removed.conversations, options.setConversations);
  await options.persistBrowserSessions(removed.browserSessions);
  await options.persistComposerHarness(removed.composerHarness);
};

const deleteSession = async <TSnapshot>(
  options: ProjectSessionDeletionControllerOptions<TSnapshot>, projectPath: string, session: ProjectSession,
) => {
  const plan = planProjectSessionDelete({
    activeSessionByProject: options.activeSessions.current,
    activeSessionId: options.activeSessionId,
    activeWorkspacePath: options.workspacePath.current,
    projectPath, projectSessions: options.sessions.current, sessionId: session.id,
  });
  if (!plan.canDelete) return;
  const result = await executeProjectSessionDelete({
    closeTerminalPanes: () => closePanes(options, projectPath, session.id),
    confirmDelete: options.confirmDelete,
    deleteHistory: () => options.deleteHistory(plan.chatSessionKey),
    persistSessions: options.persistSessions, plan,
    removePersistedRestore: () => options.removePersistedRestore(projectPath, session.id),
    removeScopedRecords: () => removeScopedRecords(options, plan),
    reopenActiveWorkspace: () => options.reopenActiveWorkspace(projectPath),
    title: session.title,
  });
  if (result.status === "failed") options.setError(result.message);
};

export const createProjectSessionDeletionController = <TSnapshot>(
  options: ProjectSessionDeletionControllerOptions<TSnapshot>,
) => ({
  deleteProjectSession: (projectPath: string, session: ProjectSession) =>
    deleteSession(options, projectPath, session),
});
