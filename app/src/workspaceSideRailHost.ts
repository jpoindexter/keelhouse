import type { RefObject } from "react";
import type { TreeApi } from "react-arborist";
import { browserToolsDrawerPropsFrom } from "./browserPreviewHost";
import type { ContextMenuItem } from "./ContextMenu";
import type { FileTreeNode } from "./fileTreeTypes";
import { pathBasename } from "./fileTreeTypes";
import type { GitStatusFile } from "./fileGitStatus";
import { quickSettingsDrawerPropsFrom } from "./quickSettingsHost";
import type { useConversationRuntime } from "./useConversationRuntime";
import type { useShellLayout } from "./useShellLayout";
import type { useWorkspaceDomain } from "./useWorkspaceDomain";
import type { WorkspaceSideRailProps } from "./WorkspaceSideRail";
import type { AgentApprovalMode } from "./agentSessionHandle";
import type { OpenProject, ProjectRailStatus, ProjectSession } from "./workspaceState";
import { toggleExpandedProject } from "./projectRailView";

type ConversationRuntime = ReturnType<typeof useConversationRuntime>;
type WorkspaceDomain = ReturnType<typeof useWorkspaceDomain>;

type WorkspaceSideRailInput = {
  activeChat: ConversationRuntime["activeChat"];
  backgroundExits: WorkspaceSideRailProps["projects"]["backgroundExits"];
  browser: ConversationRuntime["browser"];
  composerSettingsActions: { setApprovalMode: (mode: AgentApprovalMode) => Promise<unknown> };
  contextMenuHost: { openContextMenu: (event: React.MouseEvent, items: ContextMenuItem[]) => void };
  diffReviewHook: { open: (file: GitStatusFile) => Promise<unknown> };
  drawerActiveTitle: string;
  editorFileWorkflow: { requestOpen: (file: FileTreeNode, options: { focusEditor: boolean }) => void };
  editorSession: WorkspaceDomain["editorSession"];
  editorWorkspace: { visibleFileTree: FileTreeNode[] };
  gitStatusHook: {
    error: string | null; loading: boolean; refresh: () => Promise<unknown>;
    status: WorkspaceSideRailProps["git"]["status"];
  };
  openUrl: (url: string) => Promise<unknown>;
  persistence: WorkspaceDomain["persistence"];
  pickWorkspace: () => Promise<unknown>;
  profiles: WorkspaceDomain["profiles"];
  projectEntryActions: { newProject: () => Promise<unknown>; openProject: () => Promise<unknown> };
  projectRailContextMenuItems: (project: OpenProject) => ContextMenuItem[];
  projectRailStatus: WorkspaceSideRailProps["projects"]["projectStatus"];
  projectSessionContextMenuItems: (path: string, session: ProjectSession) => ContextMenuItem[];
  projectSessionNavigationActions: { switchSession: (path: string, sessionId: string) => Promise<unknown> };
  projectSessionStatus: WorkspaceSideRailProps["projects"]["sessionStatus"];
  railBodyRef: RefObject<HTMLDivElement | null>;
  railHeight: number;
  requestOpenWorkspace: (path: string) => Promise<unknown>;
  setSettingsOpen: (open: boolean) => void;
  shellLayout: ReturnType<typeof useShellLayout>;
  treeRef: RefObject<TreeApi<FileTreeNode> | undefined>;
  utilityTrayControls: { toggleRawTerminal: () => Promise<unknown> };
  visibleOpenProjects: WorkspaceSideRailProps["projects"]["projects"];
  workspaceContextMenuItems: () => ContextMenuItem[];
  workspaceFileActions: { createFile: () => Promise<unknown>; createFolder: () => Promise<unknown> };
  workspacePath: string | null;
  workspaceTree: WorkspaceDomain["workspaceTree"];
};

