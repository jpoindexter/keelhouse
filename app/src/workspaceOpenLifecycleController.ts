import type { LaunchProfile } from "./launchProfiles";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import type {
  ActiveSessionByProject, OpenProject, ProjectRailStatus, ProjectSessionsByProject,
} from "./workspaceState";
import type { OpenedWorkspaceTarget } from "./workspaceOpenTargetController";
import { executeWorkspaceOpenFailure } from "./workspaceOpenFailureWorkflow";
import {
  persistWorkspaceOpenFailure, persistWorkspaceOpenSuccess,
} from "./workspaceOpenPersistence";
import { persistMissingWorkspaceCleanup } from "./workspaceOpenRecoveryPersistence";
import { executeWorkspaceOpenSuccess } from "./workspaceOpenSuccessWorkflow";

type Ref<T> = { current: T };
type RecordBinding<T> = { ref: Ref<T>; set?: (value: T) => void };
export type WorkspaceOpenStore = {
  delete: (key: string) => Promise<unknown>;
  save: () => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<unknown>;
};

type LifecycleRecords<TConversation, TEditorSnapshot, THarness, TPaneLayout> = {
  activePanes: RecordBinding<Record<string, number>>;
  activeSessions: RecordBinding<ActiveSessionByProject>;
  browserProjects: RecordBinding<Record<string, string>>;
  browserSessions: RecordBinding<Record<string, string>>;
  conversations: RecordBinding<Record<string, TConversation>>;
  editorSnapshots: RecordBinding<Record<string, TEditorSnapshot>>;
  harnessRecords: RecordBinding<Record<string, THarness>>;
  openProjects: RecordBinding<OpenProject[]>;
  paneLayouts: RecordBinding<Record<string, TPaneLayout>>;
  projectPanes: RecordBinding<Record<string, ManagedTerminalPane[]>>;
  recentProjects: RecordBinding<string[]>;
  sessions: RecordBinding<ProjectSessionsByProject>;
};

type LifecycleOptions<TConversation, TEditorSnapshot, THarness, TPaneLayout> = {
  clearCurrentWorkspace: (path: string) => void;
  deleteProjectChats: (path: string) => Promise<unknown>;
  logHealthEvent: (message: string) => Promise<unknown>;
  now: () => number;
  persistPaneLayout: (
    root: string, sessionId: string | null, panes: ManagedTerminalPane[],
  ) => void;
  projectStatus: (root: string) => ProjectRailStatus;
  records: LifecycleRecords<TConversation, TEditorSnapshot, THarness, TPaneLayout>;
  restoreBrowser: (root: string, sessionId: string | null) => void;
  restoreEditor: (root: string, sessionId: string | null) => void;
  sessionStatus: (panes: ManagedTerminalPane[]) => ProjectRailStatus;
  setFocusedPane: (paneId: number | null) => void;
  setLaunchError: (message: string | null) => void;
  setManagedPanes: (panes: ManagedTerminalPane[]) => void;
};

const applyBinding = <T,>(binding: RecordBinding<T>, value: T) => {
  binding.ref.current = value;
  binding.set?.(value);
};

const successState = <TConversation, TEditorSnapshot, THarness, TPaneLayout>(
  records: LifecycleRecords<TConversation, TEditorSnapshot, THarness, TPaneLayout>,
) => ({
  activeSessions: records.activeSessions.ref.current,
  openProjects: records.openProjects.ref.current,
  recentProjects: records.recentProjects.ref.current,
  sessions: records.sessions.ref.current,
});

const failureState = <TConversation, TEditorSnapshot, THarness, TPaneLayout>(
  records: LifecycleRecords<TConversation, TEditorSnapshot, THarness, TPaneLayout>,
) => ({
  activePanes: records.activePanes.ref.current,
  activeSessions: records.activeSessions.ref.current,
  browserProjects: records.browserProjects.ref.current,
  browserSessions: records.browserSessions.ref.current,
  conversations: records.conversations.ref.current,
  editorSnapshots: records.editorSnapshots.ref.current,
  harnessRecords: records.harnessRecords.ref.current,
  openProjects: records.openProjects.ref.current,
  paneLayouts: records.paneLayouts.ref.current,
  projectPanes: records.projectPanes.ref.current,
  recentProjects: records.recentProjects.ref.current,
  sessions: records.sessions.ref.current,
});

const applySuccess = <TConversation, TEditorSnapshot, THarness, TPaneLayout>(
  records: LifecycleRecords<TConversation, TEditorSnapshot, THarness, TPaneLayout>,
  plan: ReturnType<typeof successState>,
) => {
  applyBinding(records.recentProjects, plan.recentProjects);
  applyBinding(records.openProjects, plan.openProjects);
  applyBinding(records.sessions, plan.sessions);
  applyBinding(records.activeSessions, plan.activeSessions);
};

