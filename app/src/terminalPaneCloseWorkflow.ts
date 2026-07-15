import type { AppActionDecision, AppActionDescriptor } from "./appActions";
import { createAppAction } from "./appActions";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import { terminalPaneLabelForDisplay, type TerminalPaneProjectStatus } from "./terminalPane";
import type { ProjectRailStatus } from "./workspaceState";

type TerminalPaneCloseWorkflow = {
  clearPaneSnapshot: (paneId: number) => void;
  closePane: (paneId: number) => Promise<number | null>;
  currentPanes: () => ManagedTerminalPane[];
  focusPane: (paneId: number) => Promise<unknown>;
  gateAction: (action: AppActionDescriptor) => Promise<AppActionDecision>;
  markIntentionallyTerminated: (paneId: number) => void;
  pane: ManagedTerminalPane;
  projectStatus: () => ProjectRailStatus;
  requestPaint: () => void;
  scheduleResize: () => void;
  sessionStatus: (panes: ManagedTerminalPane[]) => TerminalPaneProjectStatus;
  setError: (error: string | null) => void;
  setLatestSnapshot: (paneId: number | null) => void;
  setSessionPanes: (panes: ManagedTerminalPane[], activePaneId: number | null) => void;
  unmarkIntentionallyTerminated: (paneId: number) => void;
  updateProjectStatus: (status: ProjectRailStatus) => Promise<unknown>;
  updateSessionStatus: (status: ProjectRailStatus) => Promise<unknown>;
};

const closeBackendPane = async (workflow: TerminalPaneCloseWorkflow) => {
  workflow.markIntentionallyTerminated(workflow.pane.id);
  try {
    return await workflow.closePane(workflow.pane.id);
  } catch (error) {
    workflow.unmarkIntentionallyTerminated(workflow.pane.id);
    throw error;
  }
};

const completeClose = async (
  workflow: TerminalPaneCloseWorkflow,
  backendActivePaneId: number | null,
) => {
  const remaining = workflow.currentPanes().filter((pane) => pane.id !== workflow.pane.id);
  const nextActive = backendActivePaneId != null && remaining.some((pane) => pane.id === backendActivePaneId)
    ? backendActivePaneId
    : remaining[0]?.id ?? null;
  workflow.clearPaneSnapshot(workflow.pane.id);
  workflow.setSessionPanes(remaining, nextActive);
  if (nextActive != null) await workflow.focusPane(nextActive);
  workflow.setLatestSnapshot(nextActive);
  workflow.requestPaint();
  workflow.setError(null);
  await workflow.updateProjectStatus(workflow.projectStatus());
  await workflow.updateSessionStatus(workflow.sessionStatus(remaining));
  if (nextActive != null) workflow.scheduleResize();
};

const failClose = async (workflow: TerminalPaneCloseWorkflow, error: unknown) => {
  workflow.setError(String(error));
  await workflow.updateProjectStatus("attention");
  await workflow.updateSessionStatus("attention");
};

export const executeTerminalPaneClose = async (workflow: TerminalPaneCloseWorkflow) => {
  const label = terminalPaneLabelForDisplay(
    workflow.pane.label, workflow.pane.profile.label, workflow.pane.slot,
  );
  const decision = await workflow.gateAction(createAppAction({
    kind: "close-pane",
    label: "Close pane",
    target: label,
    risk: "destructive",
    requestedBy: "user",
    undoHint: "Create a new pane from the same profile; live process state is not recoverable.",
  }));
  if (decision !== "approved") return false;
  try {
    await completeClose(workflow, await closeBackendPane(workflow));
    return true;
  } catch (error) {
    await failClose(workflow, error);
    return false;
  }
};
