import { isMissingWorkspaceError, type ActiveSessionByProject, type OpenProject, type ProjectSessionsByProject } from "./workspaceState";
import { planWorkspaceOpenFailure } from "./workspaceOpenFailure";
import { planMissingWorkspaceCleanup } from "./workspaceOpenRecovery";

export type WorkspaceOpenFailureState<TProjectPanes, TActivePane, THarness, TConversation, TEditorSnapshot, TPaneLayout> = {
  activePanes: Record<string, TActivePane>;
  activeSessions: ActiveSessionByProject;
  browserProjects: Record<string, string>;
  browserSessions: Record<string, string>;
  conversations: Record<string, TConversation>;
  editorSnapshots: Record<string, TEditorSnapshot>;
  harnessRecords: Record<string, THarness>;
  openProjects: OpenProject[];
  paneLayouts: Record<string, TPaneLayout>;
  projectPanes: Record<string, TProjectPanes>;
  recentProjects: string[];
  sessions: ProjectSessionsByProject;
};

type MissingCleanup<TProjectPanes, TActivePane, THarness, TConversation, TEditorSnapshot, TPaneLayout> =
  WorkspaceOpenFailureState<TProjectPanes, TActivePane, THarness, TConversation, TEditorSnapshot, TPaneLayout>;

type FailurePlan = Pick<WorkspaceOpenFailureState<never, never, never, never, never, never>,
  "activeSessions" | "openProjects" | "sessions">;

type WorkspaceOpenFailureInput<TProjectPanes, TActivePane, THarness, TConversation, TEditorSnapshot, TPaneLayout> = {
  applyFailure: (plan: FailurePlan) => void;
  applyMissingCleanup: (cleanup: MissingCleanup<TProjectPanes, TActivePane, THarness, TConversation, TEditorSnapshot, TPaneLayout>) => void;
  message: string;
  now: number;
  path: string;
  persistFailure: (plan: FailurePlan) => Promise<unknown>;
  persistMissingCleanup: (cleanup: MissingCleanup<TProjectPanes, TActivePane, THarness, TConversation, TEditorSnapshot, TPaneLayout>) => Promise<unknown>;
  state: WorkspaceOpenFailureState<TProjectPanes, TActivePane, THarness, TConversation, TEditorSnapshot, TPaneLayout>;
};

export const executeWorkspaceOpenFailure = async <TProjectPanes, TActivePane, THarness, TConversation, TEditorSnapshot, TPaneLayout>(
  input: WorkspaceOpenFailureInput<TProjectPanes, TActivePane, THarness, TConversation, TEditorSnapshot, TPaneLayout>,
) => {
  if (isMissingWorkspaceError(input.message)) {
    const cleanup = planMissingWorkspaceCleanup({ path: input.path, ...input.state });
    input.applyMissingCleanup(cleanup);
    await input.persistMissingCleanup(cleanup);
    return "missing" as const;
  }
  const failure = planWorkspaceOpenFailure({
    activeSessions: input.state.activeSessions,
    now: input.now,
    openProjects: input.state.openProjects,
    path: input.path,
    sessions: input.state.sessions,
  });
  input.applyFailure(failure);
  await input.persistFailure(failure);
  return "failed" as const;
};