const railProjectsFrom = (input: WorkspaceSideRailInput): WorkspaceSideRailProps["projects"] => {
  const closeNarrowDrawer = () => {
    if (input.shellLayout.viewportWidth <= 900) input.shellLayout.setSideDrawerCollapsed(true);
  };
  return {
    activeProjectPath: input.workspacePath, activeSessionId: input.activeChat.activeSessionId, backgroundExits: input.backgroundExits,
    expandedProjects: input.persistence.expandedSessionProjects, projects: input.visibleOpenProjects,
    recentProjects: input.persistence.recentProjects,
    sessionsByProject: input.persistence.projectSessions, showArchived: input.persistence.showArchivedSessions,
    projectStatus: input.projectRailStatus, sessionStatus: input.projectSessionStatus,
    onNewProject: () => { void input.projectEntryActions.newProject(); },
    onOpenProject: () => { void input.projectEntryActions.openProject(); },
    onProjectContextMenu: (event, project) => input.contextMenuHost.openContextMenu(event, input.projectRailContextMenuItems(project)),
    onSelectProject: (path) => { void input.requestOpenWorkspace(path); closeNarrowDrawer(); },
    onSelectSession: (path, sessionId) => { void input.projectSessionNavigationActions.switchSession(path, sessionId); closeNarrowDrawer(); },
    onSessionContextMenu: (event, path, session) => input.contextMenuHost.openContextMenu(event, input.projectSessionContextMenuItems(path, session)),
    onToggleArchived: () => input.persistence.setShowArchivedSessions((show) => !show),
    onToggleExpanded: (path) => input.persistence.setExpandedSessionProjects((expanded) => toggleExpandedProject(expanded, path)),
  };
};

const railGitFrom = (input: WorkspaceSideRailInput): WorkspaceSideRailProps["git"] => ({
  error: input.gitStatusHook.error, hasWorkspace: Boolean(input.workspacePath), loading: input.gitStatusHook.loading,
  status: input.gitStatusHook.status,
  onOpenDiff: (file) => void input.diffReviewHook.open(file), onRefresh: () => void input.gitStatusHook.refresh(),
});

const railSettingsFrom = (input: WorkspaceSideRailInput): WorkspaceSideRailProps["settings"] =>
  quickSettingsDrawerPropsFrom({
    composer: {
      approvalMode: input.activeChat.activeComposerHarness.approvalMode,
      canSetApproval: Boolean(input.activeChat.activeComposerHarnessKey),
    },
    handlers: {
      approvalChange: input.composerSettingsActions.setApprovalMode,
      layoutChange: input.shellLayout.setWorkbenchLayout,
      openFolder: () => input.pickWorkspace(),
      refreshFiles: input.workspaceTree.refresh,
      setSurfaceMode: input.shellLayout.setAgentSurfaceMode,
      toggleRawTerminal: input.utilityTrayControls.toggleRawTerminal,
      toolModeChange: input.shellLayout.setToolTrayMode,
    },
    layout: {
      surfaceMode: input.shellLayout.agentSurfaceMode, toolMode: input.shellLayout.toolTrayMode,
      workbenchLayout: input.shellLayout.renderedWorkbenchLayout,
    },
    profiles: input.profiles,
    workspacePath: input.workspacePath,
  });

const railFilesFrom = (input: WorkspaceSideRailInput): WorkspaceSideRailProps["files"] => ({
  fileOpError: input.editorSession.fileOpError, fileTree: input.workspaceTree.tree, fileTreeError: input.workspaceTree.error, fileTreeLoading: input.workspaceTree.loading, fileTreeTruncated: input.workspaceTree.truncated,
  railBodyRef: input.railBodyRef, railHeight: input.railHeight, selectedFileId: input.editorSession.selectedFile?.id, treeRef: input.treeRef, visibleFileTree: input.editorWorkspace.visibleFileTree,
  workspaceName: input.workspacePath ? pathBasename(input.workspacePath) : null, workspacePath: input.workspacePath,
  onCreateFile: () => void input.workspaceFileActions.createFile(), onCreateFolder: () => void input.workspaceFileActions.createFolder(),
  onOpenFile: (file) => void input.editorFileWorkflow.requestOpen(file, { focusEditor: true }),
  onOpenFolder: () => void input.pickWorkspace(),
  onWorkspaceContextMenu: (event) => input.contextMenuHost.openContextMenu(event, input.workspaceContextMenuItems()),
});

export const workspaceSideRailPropsFrom = (input: WorkspaceSideRailInput): WorkspaceSideRailProps => ({
  activeTitle: input.drawerActiveTitle,
  collapsed: input.shellLayout.sideDrawerCollapsed,
  mode: input.shellLayout.sideDrawerMode,
  onOpenSettings: () => input.setSettingsOpen(true),
  onSelectMode: input.shellLayout.setSideDrawerMode,
  projects: railProjectsFrom(input),
  git: railGitFrom(input),
  browser: browserToolsDrawerPropsFrom(input.browser, {
    openExternal: input.openUrl,
    show: () => input.shellLayout.setWorkbenchLayout(input.shellLayout.workbenchLayout === "hidden" ? "right" : input.shellLayout.workbenchLayout),
  }),
  settings: railSettingsFrom(input),
  files: railFilesFrom(input),
});

export type { ProjectRailStatus };
