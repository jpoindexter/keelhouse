import type { AppActionDecision, AppActionDescriptor } from "./appActions";
import { createAppAction } from "./appActions";
import type { LaunchProfile } from "./launchProfiles";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import { buildCreatedWorktreePaneState } from "./terminalWorktreePaneCreate";
import type { WorktreeRecord } from "./worktrees";
import type { ProjectRailStatus } from "./workspaceState";

type CreatedWorktree = { branch: string; path: string };

type TerminalWorktreePaneCreateWorkflow = {
  createPane: (path: string, profile: LaunchProfile) => Promise<number>;
  createWorktree: (label: string) => Promise<CreatedWorktree>;
  currentPanes: () => ManagedTerminalPane[];
  finalizePane: (panes: ManagedTerminalPane[]) => Promise<unknown>;
  gateAction: (action: AppActionDescriptor) => Promise<AppActionDecision>;
  now: () => number;
  persistRecord: (record: WorktreeRecord) => void;
  profile: LaunchProfile;
  projectRoot: string;
  promptLabel: () => string | null;
  recordCreated: (pane: ManagedTerminalPane, branch: string) => void;
  setChanging: (changing: boolean) => void;
  setError: (error: string) => void;
  setSessionPanes: (panes: ManagedTerminalPane[], activePaneId: number) => void;
  updateProjectStatus: (status: ProjectRailStatus) => Promise<unknown>;
  updateSessionStatus: (status: ProjectRailStatus) => Promise<unknown>;
};

const completeCreate = async (
  workflow: TerminalWorktreePaneCreateWorkflow,
  label: string,
) => {
  const worktree = await workflow.createWorktree(label);
  const paneId = await workflow.createPane(worktree.path, workflow.profile);
  const existingPanes = workflow.currentPanes();
  const { pane, record } = buildCreatedWorktreePaneState({
    branch: worktree.branch,
    createdAt: workflow.now(),
    existingPanes,
    label,
    paneId,
    path: worktree.path,
    profile: workflow.profile,
    projectRoot: workflow.projectRoot,
  });
  const panes = [...existingPanes, pane];
  workflow.setSessionPanes(panes, paneId);
  workflow.persistRecord(record);
  workflow.recordCreated(pane, worktree.branch);
  await workflow.finalizePane(panes);
};

const failCreate = async (workflow: TerminalWorktreePaneCreateWorkflow, error: unknown) => {
  workflow.setError(String(error));
  await workflow.updateProjectStatus("attention");
  await workflow.updateSessionStatus("attention");
};

export const executeTerminalWorktreePaneCreate = async (
  workflow: TerminalWorktreePaneCreateWorkflow,
) => {
  const label = workflow.promptLabel()?.trim();
  if (!label) return false;
  const decision = await workflow.gateAction(createAppAction({
    kind: "create-worktree",
    label: "Create worktree",
    requestedBy: "user",
    risk: "medium",
    target: `${label} in ${workflow.projectRoot}`,
    undoHint: "Remove the worktree from the pane's context menu.",
  }));
  if (decision !== "approved") return false;
  workflow.setChanging(true);
  try {
    await completeCreate(workflow, label);
    return true;
  } catch (error) {
    await failCreate(workflow, error);
    return false;
  } finally {
    workflow.setChanging(false);
  }
};
