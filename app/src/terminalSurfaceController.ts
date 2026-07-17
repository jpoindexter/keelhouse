import type { AgentActivityEvent } from "./agentActivity";
import type {
  AgentApprovalMode,
  AgentSessionHandle,
  AgentSessionHandleDescriptor,
} from "./agentSessionHandle";
import type { AppActionDecision, AppActionDescriptor } from "./appActions";
import type { LaunchProfile } from "./launchProfiles";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import { createTerminalClipboardActions } from "./terminalClipboardActions";
import type { TerminalPaneProjectStatus } from "./terminalPane";
import { createTerminalPaneActionsController } from "./terminalPaneActionsController";
import { createTerminalProcessActionsController } from "./terminalProcessActionsController";
import type { WorktreeRecord } from "./worktrees";
import type { ProjectRailStatus } from "./workspaceState";

type Ref<T> = { current: T };
type ActivityInput = Pick<AgentActivityEvent, "kind" | "label" | "status">
  & Partial<Pick<AgentActivityEvent, "detail" | "target">>;

export type TerminalSurfaceDeps<TSnapshot, TSelection> = {
  activeAgentDescriptor: () => AgentSessionHandleDescriptor | null;
  activeAgentHandle: () => AgentSessionHandle | null;
  activePane: () => ManagedTerminalPane | null;
  activePaneId: Ref<number | null>;
  activePaneIds: Ref<Record<string, number>>;
  approvalMode: () => AgentApprovalMode;
  closePane: (paneId: number) => Promise<number | null>;
  copyText: (text: string) => Promise<unknown>;
  createPane: (root: string, profile: LaunchProfile) => Promise<number>;
  createWorktree: (root: string, label: string) => Promise<{ branch: string; path: string }>;
  createWorktreePane: (path: string, profile: LaunchProfile, projectRoot: string) => Promise<number>;
  defaultProfile: () => LaunchProfile;
  finalizePane: (root: string, panes: ManagedTerminalPane[], profile: LaunchProfile) => Promise<unknown>;
  focusPane: (paneId: number) => Promise<unknown>;
  gateAction: (
    action: AppActionDescriptor, handle?: AgentSessionHandleDescriptor | null,
  ) => Promise<AppActionDecision>;
  getChanging: () => boolean;
  getPanes: (root: string, sessionId: string) => ManagedTerminalPane[];
  getProjectStatus: (root: string) => ProjectRailStatus;
  getSessionId: (root: string | null) => string | null;
  getWorkspacePath: () => string | null;
  getWorkspacePathOrState: () => string | null;
  getWorktrees: () => WorktreeRecord[];
  intentionallyTerminatedPaneIds: Set<number>;
  latest: Ref<TSnapshot | null>;
  now: () => number;
  paste: (text: string) => Promise<unknown>;
  persistWorktreeRecord: (record: WorktreeRecord) => void;
  persistWorktreeRemoval: (paneId: string) => void;
  promptWorktreeLabel: () => Promise<string | null>;
  readClipboard: () => Promise<string | null>;
  recordActivity: (handle: AgentSessionHandleDescriptor | null, event: ActivityInput) => void;
  recordCreated: (pane: ManagedTerminalPane, root: string, sessionId: string) => void;
  recordCreatedWorktree: (
    pane: ManagedTerminalPane, root: string, sessionId: string, branch: string,
  ) => void;
  removeWorktree: (root: string, worktree: WorktreeRecord) => Promise<unknown>;
  requestPaint: () => void;
  restartPane: (root: string, pane: ManagedTerminalPane) => Promise<number>;
  savedLabel: (root: string, slot: number) => string | null;
  scheduleResize: () => void;
  selection: Ref<TSelection | null>;
  selectionText: (snapshot: TSnapshot, selection: TSelection) => string;
  sendClearKey: () => Promise<unknown>;
  setChanging: (changing: boolean) => void;
  setComposerError: (error: string | null) => void;
  setFocusedPane: (paneId: number) => void;
  setLaunchError: (error: string | null) => void;
  setPaneExited: (paneId: number) => ManagedTerminalPane[];
  setSessionPanes: (
    root: string, sessionId: string, panes: ManagedTerminalPane[], activePaneId: number | null,
  ) => void;
  snapshots: Ref<Record<number, TSnapshot>>;
  statusForPanes: (panes: ManagedTerminalPane[]) => TerminalPaneProjectStatus;
  terminatePane: (paneId: number) => Promise<unknown>;
  updateProjectStatus: (root: string, status: ProjectRailStatus) => Promise<unknown>;
  updateSessionStatus: (root: string, status: ProjectRailStatus) => Promise<unknown>;
};

const wireProcessActions = <TSnapshot, TSelection>(deps: TerminalSurfaceDeps<TSnapshot, TSelection>) =>
  createTerminalProcessActionsController<TSnapshot>({
    approvalMode: deps.approvalMode,
    gateAction: deps.gateAction,
    getActiveDescriptor: deps.activeAgentDescriptor,
    getActiveHandle: deps.activeAgentHandle,
    getActivePane: deps.activePane,
    getChanging: deps.getChanging,
    getPanes: deps.getPanes,
    getProjectStatus: deps.getProjectStatus,
    getSessionId: deps.getSessionId,
    getWorkspacePath: deps.getWorkspacePath,
    intentionallyTerminatedPaneIds: deps.intentionallyTerminatedPaneIds,
    latest: deps.latest,
    now: deps.now,
    recordActivity: deps.recordActivity,
    requestPaint: deps.requestPaint,
    restartPane: deps.restartPane,
    scheduleResize: deps.scheduleResize,
    setChanging: deps.setChanging,
    setComposerError: deps.setComposerError,
    setLaunchError: deps.setLaunchError,
    setPaneExited: deps.setPaneExited,
    setSessionPanes: deps.setSessionPanes,
    snapshots: deps.snapshots,
    statusForPanes: deps.statusForPanes,
    terminatePane: deps.terminatePane,
    updateProjectStatus: deps.updateProjectStatus,
    updateSessionStatus: deps.updateSessionStatus,
  });

