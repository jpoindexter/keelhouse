import type { ManagedTerminalPane } from "./managedTerminalPane";
import { paneLayoutFromPanes, type PaneLayoutsBySession } from "./sessionRestore";
import { normalizeTerminalPaneLabel } from "./terminalPane";
import type { PaneLabelsBySession } from "./workspaceBootstrap";
import {
  forgetActiveFile,
  rememberActiveFile,
  type ActiveFileByWorkspace,
  type ActiveSessionByProject,
  type OpenProject,
  type ProjectSessionsByProject,
} from "./workspaceState";

type Ref<T> = { current: T };
type PersistenceStore = {
  save: () => Promise<void>;
  set: (key: string, value: unknown) => Promise<void>;
};

type WorkspacePersistenceOptions<TSnapshot> = {
  activeFiles: Ref<ActiveFileByWorkspace>;
  activeSessions: Ref<ActiveSessionByProject>;
  getActiveSession: (root: string | null) => string | null;
  getPanes: (root: string | null, sessionId: string | null) => ManagedTerminalPane[];
  openProjects: Ref<OpenProject[]>;
  paneLabels: Ref<PaneLabelsBySession>;
  paneLayouts: Ref<PaneLayoutsBySession>;
  projectSessions: Ref<ProjectSessionsByProject>;
  sessionSnapshots: Ref<Record<string, TSnapshot>>;
  setActiveSessions: (value: ActiveSessionByProject) => void;
  setOpenProjects: (value: OpenProject[]) => void;
  setPaneLabels: (value: PaneLabelsBySession) => void;
  setProjectSessions: (value: ProjectSessionsByProject) => void;
  store: Ref<PersistenceStore | null>;
};

type PersistenceContext<TSnapshot> = WorkspacePersistenceOptions<TSnapshot>;

export const workspaceSessionKey = (root: string, sessionId: string) => `${root}\n${sessionId}`;

const persistActiveFile = async <T>(context: PersistenceContext<T>, workspace: string, filePath: string) => {
  const next = rememberActiveFile(context.activeFiles.current, workspace, filePath);
  context.activeFiles.current = next;
  await context.store.current?.set("activeFileByWorkspace", next);
  await context.store.current?.save();
};

const clearActiveFile = async <T>(context: PersistenceContext<T>, workspace: string) => {
  const next = forgetActiveFile(context.activeFiles.current, workspace);
  context.activeFiles.current = next;
  await context.store.current?.set("activeFileByWorkspace", next);
  await context.store.current?.save();
};

const persistOpenProjects = async <T>(context: PersistenceContext<T>, projects: OpenProject[]) => {
  context.openProjects.current = projects;
  context.setOpenProjects(projects);
  await context.store.current?.set("openProjects", projects);
  await context.store.current?.save();
};

const persistProjectSessions = async <T>(
  context: PersistenceContext<T>,
  sessions: ProjectSessionsByProject,
  activeSessions: ActiveSessionByProject,
) => {
  context.projectSessions.current = sessions;
  context.activeSessions.current = activeSessions;
  context.setProjectSessions(sessions);
  context.setActiveSessions(activeSessions);
  await context.store.current?.set("projectSessions", sessions);
  await context.store.current?.set("activeSessionByProject", activeSessions);
  await context.store.current?.save();
};

const persistSnapshots = <T>(context: PersistenceContext<T>, next: Record<string, T>) => {
  context.sessionSnapshots.current = next;
  void context.store.current?.set("sessionEditorSnapshots", next);
  void context.store.current?.save();
};

const persistLayouts = <T>(context: PersistenceContext<T>, next: PaneLayoutsBySession) => {
  context.paneLayouts.current = next;
  void context.store.current?.set("paneLayoutsBySession", next);
  void context.store.current?.save();
};

const persistPaneLayout = <T>(
  context: PersistenceContext<T>,
  root: string | null,
  sessionId: string | null,
  panes = context.getPanes(root, sessionId),
) => {
  if (!root || !sessionId) return;
  const key = workspaceSessionKey(root, sessionId);
  const records = paneLayoutFromPanes(panes);
  const next = { ...context.paneLayouts.current };
  if (records.length > 0) next[key] = records;
  else delete next[key];
  persistLayouts(context, next);
};

const removeSessionRestore = <T>(context: PersistenceContext<T>, root: string, sessionId: string) => {
  const key = workspaceSessionKey(root, sessionId);
  const nextSnapshots = { ...context.sessionSnapshots.current };
  const nextLayouts = { ...context.paneLayouts.current };
  delete nextSnapshots[key];
  delete nextLayouts[key];
  persistSnapshots(context, nextSnapshots);
  persistLayouts(context, nextLayouts);
};

const paneLabelKey = <T>(context: PersistenceContext<T>, root: string | null, sessionId?: string | null) => {
  const activeSession = sessionId === undefined ? context.getActiveSession(root) : sessionId;
  return root && activeSession ? workspaceSessionKey(root, activeSession) : null;
};

const savedPaneLabel = <T>(
  context: PersistenceContext<T>, root: string | null, slot: number, sessionId?: string | null,
) => {
  const key = paneLabelKey(context, root, sessionId);
  return key ? context.paneLabels.current[key]?.find((record) => record.slot === slot)?.label ?? null : null;
};

const persistPaneLabel = async <T>(
  context: PersistenceContext<T>, root: string, slot: number, label: string | null,
) => {
  const key = paneLabelKey(context, root);
  if (!key) return;
  const existing = context.paneLabels.current[key] ?? [];
  const normalized = normalizeTerminalPaneLabel(label);
  const nextRecords = normalized
    ? [...existing.filter((record) => record.slot !== slot), { slot, label: normalized, updatedAt: Date.now() }]
      .sort((a, b) => a.slot - b.slot)
    : existing.filter((record) => record.slot !== slot);
  const next = { ...context.paneLabels.current };
  if (nextRecords.length > 0) next[key] = nextRecords;
  else delete next[key];
  context.paneLabels.current = next;
  context.setPaneLabels(next);
  await context.store.current?.set("paneLabelsBySession", next);
  await context.store.current?.save();
};

export const createWorkspacePersistence = <TSnapshot>(context: WorkspacePersistenceOptions<TSnapshot>) => ({
  clearActiveFile: (workspace: string) => clearActiveFile(context, workspace),
  persistActiveFile: (workspace: string, filePath: string) => persistActiveFile(context, workspace, filePath),
  persistOpenProjects: (projects: OpenProject[]) => persistOpenProjects(context, projects),
  persistPaneLabel: (root: string, slot: number, label: string | null) => persistPaneLabel(context, root, slot, label),
  persistPaneLayout: (root: string | null, sessionId: string | null, panes?: ManagedTerminalPane[]) =>
    persistPaneLayout(context, root, sessionId, panes),
  persistPaneLayouts: (next: PaneLayoutsBySession) => persistLayouts(context, next),
  persistProjectSessions: (sessions: ProjectSessionsByProject, activeSessions: ActiveSessionByProject) =>
    persistProjectSessions(context, sessions, activeSessions),
  persistSessionSnapshots: (next: Record<string, TSnapshot>) => persistSnapshots(context, next),
  removeSessionRestore: (root: string, sessionId: string) => removeSessionRestore(context, root, sessionId),
  savedPaneLabel: (root: string | null, slot: number, sessionId?: string | null) =>
    savedPaneLabel(context, root, slot, sessionId),
  sessionKey: workspaceSessionKey,
});
