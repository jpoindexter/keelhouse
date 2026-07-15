import type { AppActionDecision, AppActionDescriptor } from "./appActions";
import { createAppAction } from "./appActions";
import type { LaunchProfile } from "./launchProfiles";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import { buildCreatedTerminalPane } from "./terminalPaneCreate";
import type { ProjectRailStatus } from "./workspaceState";

type TerminalPaneCreateWorkflow = {
  createPane: () => Promise<number>;
  currentPanes: () => ManagedTerminalPane[];
  finalizePane: (panes: ManagedTerminalPane[]) => Promise<unknown>;
  gateAction: (action: AppActionDescriptor) => Promise<AppActionDecision>;
  now: () => number;
  profile: LaunchProfile;
  recordCreated: (pane: ManagedTerminalPane) => void;
  requestedBy: "user" | "agent";
  root: string;
  savedLabel: (slot: number) => string | null;
  setChanging: (changing: boolean) => void;
  setError: (error: string) => void;
  setSessionPanes: (panes: ManagedTerminalPane[], activePaneId: number) => void;
  updateProjectStatus: (status: ProjectRailStatus) => Promise<unknown>;
  updateSessionStatus: (status: ProjectRailStatus) => Promise<unknown>;
};

const completeCreate = async (
  workflow: TerminalPaneCreateWorkflow,
  paneId: number,
) => {
  const existingPanes = workflow.currentPanes();
  const pane = buildCreatedTerminalPane({
    createdAt: workflow.now(),
    existingPanes,
    paneId,
    profile: workflow.profile,
    root: workflow.root,
    savedLabel: workflow.savedLabel(existingPanes.length),
  });
  const nextPanes = [...existingPanes, pane];
  workflow.setSessionPanes(nextPanes, paneId);
  workflow.recordCreated(pane);
  await workflow.finalizePane(nextPanes);
};

const failCreate = async (workflow: TerminalPaneCreateWorkflow, error: unknown) => {
  workflow.setError(String(error));
  await workflow.updateProjectStatus("attention");
  await workflow.updateSessionStatus("attention");
};

export const executeTerminalPaneCreate = async (workflow: TerminalPaneCreateWorkflow) => {
  const decision = await workflow.gateAction(createAppAction({
    kind: "create-pane",
    label: "Create pane",
    target: `${workflow.profile.label} in ${workflow.root}`,
    risk: "medium",
    requestedBy: workflow.requestedBy,
    undoHint: "Close the new pane.",
  }));
  if (decision !== "approved") return false;
  workflow.setChanging(true);
  try {
    await completeCreate(workflow, await workflow.createPane());
    return true;
  } catch (error) {
    await failCreate(workflow, error);
    return false;
  } finally {
    workflow.setChanging(false);
  }
};
