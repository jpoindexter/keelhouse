import { invoke } from "@tauri-apps/api/core";
import { confirm as confirmDialog } from "@tauri-apps/plugin-dialog";
import {
  connectionEnvironmentInputs,
  type AiConnectionSettings,
  type ConnectionEnvironmentInput,
} from "./connectionSettings";
import { defaultTerminalLaunchProfile, type LaunchProfile } from "./launchProfiles";
import { createWorkspaceOpenActions } from "./workspaceOpenActions";
import {
  createWorkspaceOpenLifecycleController,
  type WorkspaceOpenStore,
} from "./workspaceOpenLifecycleController";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import {
  createWorkspaceOpenTargetController,
  type OpenedWorkspaceTarget,
} from "./workspaceOpenTargetController";

type Ref<T> = { current: T };

type TargetInput<TSnapshot> = Omit<
  Parameters<typeof createWorkspaceOpenTargetController<TSnapshot, ConnectionEnvironmentInput[]>>[0],
  "createPane" | "defaultProfileId" | "focusPane" | "getEnvironment" | "openWorkspace" | "resolveWorkspace"
>;

type LifecycleInput<TConversation, TEditorSnapshot, THarness, TPaneLayout> = Omit<
  Parameters<typeof createWorkspaceOpenLifecycleController<TConversation, TEditorSnapshot, THarness, TPaneLayout>>[0],
  "logHealthEvent"
>;

type ActionsInput = Omit<
  Parameters<typeof createWorkspaceOpenActions<
    OpenedWorkspaceTarget, LaunchProfile, ManagedTerminalPane[], WorkspaceOpenStore | null
  >>[0],
  "applyOpened" | "completeOpened" | "confirmDiscard" | "handleError" | "openTarget"
>;

type WorkspaceOpenSurfaceInput<
  TSnapshot, TConversation, TEditorSnapshot, THarness, TPaneLayout,
> = {
  actions: ActionsInput;
  connectionSettings: Ref<AiConnectionSettings>;
  lifecycle: LifecycleInput<TConversation, TEditorSnapshot, THarness, TPaneLayout>;
  target: TargetInput<TSnapshot>;
};

const wireTarget = <TSnapshot>(
  target: TargetInput<TSnapshot>,
  connectionSettings: Ref<AiConnectionSettings>,
) => createWorkspaceOpenTargetController<TSnapshot, ConnectionEnvironmentInput[]>({
  ...target,
  createPane: (path, profile, environment) =>
    invoke<{ paneId: number }>("create_pane", { path, profile, environment }),
  defaultProfileId: defaultTerminalLaunchProfile().id,
  focusPane: (paneId) => invoke("focus_pane", { paneId }),
  getEnvironment: (path) => connectionEnvironmentInputs(connectionSettings.current, path),
  openWorkspace: (path, profile, environment) =>
    invoke<{ paneId: number; root: string }>("open_workspace", { path, profile, environment }),
  resolveWorkspace: (path) => invoke<{ root: string }>("resolve_workspace", { path }),
});

export const createWorkspaceOpenSurface = <
  TSnapshot, TConversation, TEditorSnapshot, THarness, TPaneLayout,
>(
  input: WorkspaceOpenSurfaceInput<
    TSnapshot, TConversation, TEditorSnapshot, THarness, TPaneLayout
  >,
) => {
  const target = wireTarget(input.target, input.connectionSettings);
  const lifecycle = createWorkspaceOpenLifecycleController({
    ...input.lifecycle,
    logHealthEvent: (message: string) => invoke("log_health_event", { message }),
  });
  return createWorkspaceOpenActions({
    ...input.actions,
    applyOpened: target.applyOpenedWorkspaceTarget,
    completeOpened: lifecycle.completeOpenedWorkspace,
    confirmDiscard: (count) => confirmDialog(
      `Switch workspace and discard ${count} unsaved editor tabs?`,
    ),
    handleError: lifecycle.handleWorkspaceOpenError,
    openTarget: target.prepareAndOpenWorkspaceTarget,
  });
};

type Ref2<T> = { current: T };

type WorkspaceOpenHookBundle<TSnapshot> = {
  activePaneForSession: TargetInput<TSnapshot>["activePaneForSession"];
  activePaneIdsRef: TargetInput<TSnapshot>["activePaneIds"];
  paneLayoutsRef: TargetInput<TSnapshot>["paneLayouts"];
  panesByContextRef: TargetInput<TSnapshot>["panesByContext"];
  panesForSession: TargetInput<TSnapshot>["panesForSession"];
  requestPaintRef: Ref2<() => void>;
  setFocusedPane: TargetInput<TSnapshot>["setFocusedPane"];
  setManagedPanes: TargetInput<TSnapshot>["setManagedPanes"];
  snapshotsRef: TargetInput<TSnapshot>["snapshots"];
};