const wirePaneActions = <TSnapshot, TSelection>(deps: TerminalSurfaceDeps<TSnapshot, TSelection>) =>
  createTerminalPaneActionsController<TSnapshot, TSelection>({
    activeAgentDescriptor: deps.activeAgentDescriptor(),
    activePaneId: deps.activePaneId,
    activePaneIds: deps.activePaneIds,
    closePane: deps.closePane,
    createPane: deps.createPane,
    createWorktree: deps.createWorktree,
    createWorktreePane: deps.createWorktreePane,
    defaultProfile: deps.defaultProfile,
    finalizePane: deps.finalizePane,
    focusPane: deps.focusPane,
    gateAction: deps.gateAction,
    getChanging: deps.getChanging,
    getPanes: deps.getPanes,
    getProjectStatus: deps.getProjectStatus,
    getSessionId: deps.getSessionId,
    getWorkspacePath: deps.getWorkspacePathOrState,
    getWorktrees: deps.getWorktrees,
    intentionallyTerminatedPaneIds: deps.intentionallyTerminatedPaneIds,
    latest: deps.latest,
    now: deps.now,
    persistWorktreeRecord: deps.persistWorktreeRecord,
    persistWorktreeRemoval: deps.persistWorktreeRemoval,
    promptWorktreeLabel: deps.promptWorktreeLabel,
    recordCreated: deps.recordCreated,
    recordCreatedWorktree: deps.recordCreatedWorktree,
    removeWorktree: deps.removeWorktree,
    requestPaint: deps.requestPaint,
    savedLabel: deps.savedLabel,
    scheduleResize: deps.scheduleResize,
    selection: deps.selection,
    setChanging: deps.setChanging,
    setError: deps.setLaunchError,
    setFocusedPane: deps.setFocusedPane,
    setSessionPanes: deps.setSessionPanes,
    snapshots: deps.snapshots,
    statusForPanes: deps.statusForPanes,
    updateProjectStatus: deps.updateProjectStatus,
    updateSessionStatus: deps.updateSessionStatus,
  });

const wireClipboard = <TSnapshot, TSelection>(deps: TerminalSurfaceDeps<TSnapshot, TSelection>) =>
  createTerminalClipboardActions<TSnapshot, TSelection>({
    copyText: deps.copyText,
    getActivePaneId: () => deps.activePaneId.current,
    getSnapshot: () => deps.latest.current,
    paste: deps.paste,
    readClipboard: deps.readClipboard,
    readTail: async (lines) => deps.activeAgentHandle()?.readTail(lines),
    recordActivity: (event) => deps.recordActivity(deps.activeAgentHandle() ?? null, event),
    selection: deps.selection,
    selectionText: deps.selectionText,
    sendClearKey: deps.sendClearKey,
  });

export const createTerminalSurfaceActions = <TSnapshot, TSelection>(
  deps: TerminalSurfaceDeps<TSnapshot, TSelection>,
) => ({
  ...wirePaneActions(deps),
  ...wireProcessActions(deps),
  ...wireClipboard(deps),
});

type TerminalHookBundle<TSnapshot> = {
  activePaneIdRef: Ref<number | null>;
  activePaneIdsRef: Ref<Record<string, number>>;
  intentionallyTerminatedPaneIdsRef: Ref<Set<number>>;
  panesForSession: (root: string, sessionId: string) => ManagedTerminalPane[];
  projectStatusForRoot: (root: string) => ProjectRailStatus;
  setFocusedPane: (paneId: number) => void;
  setPaneState: (paneId: number, state: "exited", exitCode: number | null) => ManagedTerminalPane[];
  setSessionPanes: (
    root: string, sessionId: string, panes: ManagedTerminalPane[], activePaneId: number | null,
  ) => void;
  snapshotsRef: Ref<Record<number, TSnapshot>>;
  statusForPanes: (panes: ManagedTerminalPane[]) => TerminalPaneProjectStatus;
};

type TerminalHookDerivedKeys =
  | "activePaneId" | "activePaneIds" | "getPanes" | "getProjectStatus"
  | "intentionallyTerminatedPaneIds" | "setFocusedPane" | "setPaneExited"
  | "setSessionPanes" | "snapshots" | "statusForPanes";

export const terminalSurfaceDepsFromHook = <TSnapshot, TSelection>(
  hook: TerminalHookBundle<TSnapshot>,
  rest: Omit<TerminalSurfaceDeps<TSnapshot, TSelection>, TerminalHookDerivedKeys>,
): TerminalSurfaceDeps<TSnapshot, TSelection> => ({
  ...rest,
  activePaneId: hook.activePaneIdRef,
  activePaneIds: hook.activePaneIdsRef,
  getPanes: hook.panesForSession,
  getProjectStatus: hook.projectStatusForRoot,
  intentionallyTerminatedPaneIds: hook.intentionallyTerminatedPaneIdsRef.current,
  setFocusedPane: hook.setFocusedPane,
  setPaneExited: (paneId) => hook.setPaneState(paneId, "exited", null),
  setSessionPanes: hook.setSessionPanes,
  snapshots: hook.snapshotsRef,
  statusForPanes: hook.statusForPanes,
});
