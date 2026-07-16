import type { ManagedTerminalPane } from "./managedTerminalPane";
import { requestProjectClose as executeProjectCloseRequest } from "./projectCloseRequest";
import { closeProjectResources as executeProjectResourceClose } from "./projectResourceClose";
import {
  planProjectClose, removeOpenProject, type OpenProject,
} from "./workspaceState";

type Ref<T> = { current: T };

type ProjectCloseControllerOptions = {
  activePanes: Ref<Record<string, number>>;
  clearActiveWorkspace: () => void;
  closePane: (paneId: number) => Promise<unknown>;
  confirmClose: (message: string) => Promise<boolean>;
  conversations: Ref<Record<string, { activeRunId?: string | null }>>;
  deleteStoredFolder: () => Promise<unknown>;
  dirtyTabCount: number;
  getPanes: (projectPath: string) => ManagedTerminalPane[];
  hasSelectedFile: () => boolean;
  intentionallyTerminatedPaneIds: Set<number>;
  openProjects: Ref<OpenProject[]>;
  openWorkspace: (projectPath: string) => Promise<boolean>;
  persistOpenProjects: (projects: OpenProject[]) => Promise<unknown>;
  projectPanes: Ref<Record<string, ManagedTerminalPane[]>>;
  saveStore: () => Promise<unknown>;
  setActionNotice: (message: string) => void;
  setLaunchError: (message: string) => void;
  snapshots: Ref<Record<number, unknown>>;
  stopChatRun: (runId: string) => Promise<unknown>;
  stopWorkspaceWatcher: () => Promise<unknown>;
  workspacePath: Ref<string | null>;
};

const basename = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? path;

const closeResources = async (options: ProjectCloseControllerOptions, projectPath: string) => {
  const closed = await executeProjectResourceClose({
    activePanes: options.activePanes.current,
    closePane: options.closePane,
    conversations: options.conversations.current,
    intentionallyTerminatedPaneIds: options.intentionallyTerminatedPaneIds,
    panes: options.getPanes(projectPath),
    projectPanes: options.projectPanes.current,
    projectPath,
    snapshots: options.snapshots.current,
    stopChatRun: options.stopChatRun,
  });
  options.activePanes.current = closed.activePanes;
  options.projectPanes.current = closed.projectPanes;
};

const closeDirect = async (options: ProjectCloseControllerOptions, projectPath: string) => {
  const plan = planProjectClose(options.openProjects.current, options.workspacePath.current, projectPath);
  if (plan.remaining.length === options.openProjects.current.length) return false;
  try {
    if (plan.wasActive && plan.fallbackPath) {
      if (!await options.openWorkspace(plan.fallbackPath)) return false;
    }
    await closeResources(options, projectPath);
    if (plan.wasActive && !plan.fallbackPath) {
      await options.stopWorkspaceWatcher();
      options.workspacePath.current = null;
      options.clearActiveWorkspace();
      await options.deleteStoredFolder();
    }
    await options.persistOpenProjects(removeOpenProject(options.openProjects.current, projectPath));
    await options.saveStore();
    options.setActionNotice(`Closed ${basename(projectPath)}`);
    return true;
  } catch (error) {
    options.setLaunchError(`Could not close ${basename(projectPath)}: ${String(error)}`);
    return false;
  }
};

const requestClose = (
  options: ProjectCloseControllerOptions, project: OpenProject, deferNavigation: () => void,
) => executeProjectCloseRequest({
  activeProjectPath: options.workspacePath.current,
  closeProject: (path) => closeDirect(options, path),
  confirmDirtyTabs: (count) => options.confirmClose(
    `Close ${basename(project.path)} with ${count} unsaved editor tabs?`,
  ),
  confirmRunningTasks: (count) => options.confirmClose(
    `Close ${basename(project.path)} and stop ${count} running task${count === 1 ? "" : "s"}?`,
  ),
  conversations: options.conversations.current,
  deferNavigation,
  dirtyTabCount: options.dirtyTabCount,
  hasSelectedFile: options.hasSelectedFile(),
  panes: options.getPanes(project.path),
  projectPath: project.path,
});

export const createProjectCloseController = (options: ProjectCloseControllerOptions) => ({
  closeProjectDirect: (projectPath: string) => closeDirect(options, projectPath),
  closeProjectResources: (projectPath: string) => closeResources(options, projectPath),
  requestCloseProject: (project: OpenProject, deferNavigation: () => void) =>
    requestClose(options, project, deferNavigation),
});

type CloseHookBundle = {
  activePaneIdsRef: Ref<Record<string, number>>;
  intentionallyTerminatedPaneIdsRef: Ref<Set<number>>;
  panesByContextRef: Ref<Record<string, ManagedTerminalPane[]>>;
  panesForProject: (projectPath: string) => ManagedTerminalPane[];
  snapshotsRef: ProjectCloseControllerOptions["snapshots"];
};

type HookDerivedCloseKeys =
  | "activePanes" | "getPanes" | "intentionallyTerminatedPaneIds" | "projectPanes" | "snapshots";

export const projectCloseFromHook = (
  hook: CloseHookBundle,
  rest: Omit<ProjectCloseControllerOptions, HookDerivedCloseKeys>,
): ProjectCloseControllerOptions => ({
  ...rest,
  activePanes: hook.activePaneIdsRef,
  getPanes: hook.panesForProject,
  intentionallyTerminatedPaneIds: hook.intentionallyTerminatedPaneIdsRef.current,
  projectPanes: hook.panesByContextRef,
  snapshots: hook.snapshotsRef,
});
