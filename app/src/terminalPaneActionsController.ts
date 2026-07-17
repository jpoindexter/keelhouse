import type { AppActionDecision, AppActionDescriptor } from "./appActions";
import type { AgentSessionHandleDescriptor } from "./agentSessionHandle";
import type { LaunchProfile } from "./launchProfiles";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import { paneContextKey } from "./paneOwnership";
import { executeTerminalPaneClose } from "./terminalPaneCloseWorkflow";
import { executeTerminalPaneCreate } from "./terminalPaneCreateWorkflow";
import { executeTerminalPaneFocus } from "./terminalPaneFocusWorkflow";
import type { TerminalPaneProjectStatus } from "./terminalPane";
import { executeTerminalWorktreePaneClose } from "./terminalWorktreePaneCloseWorkflow";
import { executeTerminalWorktreePaneCreate } from "./terminalWorktreePaneCreateWorkflow";
import { worktreeForPaneId, type WorktreeRecord } from "./worktrees";
import type { ProjectRailStatus } from "./workspaceState";

type Ref<T> = { current: T };
type RequestedBy = "user" | "agent";

type TerminalPaneActionsControllerOptions<TSnapshot, TSelection> = {
  activeAgentDescriptor: AgentSessionHandleDescriptor | null;
  activePaneId: Ref<number | null>;
  activePaneIds: Ref<Record<string, number>>;
  closePane: (paneId: number) => Promise<number | null>;
  createPane: (root: string, profile: LaunchProfile) => Promise<number>;
  createWorktree: (root: string, label: string) => Promise<{ branch: string; path: string }>;
  createWorktreePane: (
    path: string, profile: LaunchProfile, projectRoot: string,
  ) => Promise<number>;
  defaultProfile: () => LaunchProfile;
  finalizePane: (
    root: string, panes: ManagedTerminalPane[], profile: LaunchProfile,
  ) => Promise<unknown>;
  focusPane: (paneId: number) => Promise<unknown>;
  gateAction: (
    action: AppActionDescriptor, handle?: AgentSessionHandleDescriptor | null,
  ) => Promise<AppActionDecision>;
  getChanging: () => boolean;
  getPanes: (root: string, sessionId: string) => ManagedTerminalPane[];
  getProjectStatus: (root: string) => ProjectRailStatus;
  getSessionId: (root: string | null) => string | null;
  getWorkspacePath: () => string | null;
  getWorktrees: () => WorktreeRecord[];
  intentionallyTerminatedPaneIds: Set<number>;
  latest: Ref<TSnapshot | null>;
  now: () => number;
  persistWorktreeRecord: (record: WorktreeRecord) => void;
  persistWorktreeRemoval: (paneId: string) => void;
  promptWorktreeLabel: () => Promise<string | null>;
  recordCreated: (pane: ManagedTerminalPane, root: string, sessionId: string) => void;
  recordCreatedWorktree: (
    pane: ManagedTerminalPane, root: string, sessionId: string, branch: string,
  ) => void;
  removeWorktree: (root: string, worktree: WorktreeRecord) => Promise<unknown>;
  requestPaint: () => void;
  savedLabel: (root: string, slot: number) => string | null;
  scheduleResize: () => void;
  selection: Ref<TSelection | null>;
  setChanging: (changing: boolean) => void;
  setError: (error: string | null) => void;
  setFocusedPane: (paneId: number) => void;
  setSessionPanes: (
    root: string, sessionId: string, panes: ManagedTerminalPane[], activePaneId: number | null,
  ) => void;
  snapshots: Ref<Record<number, TSnapshot>>;
  statusForPanes: (panes: ManagedTerminalPane[]) => TerminalPaneProjectStatus;
  updateProjectStatus: (root: string, status: ProjectRailStatus) => Promise<unknown>;
  updateSessionStatus: (root: string, status: ProjectRailStatus) => Promise<unknown>;
};

const activeContext = <TSnapshot, TSelection>(
  options: TerminalPaneActionsControllerOptions<TSnapshot, TSelection>,
) => {
  const root = options.getWorkspacePath();
  const sessionId = options.getSessionId(root);
  return root && sessionId ? { root, sessionId } : null;
};

const focusPane = <TSnapshot, TSelection>(
  options: TerminalPaneActionsControllerOptions<TSnapshot, TSelection>,
  paneId: number,
  requestedBy: RequestedBy,
) => executeTerminalPaneFocus({
  activePaneId: () => options.activePaneId.current,
  currentPanes: () => {
    const context = activeContext(options);
    return context ? options.getPanes(context.root, context.sessionId) : [];
  },
  focusPane: options.focusPane,
  gateAction: (action) => options.gateAction(action),
  paneId,
  recordActivePane: (id) => {
    const context = activeContext(options);
    const key = context ? paneContextKey(context.root, context.sessionId) : null;
    if (key) options.activePaneIds.current = { ...options.activePaneIds.current, [key]: id };
  },
  requestedBy,
  restoreSnapshot: (id) => {
    const cached = options.snapshots.current[id];
    if (!cached) return;
    options.latest.current = cached; options.selection.current = null; options.requestPaint();
  },
  scheduleResize: options.scheduleResize, setError: options.setError,
  setFocusedPane: options.setFocusedPane,
});

