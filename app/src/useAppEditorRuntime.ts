import { appEditorMenusFrom } from "./appEditorMenuRuntime";
import type { appInteractionSurfaceRuntimeFrom } from "./appInteractionSurfaceRuntime";
import { useAppEditorSurfaceRuntime } from "./useAppEditorSurfaceRuntime";
import type { useAppFoundationRuntime } from "./useAppFoundationRuntime";
import type { useAppProjectRuntime } from "./useAppProjectRuntime";

type Cell = { t: string; f: [number, number, number]; b: [number, number, number]; bold: boolean };
type Snapshot = { cols: number; rows: number; cx: number; cy: number; cvis: boolean; sb: number; cells: Cell[] };
type Foundation = ReturnType<typeof useAppFoundationRuntime<Snapshot>>;
type Interaction = ReturnType<typeof appInteractionSurfaceRuntimeFrom>;
type Project = ReturnType<typeof useAppProjectRuntime>;

type AppEditorRuntimeInput = {
  foundation: Foundation;
  interaction: Interaction;
  project: Project;
};

export const useAppEditorRuntime = (input: AppEditorRuntimeInput) => {
  const { foundation, project } = input;
  const { root, shell, workspace } = foundation;
  const editorRuntime = useAppEditorSurfaceRuntime({
    activeAgentSession: foundation.activeAgentSession,
    agentActivityHook: foundation.conversation.agentActivityHook, chrome: shell.chrome,
    diffReview: foundation.diffReviewHook, editorSession: workspace.editorSession,
    editorWorkspace: foundation.editorWorkspace, gitStatus: shell.gitStatusHook,
    persistence: workspace.persistence, projectClose: project.projectCloseController,
    shellLayout: shell.shellLayout, workspaceOpen: project.workspaceOpenActions,
    workspacePath: root.workspacePath, workspacePathRef: root.workspacePathRef,
    workspaceTree: workspace.workspaceTree,
  });
  const menus = appEditorMenusFrom({
    activeChat: foundation.conversation.activeChat,
    agentActivityHook: foundation.conversation.agentActivityHook, chrome: shell.chrome,
    composerHarnessSessionKey: project.chatIdForSession,
    composerSurface: input.interaction.composerSurface,
    composerWorkspace: workspace.composerWorkspace,
    deleteSession: project.projectSessionDeletionController.deleteProjectSession,
    diffReview: foundation.diffReviewHook, editor: editorRuntime,
    editorSession: workspace.editorSession, editorWorkspace: foundation.editorWorkspace,
    fileNodeItemsRef: root.fileNodeContextMenuItemsRef, gitStatus: shell.gitStatusHook,
    persistence: workspace.persistence, projectEntry: project.projectEntryActions,
    projectSessionMetadata: project.projectSessionMetadataActions,
    projectSessions: project.projectSessionNavigationActions,
    requestCloseProject: project.requestCloseProject, setError: root.setLaunchError,
    workspacePath: root.workspacePath, workspacePathRef: root.workspacePathRef,
    workspaceTree: workspace.workspaceTree,
  });
  return { ...editorRuntime, ...menus };
};