const applyFailure = <TConversation, TEditorSnapshot, THarness, TPaneLayout>(
  records: LifecycleRecords<TConversation, TEditorSnapshot, THarness, TPaneLayout>,
  plan: Pick<ReturnType<typeof successState>, "activeSessions" | "openProjects" | "sessions">,
) => {
  applyBinding(records.openProjects, plan.openProjects);
  applyBinding(records.sessions, plan.sessions);
  applyBinding(records.activeSessions, plan.activeSessions);
};

const applyMissing = <TConversation, TEditorSnapshot, THarness, TPaneLayout>(
  records: LifecycleRecords<TConversation, TEditorSnapshot, THarness, TPaneLayout>,
  cleanup: ReturnType<typeof failureState<TConversation, TEditorSnapshot, THarness, TPaneLayout>>,
) => {
  applyBinding(records.recentProjects, cleanup.recentProjects);
  applyBinding(records.openProjects, cleanup.openProjects);
  applyBinding(records.sessions, cleanup.sessions);
  applyBinding(records.activeSessions, cleanup.activeSessions);
  applyBinding(records.projectPanes, cleanup.projectPanes);
  applyBinding(records.activePanes, cleanup.activePanes);
  applyBinding(records.browserProjects, cleanup.browserProjects);
  applyBinding(records.browserSessions, cleanup.browserSessions);
  applyBinding(records.harnessRecords, cleanup.harnessRecords);
  applyBinding(records.conversations, cleanup.conversations);
  applyBinding(records.editorSnapshots, cleanup.editorSnapshots);
  applyBinding(records.paneLayouts, cleanup.paneLayouts);
};

const completeOpened = async <TConversation, TEditorSnapshot, THarness, TPaneLayout>(
  options: LifecycleOptions<TConversation, TEditorSnapshot, THarness, TPaneLayout>,
  opened: OpenedWorkspaceTarget, profile: LaunchProfile, previousRoot: string | null,
  store: WorkspaceOpenStore | null,
) => executeWorkspaceOpenSuccess({
  applyPlan: (plan) => applySuccess(options.records, plan),
  now: options.now(), panes: opened.panes, persistPaneLayout: options.persistPaneLayout,
  persistPlan: (plan) => persistWorkspaceOpenSuccess({
    ...plan, launchProfile: profile, root: opened.root, store,
  }),
  previousRoot, previousStatus: previousRoot ? options.projectStatus(previousRoot) : "exited",
  projectStatus: options.projectStatus(opened.root), restoreBrowser: options.restoreBrowser,
  restoreEditor: options.restoreEditor, root: opened.root,
  sessionStatus: options.sessionStatus(opened.panes), state: successState(options.records),
});

const handleError = async <TConversation, TEditorSnapshot, THarness, TPaneLayout>(
  options: LifecycleOptions<TConversation, TEditorSnapshot, THarness, TPaneLayout>,
  error: unknown, path: string, previousPanes: ManagedTerminalPane[],
  previousActivePaneId: number | null, store: WorkspaceOpenStore | null,
) => {
  const message = String(error);
  options.setLaunchError(message);
  options.setManagedPanes(previousPanes);
  options.setFocusedPane(previousActivePaneId);
  void options.logHealthEvent(`open_workspace failed: ${message}`).catch(() => {});
  return executeWorkspaceOpenFailure({
    applyFailure: (plan) => applyFailure(options.records, plan),
    applyMissingCleanup: (cleanup) => applyMissing(options.records, cleanup),
    message, now: options.now(), path,
    persistFailure: (plan) => persistWorkspaceOpenFailure({ ...plan, store }),
    persistMissingCleanup: (cleanup) => persistMissingWorkspaceCleanup({
      beforeDeleteFolder: () => options.clearCurrentWorkspace(path), cleanup,
      deleteProjectChats: options.deleteProjectChats,
      onDeleteError: (failure) => {
        void options.logHealthEvent(`delete project chats failed: ${String(failure)}`).catch(() => {});
      },
      path, store,
    }),
    state: failureState(options.records),
  });
};

export const createWorkspaceOpenLifecycleController = <
  TConversation, TEditorSnapshot, THarness, TPaneLayout,
>(options: LifecycleOptions<TConversation, TEditorSnapshot, THarness, TPaneLayout>) => ({
  completeOpenedWorkspace: (
    opened: OpenedWorkspaceTarget, profile: LaunchProfile, previousRoot: string | null,
    store: WorkspaceOpenStore | null,
  ) => completeOpened(options, opened, profile, previousRoot, store),
  handleWorkspaceOpenError: (
    error: unknown, path: string, previousPanes: ManagedTerminalPane[],
    previousActivePaneId: number | null, store: WorkspaceOpenStore | null,
  ) => handleError(options, error, path, previousPanes, previousActivePaneId, store),
});