const createPane = async <TSnapshot, TSelection>(
  options: TerminalPaneActionsControllerOptions<TSnapshot, TSelection>,
  profile: LaunchProfile,
  requestedBy: RequestedBy,
) => {
  const context = activeContext(options);
  if (!context || options.getChanging()) return false;
  const { root, sessionId } = context;
  return executeTerminalPaneCreate({
    createPane: () => options.createPane(root, profile),
    currentPanes: () => options.getPanes(root, sessionId),
    finalizePane: (panes) => options.finalizePane(root, panes, profile),
    gateAction: (action) => options.gateAction(action), now: options.now, profile,
    recordCreated: (pane) => options.recordCreated(pane, root, sessionId), requestedBy, root,
    savedLabel: (slot) => options.savedLabel(root, slot), setChanging: options.setChanging,
    setError: options.setError,
    setSessionPanes: (panes, activeId) => options.setSessionPanes(root, sessionId, panes, activeId),
    updateProjectStatus: (status) => options.updateProjectStatus(root, status),
    updateSessionStatus: (status) => options.updateSessionStatus(root, status),
  });
};

const closePane = async <TSnapshot, TSelection>(
  options: TerminalPaneActionsControllerOptions<TSnapshot, TSelection>, paneId: number,
) => {
  const context = activeContext(options);
  if (!context) return false;
  const { root, sessionId } = context;
  const pane = options.getPanes(root, sessionId).find((item) => item.id === paneId);
  if (!pane) return false;
  return executeTerminalPaneClose({
    clearPaneSnapshot: (id) => { delete options.snapshots.current[id]; },
    closePane: options.closePane, currentPanes: () => options.getPanes(root, sessionId),
    focusPane: options.focusPane,
    gateAction: (action) => options.gateAction(action, options.activeAgentDescriptor),
    markIntentionallyTerminated: (id) => options.intentionallyTerminatedPaneIds.add(id),
    pane, projectStatus: () => options.getProjectStatus(root), requestPaint: options.requestPaint,
    scheduleResize: options.scheduleResize, sessionStatus: options.statusForPanes,
    setError: options.setError,
    setLatestSnapshot: (id) => {
      options.latest.current = id == null ? null : options.snapshots.current[id] ?? null;
    },
    setSessionPanes: (panes, activeId) => options.setSessionPanes(root, sessionId, panes, activeId),
    unmarkIntentionallyTerminated: (id) => options.intentionallyTerminatedPaneIds.delete(id),
    updateProjectStatus: (status) => options.updateProjectStatus(root, status),
    updateSessionStatus: (status) => options.updateSessionStatus(root, status),
  });
};

const createWorktreePane = async <TSnapshot, TSelection>(
  options: TerminalPaneActionsControllerOptions<TSnapshot, TSelection>, profile: LaunchProfile,
) => {
  const context = activeContext(options);
  if (!context || options.getChanging()) return false;
  const { root, sessionId } = context;
  return executeTerminalWorktreePaneCreate({
    createPane: (path, paneProfile) => options.createWorktreePane(path, paneProfile, root),
    createWorktree: (label) => options.createWorktree(root, label),
    currentPanes: () => options.getPanes(root, sessionId),
    finalizePane: (panes) => options.finalizePane(root, panes, profile),
    gateAction: (action) => options.gateAction(action), now: options.now,
    persistRecord: options.persistWorktreeRecord, profile, projectRoot: root,
    promptLabel: options.promptWorktreeLabel,
    recordCreated: (pane, branch) => options.recordCreatedWorktree(pane, root, sessionId, branch),
    setChanging: options.setChanging, setError: options.setError,
    setSessionPanes: (panes, activeId) => options.setSessionPanes(root, sessionId, panes, activeId),
    updateProjectStatus: (status) => options.updateProjectStatus(root, status),
    updateSessionStatus: (status) => options.updateSessionStatus(root, status),
  });
};

const closeWorktreePane = async <TSnapshot, TSelection>(
  options: TerminalPaneActionsControllerOptions<TSnapshot, TSelection>, paneId: number,
) => {
  const root = options.getWorkspacePath();
  if (!root) return false;
  const worktree = worktreeForPaneId(options.getWorktrees(), String(paneId));
  if (!worktree) return false;
  return executeTerminalWorktreePaneClose({
    closePane: () => closePane(options, paneId),
    gateAction: (action) => options.gateAction(action, options.activeAgentDescriptor),
    persistRemoval: () => options.persistWorktreeRemoval(String(paneId)),
    removeWorktree: () => options.removeWorktree(root, worktree),
    setError: (error) => options.setError(error), worktree,
  });
};

export const createTerminalPaneActionsController = <TSnapshot, TSelection>(
  options: TerminalPaneActionsControllerOptions<TSnapshot, TSelection>,
) => ({
  closeTerminalPane: (paneId: number) => closePane(options, paneId),
  closeWorktreePane: (paneId: number) => closeWorktreePane(options, paneId),
  createTerminalPane: (profile = options.defaultProfile(), requestedBy: RequestedBy = "user") =>
    createPane(options, profile, requestedBy),
  createWorktreePane: (profile = options.defaultProfile()) => createWorktreePane(options, profile),
  focusTerminalPane: (paneId: number, requestedBy: RequestedBy = "user") =>
    focusPane(options, paneId, requestedBy),
});
