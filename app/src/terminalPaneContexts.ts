import type { ManagedTerminalPane } from "./managedTerminalPane";
import { paneContextBelongsToProject, paneContextKey, paneContextParts } from "./paneOwnership";
import { terminalPaneProjectStatus, type TerminalPaneState } from "./terminalPane";
import type { ProjectRailStatus } from "./workspaceState";

type Ref<T> = { current: T };
export type TerminalPanesByContext = Record<string, ManagedTerminalPane[]>;
export type ActiveTerminalPaneByContext = Record<string, number>;

type TerminalPaneContextOptions = {
  activePaneIds: Ref<ActiveTerminalPaneByContext>;
  activeSessionForProject: (root: string | null) => string | null;
  activeWorkspace: Ref<string | null>;
  panes: Ref<ManagedTerminalPane[]>;
  panesByContext: Ref<TerminalPanesByContext>;
  persistPaneLayout: (root: string, sessionId: string, panes: ManagedTerminalPane[]) => void;
  setActivePaneId: (paneId: number | null) => void;
  setPanes: (panes: ManagedTerminalPane[]) => void;
};

const setManagedPanes = (context: TerminalPaneContextOptions, panes: ManagedTerminalPane[]) => {
  context.panes.current = panes;
  context.setPanes(panes);
};

const setFocusedPane = (context: TerminalPaneContextOptions, paneId: number | null) => {
  context.setActivePaneId(paneId);
};

const panesForSession = (
  context: TerminalPaneContextOptions,
  root: string | null,
  sessionId: string | null = context.activeSessionForProject(root),
) => {
  const key = paneContextKey(root, sessionId);
  return key ? context.panesByContext.current[key] ?? [] : [];
};

const panesForProject = (context: TerminalPaneContextOptions, root: string | null) => {
  if (!root) return [];
  return Object.entries(context.panesByContext.current)
    .filter(([key]) => paneContextBelongsToProject(key, root))
    .flatMap(([, panes]) => panes);
};

const contextForPaneId = (context: TerminalPaneContextOptions, paneId: number) => {
  const entry = Object.entries(context.panesByContext.current).find(([, panes]) =>
    panes.some((pane) => pane.id === paneId));
  if (!entry) return null;
  const parts = paneContextParts(entry[0]);
  return parts ? { key: entry[0], panes: entry[1], ...parts } : null;
};

const activePaneForSession = (
  context: TerminalPaneContextOptions,
  root: string | null,
  sessionId: string | null = context.activeSessionForProject(root),
  panes: ManagedTerminalPane[] = panesForSession(context, root, sessionId),
) => {
  const key = paneContextKey(root, sessionId);
  if (!key) return null;
  const saved = context.activePaneIds.current[key];
  return panes.some((pane) => pane.id === saved) ? saved : panes[0]?.id ?? null;
};

const setSessionPanes = (
  context: TerminalPaneContextOptions,
  root: string,
  sessionId: string,
  panes: ManagedTerminalPane[],
  activePaneId: number | null = activePaneForSession(context, root, sessionId, panes),
) => {
  const key = paneContextKey(root, sessionId);
  if (!key) return;
  context.panesByContext.current = { ...context.panesByContext.current, [key]: panes };
  if (activePaneId == null) {
    const { [key]: _removed, ...next } = context.activePaneIds.current;
    context.activePaneIds.current = next;
  } else {
    context.activePaneIds.current = { ...context.activePaneIds.current, [key]: activePaneId };
  }
  if (context.activeWorkspace.current === root && context.activeSessionForProject(root) === sessionId) {
    setManagedPanes(context, panes);
    setFocusedPane(context, activePaneId);
  }
  context.persistPaneLayout(root, sessionId, panes);
};

const setPaneState = (
  context: TerminalPaneContextOptions, paneId: number, state: TerminalPaneState, exitCode: number | null,
) => {
  const owner = contextForPaneId(context, paneId);
  const current = owner?.panes ?? context.panes.current;
  const next = current.map((pane) => pane.id === paneId ? { ...pane, state, exitCode } : pane);
  if (owner) setSessionPanes(
    context, owner.projectRoot, owner.sessionId, next,
    activePaneForSession(context, owner.projectRoot, owner.sessionId, next),
  );
  else setManagedPanes(context, next);
  return next;
};

export const createTerminalPaneContexts = (context: TerminalPaneContextOptions) => ({
  activePaneForSession: (root: string | null, sessionId?: string | null, panes?: ManagedTerminalPane[]) =>
    activePaneForSession(context, root, sessionId, panes),
  activeProjectStatus: (): ProjectRailStatus => terminalPaneProjectStatus(panesForProject(context, context.activeWorkspace.current)),
  activeSessionStatus: (): ProjectRailStatus => terminalPaneProjectStatus(context.panes.current),
  contextForPaneId: (paneId: number) => contextForPaneId(context, paneId),
  panesForProject: (root: string | null) => panesForProject(context, root),
  panesForSession: (root: string | null, sessionId?: string | null) => panesForSession(context, root, sessionId),
  projectStatusForRoot: (root: string | null): ProjectRailStatus => terminalPaneProjectStatus(panesForProject(context, root)),
  setFocusedPane: (paneId: number | null) => setFocusedPane(context, paneId),
  setManagedPanes: (panes: ManagedTerminalPane[]) => setManagedPanes(context, panes),
  setPaneState: (paneId: number, state: TerminalPaneState, exitCode: number | null = null) =>
    setPaneState(context, paneId, state, exitCode),
  setSessionPanes: (root: string, sessionId: string, panes: ManagedTerminalPane[], activePaneId?: number | null) =>
    setSessionPanes(context, root, sessionId, panes, activePaneId),
  statusForPanes: (panes: ManagedTerminalPane[] = context.panes.current): ProjectRailStatus => terminalPaneProjectStatus(panes),
});
