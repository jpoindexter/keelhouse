import { addBackgroundExit, type BackgroundExit } from "./backgroundExits";
import type { AgentApprovalMode, AgentSessionHandleDescriptor } from "./agentSessionHandle";
import { buildAgentSessionHandleDescriptor } from "./agentSessionHandle";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import { planPaneExit, type PaneExitActivity } from "./paneExitPlan";
import { terminalPaneLabelForDisplay, type TerminalPaneProjectStatus } from "./terminalPane";

type Ref<T> = { current: T };

export type TerminalGridPayload<TSnapshot> = { paneId: number; snapshot: TSnapshot };
export type TerminalPaneExitPayload = {
  paneId: number; command: string; code: number; message: string;
};

type TerminalRuntimeEventHandlerOptions<TSnapshot, TRenderPerf> = {
  activePaneId: Ref<number | null>;
  activeSessionForProject: (root: string | null) => string | null;
  approvalMode: AgentApprovalMode;
  contextForPaneId: (paneId: number) => { projectRoot: string; sessionId: string } | null;
  detectLocalServer: (paneId: number, snapshot: TSnapshot) => void;
  intentionallyTerminatedPaneIds: Set<number>;
  ipcSampleCounter: Ref<number>;
  latest: Ref<TSnapshot | null>;
  notificationsEnabled: Ref<boolean>;
  notifyBackgroundExit: (exit: BackgroundExit) => Promise<unknown>;
  now: () => number;
  persistTranscript: (
    root: string, sessionId: string, pane: ManagedTerminalPane,
    paneIndex: number, text: string, timestamp: number,
  ) => void;
  projectStatus: (root: string | null) => TerminalPaneProjectStatus;
  recordActivity: (
    handle: AgentSessionHandleDescriptor,
    event: PaneExitActivity & { outputRef: string; target: string },
  ) => void;
  recordIpcPayload: (perf: TRenderPerf, bytes: number) => void;
  renderPerf: Ref<TRenderPerf>;
  requestPaint: () => void;
  setBackgroundExits: (update: (exits: BackgroundExit[]) => BackgroundExit[]) => void;
  setError: (message: string) => void;
  setPaneState: (paneId: number, state: "exited", exitCode: number) => ManagedTerminalPane[];
  snapshotText: (snapshot: TSnapshot) => string;
  snapshots: Ref<Record<number, TSnapshot>>;
  updateProjectStatus: (root: string | null, status: TerminalPaneProjectStatus) => Promise<unknown>;
  updateSessionStatus: (
    root: string | null, sessionId: string | null, status: TerminalPaneProjectStatus,
  ) => Promise<unknown>;
  workspacePath: Ref<string | null>;
};

const handleGrid = <TSnapshot, TRenderPerf>(
  options: TerminalRuntimeEventHandlerOptions<TSnapshot, TRenderPerf>,
  payload: TerminalGridPayload<TSnapshot>,
) => {
  options.ipcSampleCounter.current += 1;
  if (options.ipcSampleCounter.current % 20 === 0) {
    options.recordIpcPayload(options.renderPerf.current, JSON.stringify(payload).length);
  }
  options.snapshots.current[payload.paneId] = payload.snapshot;
  options.detectLocalServer(payload.paneId, payload.snapshot);
  if (payload.paneId !== options.activePaneId.current) return;
  options.latest.current = payload.snapshot;
  options.requestPaint();
};

const recordExitActivity = <TSnapshot, TRenderPerf>(
  options: TerminalRuntimeEventHandlerOptions<TSnapshot, TRenderPerf>,
  plan: ReturnType<typeof planPaneExit>,
) => {
  if (!plan.root || !plan.sessionId || !plan.pane) return;
  options.recordActivity(buildAgentSessionHandleDescriptor({
    pane: plan.pane, projectId: plan.root, projectSessionId: plan.sessionId,
    label: terminalPaneLabelForDisplay(plan.pane.label, plan.pane.profile.label, plan.paneIndex),
    approvalMode: options.approvalMode,
  }), { ...plan.activity, target: plan.root, outputRef: "terminal" });
};

const persistExitTranscript = <TSnapshot, TRenderPerf>(
  options: TerminalRuntimeEventHandlerOptions<TSnapshot, TRenderPerf>,
  plan: ReturnType<typeof planPaneExit>, paneId: number,
) => {
  if (!plan.root || !plan.sessionId || !plan.pane) return;
  const snapshot = options.snapshots.current[paneId];
  if (snapshot) options.persistTranscript(
    plan.root, plan.sessionId, plan.pane, plan.paneIndex,
    options.snapshotText(snapshot), options.now(),
  );
};

const reportBackgroundExit = <TSnapshot, TRenderPerf>(
  options: TerminalRuntimeEventHandlerOptions<TSnapshot, TRenderPerf>, exit: BackgroundExit | null,
) => {
  if (!exit) return;
  options.setBackgroundExits((exits) => addBackgroundExit(exits, exit));
  if (options.notificationsEnabled.current) void options.notifyBackgroundExit(exit).catch(() => {});
};

const handleExit = <TSnapshot, TRenderPerf>(
  options: TerminalRuntimeEventHandlerOptions<TSnapshot, TRenderPerf>, payload: TerminalPaneExitPayload,
) => {
  const context = options.contextForPaneId(payload.paneId);
  const root = context?.projectRoot ?? options.workspacePath.current;
  const sessionId = context?.sessionId ?? options.activeSessionForProject(root);
  const plan = planPaneExit({
    ...payload,
    intentionallyTerminated: options.intentionallyTerminatedPaneIds.delete(payload.paneId),
    contextRoot: root, contextSessionId: sessionId, workspaceRoot: options.workspacePath.current,
    activePaneId: options.activePaneId.current,
    activeSessionId: options.activeSessionForProject(root),
    panes: options.setPaneState(payload.paneId, "exited", payload.code),
  });
  recordExitActivity(options, plan);
  if (plan.showLaunchError) options.setError(plan.launchError);
  void options.updateProjectStatus(plan.root, options.projectStatus(plan.root));
  void options.updateSessionStatus(plan.root, plan.sessionId, plan.status);
  persistExitTranscript(options, plan, payload.paneId);
  reportBackgroundExit(options, plan.backgroundExit);
};

export const createTerminalRuntimeEventHandlers = <TSnapshot, TRenderPerf>(
  options: TerminalRuntimeEventHandlerOptions<TSnapshot, TRenderPerf>,
) => ({
  handleGridPayload: (payload: TerminalGridPayload<TSnapshot>) => handleGrid(options, payload),
  handlePaneExit: (payload: TerminalPaneExitPayload) => handleExit(options, payload),
});
