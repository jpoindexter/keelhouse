import { invoke } from "@tauri-apps/api/core";
import { confirm as confirmDialog } from "@tauri-apps/plugin-dialog";
import { load } from "@tauri-apps/plugin-store";
import { clearBackgroundExitsForProject } from "./backgroundExits";
import type { AiConnectionSettings } from "./connectionSettings";
import { deleteDurableProjectChats } from "./chatStore";
import type { deriveEditorWorkspaceState } from "./editorWorkspaceState";
import type { FileTreeNode } from "./fileTreeTypes";
import { createProjectCloseController, projectCloseFromHook } from "./projectCloseController";
import { createSessionSnapshotCapture, createSessionSnapshotRestore } from "./sessionSnapshotCapture";
import type { useAppShellDomain } from "./useAppShellDomain";
import type { useComposerRuntime } from "./useComposerRuntime";
import type { useConversationRuntime } from "./useConversationRuntime";
import type { EditorPendingNavigation } from "./useEditorNavigationLifecycle";
import type { useWorkspaceDomain } from "./useWorkspaceDomain";
import { activeProjectSessionId, type OpenProject } from "./workspaceState";
import {
  createWorkspaceOpenSurface, workspaceOpenRecordsFromHooks, workspaceOpenTargetFromHook,
} from "./workspaceOpenSurface";

type Cell = { t: string; f: [number, number, number]; b: [number, number, number]; bold: boolean };
type Snapshot = {
  cols: number; rows: number; cx: number; cy: number; cvis: boolean; sb: number; cells: Cell[];
};
type AppShell = ReturnType<typeof useAppShellDomain>;
type ComposerRuntime = ReturnType<typeof useComposerRuntime>;
type Conversation = ReturnType<typeof useConversationRuntime>;
type Workspace = ReturnType<typeof useWorkspaceDomain<Snapshot>>;

type WorkspaceProjectInput = {
  browser: Conversation["browser"];
  chrome: AppShell["chrome"];
  composerLocal: ComposerRuntime["composerLocal"];
  composerWorkspace: Workspace["composerWorkspace"];
  editorSession: Workspace["editorSession"];
  editorWorkspace: ReturnType<typeof deriveEditorWorkspaceState>;
  latest: { current: Snapshot | null };
  openEditorFile: (file: FileTreeNode) => Promise<unknown>;
  persistence: Workspace["persistence"];
  profiles: Workspace["profiles"];
  projectEntryOpen: AppShell["projectEntryOpen"];
  requestEditorNavigation: (navigation: EditorPendingNavigation) => void;
  scheduleResize: () => void;
  setBackgroundExits: AppShell["setBackgroundExits"];
  setLaunchError: (message: string | null) => void;
  setWorkspacePath: (path: string | null) => void;
  shellLayout: AppShell["shellLayout"];
  storeRef: { current: Awaited<ReturnType<typeof load>> | null };
  terminal: Workspace["terminal"];
  workspacePathRef: { current: string | null };
  workspaceTree: Workspace["workspaceTree"];
  connectionSettings: { current: AiConnectionSettings };
};

const snapshotActionsFrom = (input: WorkspaceProjectInput) => {
  const capture = createSessionSnapshotCapture({
    capture: input.editorSession.captureSessionSnapshot,
    getRoot: () => input.workspacePathRef.current,
    makeKey: input.persistence.sessionKey,
    persistPaneLayout: input.persistence.persistPaneLayout,
    persistSnapshots: input.persistence.persistSessionSnapshots,
    resolveSessionId: (root) => activeProjectSessionId(
      input.persistence.activeSessionByProjectRef.current,
      input.persistence.projectSessionsRef.current, root,
    ),
  });
  const restore = createSessionSnapshotRestore({
    makeKey: input.persistence.sessionKey,
    openFile: input.openEditorFile,
    restore: input.editorSession.restoreSessionSnapshot,
  });
  return { capture, restore };
};

const workspaceLifecycleFrom = (
  input: WorkspaceProjectInput,
  restoreEditor: ReturnType<typeof createSessionSnapshotRestore>,
) => ({
  clearCurrentWorkspace: (path: string) => {
    if (input.workspacePathRef.current !== path) return;
    input.terminal.setManagedPanes([]);
    input.terminal.setFocusedPane(null);
    input.setWorkspacePath(null);
    input.workspaceTree.setTree([]);
    input.editorSession.resetEditor();
  },
  deleteProjectChats: deleteDurableProjectChats,
  now: Date.now,
  persistPaneLayout: input.persistence.persistPaneLayout,
  projectStatus: input.terminal.projectStatusForRoot,
  records: workspaceOpenRecordsFromHooks({
    browser: input.browser, composer: input.composerWorkspace,
    editorSession: input.editorSession, persistence: input.persistence, terminal: input.terminal,
  }),
  restoreBrowser: input.browser.restoreScopedUrl,
  restoreEditor,
  sessionStatus: input.terminal.statusForPanes,
  setFocusedPane: input.terminal.setFocusedPane,
  setLaunchError: (message: string | null) => {
    input.setLaunchError(message);
    if (message) input.projectEntryOpen.reportError(message);
  },
  setManagedPanes: input.terminal.setManagedPanes,
});

