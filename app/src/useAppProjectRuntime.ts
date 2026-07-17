import { appProjectSessionRuntimeFrom } from "./appProjectSessionRuntime";
import { appWorkspaceProjectRuntimeFrom } from "./appWorkspaceProjectRuntime";
import type { FileTreeNode } from "./fileTreeTypes";
import type { LaunchProfile } from "./launchProfiles";
import { useAppConversationBridge } from "./useAppConversationBridge";
import type { useAppFoundationRuntime } from "./useAppFoundationRuntime";
import type { EditorPendingNavigation } from "./useEditorNavigationLifecycle";

type Cell = { t: string; f: [number, number, number]; b: [number, number, number]; bold: boolean };
type Snapshot = { cols: number; rows: number; cx: number; cy: number; cvis: boolean; sb: number; cells: Cell[] };
type Foundation = ReturnType<typeof useAppFoundationRuntime<Snapshot>>;

type AppProjectRuntimeInput = {
  createTerminalPane: (profile: LaunchProfile) => Promise<boolean>;
  foundation: Foundation;
  openEditorFile: (file: FileTreeNode) => Promise<unknown>;
  requestEditorNavigation: (navigation: EditorPendingNavigation) => void;
  scheduleResize: () => void;
  switchSession: (root: string, sessionId: string) => Promise<unknown>;
};

export const useAppProjectRuntime = (input: AppProjectRuntimeInput) => {
  const { foundation } = input;
  const { root, shell, workspace } = foundation;
  const chatIdForSession = (rootPath: string, sessionId: string) => `${rootPath}\n${sessionId}`;
  const conversationBridge = useAppConversationBridge({
    ...foundation.conversation, activeAgentSession: foundation.activeAgentSession,
    chatIdForSession, chatSearch: shell.chatSearch, chrome: shell.chrome,
    composerWorkspace: workspace.composerWorkspace, persistence: workspace.persistence,
    setLaunchError: root.setLaunchError, switchSession: input.switchSession,
    terminal: workspace.terminal, workspacePathRef: root.workspacePathRef,
  });
  const workspaceProject = appWorkspaceProjectRuntimeFrom({
    browser: foundation.conversation.browser, chrome: shell.chrome,
    composerLocal: foundation.composer.composerLocal, composerWorkspace: workspace.composerWorkspace,
    connectionSettings: root.aiConnectionSettingsRef, editorSession: workspace.editorSession,
    editorWorkspace: foundation.editorWorkspace, latest: root.latest,
    openEditorFile: input.openEditorFile, persistence: workspace.persistence, profiles: workspace.profiles,
    projectEntryOpen: shell.projectEntryOpen, requestEditorNavigation: input.requestEditorNavigation,
    scheduleResize: input.scheduleResize, setBackgroundExits: shell.setBackgroundExits,
    setLaunchError: root.setLaunchError, setWorkspacePath: root.setWorkspacePath,
    shellLayout: shell.shellLayout, storeRef: root.storeRef, terminal: workspace.terminal,
    workspacePathRef: root.workspacePathRef, workspaceTree: workspace.workspaceTree,
  });
  const projectSession = appProjectSessionRuntimeFrom({
    ...foundation.conversation, captureCurrentSession: workspaceProject.captureCurrentSessionSnapshot,
    chatSearch: shell.chatSearch, chrome: shell.chrome, composerLocal: foundation.composer.composerLocal,
    composerWorkspace: workspace.composerWorkspace, createTerminalPane: input.createTerminalPane,
    persistence: workspace.persistence, profiles: workspace.profiles,
    requestOpenWorkspace: workspaceProject.requestOpenWorkspace, scheduleResize: input.scheduleResize,
    setFocusedChatMessageId: shell.setFocusedChatMessageId, setLaunchError: root.setLaunchError,
    setProjectCreationOpen: root.setProjectCreationOpen, setProjectSwitcherOpen: root.setProjectSwitcherOpen,
    shellLayout: shell.shellLayout, storeRef: root.storeRef, terminal: workspace.terminal,
    workspaceOpenActions: workspaceProject.workspaceOpenActions, workspacePathRef: root.workspacePathRef,
  });
  return { chatIdForSession, ...conversationBridge, ...projectSession, ...workspaceProject };
};
