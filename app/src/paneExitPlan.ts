import { isBackgroundExit, type BackgroundExit } from "./backgroundExits";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import {
  terminalPaneLabelForDisplay,
  terminalPaneProjectStatus,
  type TerminalPaneProjectStatus,
} from "./terminalPane";

type PaneExitPlanInput = {
  paneId: number;
  command: string;
  code: number;
  message: string;
  intentionallyTerminated: boolean;
  contextRoot: string | null;
  contextSessionId: string | null;
  workspaceRoot: string | null;
  activePaneId: number | null;
  activeSessionId: string | null;
  panes: ManagedTerminalPane[];
};

export type PaneExitActivity = {
  label: string;
  status: "exited" | "complete" | "error";
  kind: "process" | "command";
  detail: string;
  exitCode: number;
};

export type PaneExitPlan = {
  root: string | null;
  sessionId: string | null;
  pane: ManagedTerminalPane | null;
  paneIndex: number;
  status: TerminalPaneProjectStatus;
  activity: PaneExitActivity;
  showLaunchError: boolean;
  launchError: string;
  backgroundExit: BackgroundExit | null;
};

const activityForExit = (input: PaneExitPlanInput): PaneExitActivity => ({
  kind: input.intentionallyTerminated ? "process" : "command",
  label: input.intentionallyTerminated
    ? "Process terminated"
    : input.code === 0 ? "Command finished" : "Command failed",
  detail: input.command,
  exitCode: input.code,
  status: input.intentionallyTerminated ? "exited" : input.code === 0 ? "complete" : "error",
});

export const planPaneExit = (input: PaneExitPlanInput): PaneExitPlan => {
  const paneIndex = input.panes.findIndex((pane) => pane.id === input.paneId);
  const pane = paneIndex >= 0 ? input.panes[paneIndex] : null;
  const exitedInBackground = Boolean(input.contextRoot) && (
    isBackgroundExit(input.contextRoot!, input.workspaceRoot)
    || input.contextSessionId !== input.activeSessionId
  );
  const backgroundExit = !input.intentionallyTerminated && input.contextRoot && exitedInBackground
    ? {
        paneId: String(input.paneId),
        projectPath: input.contextRoot,
        label: pane ? terminalPaneLabelForDisplay(pane.label, pane.profile.label, paneIndex) : "Agent",
        failed: input.code !== 0,
      }
    : null;
  return {
    root: input.contextRoot,
    sessionId: input.contextSessionId,
    pane,
    paneIndex,
    status: terminalPaneProjectStatus(input.panes),
    activity: activityForExit(input),
    showLaunchError: !input.intentionallyTerminated && input.paneId === input.activePaneId,
    launchError: input.message,
    backgroundExit,
  };
};