type HookDerivedTargetKeys =
  | "activePaneForSession" | "activePaneIds" | "paneLayouts" | "panesByContext"
  | "panesForSession" | "requestPaint" | "setFocusedPane" | "setManagedPanes" | "snapshots";

export const workspaceOpenTargetFromHook = <TSnapshot,>(
  hook: WorkspaceOpenHookBundle<TSnapshot>,
  rest: Omit<TargetInput<TSnapshot>, HookDerivedTargetKeys>,
): TargetInput<TSnapshot> => ({
  ...rest,
  activePaneForSession: hook.activePaneForSession,
  activePaneIds: hook.activePaneIdsRef,
  paneLayouts: hook.paneLayoutsRef,
  panesByContext: hook.panesByContextRef,
  panesForSession: hook.panesForSession,
  requestPaint: () => hook.requestPaintRef.current(),
  setFocusedPane: hook.setFocusedPane,
  setManagedPanes: hook.setManagedPanes,
  snapshots: hook.snapshotsRef,
});

type WorkspaceOpenRecordsHookShape = {
  browser: {
    projectRecordsRef: unknown;
    sessionRecordsRef: unknown;
    setProjectRecords: unknown;
    setSessionRecords: unknown;
  };
  composer: {
    chatConversationsRef: unknown;
    composerHarnessBySessionRef: unknown;
    setChatConversations: unknown;
    setComposerHarnessBySession: unknown;
  };
  editorSession: { sessionEditorSnapshotsRef: unknown };
  persistence: {
    activeSessionByProjectRef: unknown;
    openProjectsRef: unknown;
    projectSessionsRef: unknown;
    recentProjectsRef: unknown;
    setActiveSessionByProjectState: unknown;
    setOpenProjects: unknown;
    setProjectSessions: unknown;
    setRecentProjects: unknown;
  };
  terminal: { activePaneIdsRef: unknown; paneLayoutsRef: unknown; panesByContextRef: unknown };
};

export const workspaceOpenRecordsFromHooks = <H extends WorkspaceOpenRecordsHookShape>(hooks: H) => ({
  activePanes: { ref: hooks.terminal.activePaneIdsRef as H["terminal"]["activePaneIdsRef"] },
  activeSessions: {
    ref: hooks.persistence.activeSessionByProjectRef as H["persistence"]["activeSessionByProjectRef"],
    set: hooks.persistence.setActiveSessionByProjectState as H["persistence"]["setActiveSessionByProjectState"],
  },
  browserProjects: {
    ref: hooks.browser.projectRecordsRef as H["browser"]["projectRecordsRef"],
    set: hooks.browser.setProjectRecords as H["browser"]["setProjectRecords"],
  },
  browserSessions: {
    ref: hooks.browser.sessionRecordsRef as H["browser"]["sessionRecordsRef"],
    set: hooks.browser.setSessionRecords as H["browser"]["setSessionRecords"],
  },
  conversations: {
    ref: hooks.composer.chatConversationsRef as H["composer"]["chatConversationsRef"],
    set: hooks.composer.setChatConversations as H["composer"]["setChatConversations"],
  },
  editorSnapshots: {
    ref: hooks.editorSession.sessionEditorSnapshotsRef as H["editorSession"]["sessionEditorSnapshotsRef"],
  },
  harnessRecords: {
    ref: hooks.composer.composerHarnessBySessionRef as H["composer"]["composerHarnessBySessionRef"],
    set: hooks.composer.setComposerHarnessBySession as H["composer"]["setComposerHarnessBySession"],
  },
  openProjects: {
    ref: hooks.persistence.openProjectsRef as H["persistence"]["openProjectsRef"],
    set: hooks.persistence.setOpenProjects as H["persistence"]["setOpenProjects"],
  },
  paneLayouts: { ref: hooks.terminal.paneLayoutsRef as H["terminal"]["paneLayoutsRef"] },
  projectPanes: { ref: hooks.terminal.panesByContextRef as H["terminal"]["panesByContextRef"] },
  recentProjects: {
    ref: hooks.persistence.recentProjectsRef as H["persistence"]["recentProjectsRef"],
    set: hooks.persistence.setRecentProjects as H["persistence"]["setRecentProjects"],
  },
  sessions: {
    ref: hooks.persistence.projectSessionsRef as H["persistence"]["projectSessionsRef"],
    set: hooks.persistence.setProjectSessions as H["persistence"]["setProjectSessions"],
  },
});
