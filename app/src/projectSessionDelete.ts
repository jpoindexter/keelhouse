import type { ProjectSessionDeletePlan } from "./deleteProjectSessionPlan";
import type { ActiveSessionByProject, ProjectSessionsByProject } from "./workspaceState";

type ReadyProjectSessionDeletePlan = Extract<ProjectSessionDeletePlan, { canDelete: true }>;

type ProjectSessionDeleteWorkflow = {
  closeTerminalPanes: () => Promise<unknown>;
  confirmDelete: (message: string) => Promise<boolean>;
  deleteHistory: () => Promise<unknown>;
  plan: ReadyProjectSessionDeletePlan;
  persistSessions: (
    sessions: ProjectSessionsByProject,
    activeSessions: ActiveSessionByProject,
  ) => Promise<unknown>;
  removePersistedRestore: () => void;
  removeScopedRecords: () => Promise<unknown>;
  reopenActiveWorkspace: () => Promise<unknown>;
  title: string;
};

type ProjectSessionDeleteResult =
  | { status: "cancelled" }
  | { status: "deleted" }
  | { message: string; status: "failed" };

export const executeProjectSessionDelete = async ({
  closeTerminalPanes,
  confirmDelete,
  deleteHistory,
  plan,
  persistSessions,
  removePersistedRestore,
  removeScopedRecords,
  reopenActiveWorkspace,
  title,
}: ProjectSessionDeleteWorkflow): Promise<ProjectSessionDeleteResult> => {
  const confirmed = await confirmDelete(
    `Delete chat "${title}"? Its messages and saved workspace context will be removed.`,
  );
  if (!confirmed) return { status: "cancelled" };
  try {
    await closeTerminalPanes();
  } catch (error) {
    return { message: `Could not close this chat's terminal panes: ${String(error)}`, status: "failed" };
  }
  try {
    await deleteHistory();
  } catch (error) {
    return { message: `Could not delete this chat's history: ${String(error)}`, status: "failed" };
  }
  removePersistedRestore();
  await removeScopedRecords();
  await persistSessions(plan.nextSessions, plan.nextActiveSessions);
  if (plan.shouldReopenActiveWorkspace) await reopenActiveWorkspace();
  return { status: "deleted" };
};