const workspaceTargetFrom = (input: WorkspaceProjectInput) => workspaceOpenTargetFromHook(
  input.terminal,
  {
    activeSessions: input.persistence.activeSessionByProjectRef,
    getSurfaceMode: () => input.shellLayout.agentSurfaceMode,
    latest: input.latest,
    now: Date.now,
    resetEditor: input.editorSession.resetEditor,
    resolveProfile: input.profiles.resolveProfile,
    restoredActiveFileWorkspace: input.editorSession.restoredActiveFileWorkspaceRef,
    savedLabelForSlot: input.persistence.savedPaneLabel,
    scheduleResize: input.scheduleResize,
    sessions: input.persistence.projectSessionsRef,
    setLaunchError: (message) => {
      input.setLaunchError(message);
      if (message) input.projectEntryOpen.reportError(message);
    },
    setWorkspacePath: input.setWorkspacePath,
    workspacePath: input.workspacePathRef,
  },
);

const workspaceOpenFrom = (
  input: WorkspaceProjectInput,
  snapshots: ReturnType<typeof snapshotActionsFrom>,
) => createWorkspaceOpenSurface({
  actions: {
    captureCurrentSession: snapshots.capture,
    clearBackgroundExits: (path) => input.setBackgroundExits(
      (exits) => clearBackgroundExitsForProject(exits, path),
    ),
    dirtyTabPaths: input.editorWorkspace.dirtyTabPaths,
    editorDirty: input.editorWorkspace.editorDirty,
    editorTabs: input.editorSession.editorTabs,
    flushComposer: input.composerLocal.flush,
    getDefaultProfile: () => input.profiles.launchProfileRef.current,
    getPreviousActivePaneId: () => input.terminal.activePaneIdRef.current,
    getPreviousPanes: () => input.terminal.panesRef.current,
    getPreviousRoot: () => input.workspacePathRef.current,
    getSelectedFilePath: () => input.editorSession.selectedFileRef.current?.path ?? null,
    getStore: () => input.storeRef.current,
    openEditorFile: input.openEditorFile,
    setFocusedPane: input.terminal.setFocusedPane,
  },
  connectionSettings: input.connectionSettings,
  lifecycle: workspaceLifecycleFrom(input, snapshots.restore),
  target: workspaceTargetFrom(input),
});

const projectCloseFrom = (
  input: WorkspaceProjectInput,
  workspaceOpen: ReturnType<typeof workspaceOpenFrom>,
) => createProjectCloseController(projectCloseFromHook(input.terminal, {
  clearActiveWorkspace: () => {
    input.setWorkspacePath(null);
    input.terminal.setManagedPanes([]);
    input.terminal.setFocusedPane(null);
    input.latest.current = null;
    input.workspaceTree.setTree([]);
    input.editorSession.resetEditor();
  },
  closePane: (paneId) => invoke("close_pane", { paneId }),
  confirmClose: (message) => confirmDialog(message),
  conversations: input.composerWorkspace.chatConversationsRef,
  deleteStoredFolder: async () => { await input.storeRef.current?.delete("folder"); },
  dirtyTabCount: input.editorWorkspace.dirtyTabPaths.length,
  hasSelectedFile: () => input.editorSession.selectedFileRef.current != null,
  openProjects: input.persistence.openProjectsRef,
  openWorkspace: workspaceOpen.openWorkspaceDirect,
  persistOpenProjects: input.persistence.persistOpenProjects,
  saveStore: async () => { await input.storeRef.current?.save(); },
  setActionNotice: input.chrome.setActionNotice,
  setLaunchError: input.setLaunchError,
  stopChatRun: (runId) => invoke("stop_chat_run", { runId }),
  stopWorkspaceWatcher: () => invoke("stop_workspace_watcher"),
  workspacePath: input.workspacePathRef,
}));

export const appWorkspaceProjectRuntimeFrom = (input: WorkspaceProjectInput) => {
  const snapshots = snapshotActionsFrom(input);
  const workspaceOpenActions = workspaceOpenFrom(input, snapshots);
  const requestOpenWorkspace = (path: string) => input.projectEntryOpen.track(path, () =>
    workspaceOpenActions.requestOpenWorkspace(path, () => input.requestEditorNavigation({ kind: "workspace", path })),
  );
  const projectCloseController = projectCloseFrom(input, workspaceOpenActions);
  return {
    captureCurrentSessionSnapshot: snapshots.capture,
    projectCloseController,
    requestCloseProject: (project: OpenProject) => projectCloseController.requestCloseProject(
      project,
      () => input.requestEditorNavigation({ kind: "close-project", projectPath: project.path }),
    ),
    requestOpenWorkspace,
    workspaceOpenActions,
  };
};
