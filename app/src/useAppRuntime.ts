import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { AppActionAuditEvent, AppActionDescriptor } from "./appActions";
import { visibleAppCommandPaletteCommands } from "./appCommandPaletteHost";
import { appInteractionSurfaceRuntimeFrom } from "./appInteractionSurfaceRuntime";
import { appRuntimeMenusFrom } from "./appRuntimeMenuHost";
import { deriveAppSurfaceLabels } from "./appSurfaceLabels";
import { resetDurableChatStore } from "./chatStore";
import { createPaneTranscriptCapture } from "./paneTranscriptCapture";
import { projectRailStatusFromConversations, projectSessionStatusFromConversations } from "./projectChatStatus";
import { visibleProjectsFrom } from "./projectRailView";
import { createRenderPerfExport } from "./renderPerfExport";
import { buildSettingsActions } from "./settingsActionsHost";
import { setActiveKeybindingOverrides } from "./shortcuts";
import { activePaneDisplayLabel } from "./terminalPane";
import { useAgentHookRuntime } from "./useAgentHookRuntime";
import { useAppEditorRuntime } from "./useAppEditorRuntime";
import { useAppFoundationRuntime } from "./useAppFoundationRuntime";
import { useAppProjectRuntime } from "./useAppProjectRuntime";
import { useAppTerminalRuntime } from "./useAppTerminalRuntime";
import { useEditorWorkspaceRuntime } from "./useEditorWorkspaceRuntime";
import type { OpenProject, ProjectRailStatus, ProjectSession } from "./workspaceState";

type Cell = { t: string; f: [number, number, number]; b: [number, number, number]; bold: boolean };
type Snapshot = { cols: number; rows: number; cx: number; cy: number; cvis: boolean; sb: number; cells: Cell[] };
type Foundation = ReturnType<typeof useAppFoundationRuntime<Snapshot>>;
type Project = ReturnType<typeof useAppProjectRuntime>;
type Interaction = ReturnType<typeof appInteractionSurfaceRuntimeFrom>;
type Editor = ReturnType<typeof useAppEditorRuntime>;
type CoreRuntime = { editor: Editor; foundation: Foundation; interaction: Interaction; project: Project };

const useAppCoreRuntime = (): CoreRuntime => {
  let foundation!: Foundation;
  let project!: Project;
  let interaction!: Interaction;
  let editor!: Editor;
  foundation = useAppFoundationRuntime<Snapshot>({
    gateAction: (action: AppActionDescriptor): Promise<AppActionAuditEvent> =>
      foundation.conversation.agentActivityHook.gateAppAction(action),
    hasUnsaved: (path) => editor.editorSurface.editorHasUnsavedBufferForPath(path),
    logComposerEvent: (label, detail) => project.logComposerHarnessEvent(label, detail),
  });
  project = useAppProjectRuntime({
    createTerminalPane: (profile) => interaction.terminalSurface.createTerminalPane(profile), foundation,
    openEditorFile: (file) => editor.editorFileWorkflow.openDirect(file),
    requestEditorNavigation: (navigation) => editor.editorNavigation.requestNavigation(navigation),
    scheduleResize: () => setTimeout(interaction.sendTerminalResize, 0),
    switchSession: (root, sessionId) => project.projectSessionNavigationActions.switchSession(root, sessionId),
  });
  interaction = appInteractionSurfaceRuntimeFrom({
    foundation, getEditorSurface: () => editor.editorSurface,
    getSaveEditorFile: () => editor.saveEditorFile,
    getTerminalLabel: () => activePaneDisplayLabel(
      foundation.workspace.terminal.panes, foundation.activeAgentSession.activeTerminalPane,
    ),
    project,
  });
  editor = useAppEditorRuntime({ foundation, interaction, project });
  return { editor, foundation, interaction, project };
};

const projectRailRuntimeFrom = (core: CoreRuntime) => {
  const { foundation } = core;
  const { composerWorkspace, persistence, terminal } = foundation.workspace;
  const { workspacePath } = foundation.root;
  const projectRailStatus = (project: OpenProject): ProjectRailStatus =>
    projectRailStatusFromConversations(composerWorkspace.chatConversations, project.path);
  const projectSessionsFor = (projectPath: string) => persistence.projectSessions[projectPath] ?? [];
  const projectSessionStatus = (projectPath: string, session: ProjectSession): ProjectRailStatus =>
    projectSessionStatusFromConversations(composerWorkspace.chatConversations, projectPath, session.id);
  const visibleOpenProjects = visibleProjectsFrom(
    persistence.openProjects, workspacePath, terminal.activeProjectStatus,
  );
  const surfaceLabels = deriveAppSurfaceLabels({
    activeRunId: foundation.conversation.activeChat.activeChatConversation.activeRunId,
    activeSessionId: foundation.conversation.activeChat.activeSessionId,
    sessions: projectSessionsFor(workspacePath ?? ""),
    trayMode: foundation.shell.shellLayout.utilityTrayMode, workspacePath,
  });
  return { projectRailStatus, projectSessionStatus, surfaceLabels, visibleOpenProjects };
};

const exportRuntimeFrom = (core: CoreRuntime) => {
  const { foundation } = core;
  const { renderPerfRef, setLaunchError, workspacePathRef } = foundation.root;
  const { terminal } = foundation.workspace;
  const saveActivePaneTranscript = createPaneTranscriptCapture({
    getActivePane: () => foundation.activeAgentSession.activeTerminalPane,
    getPanes: () => terminal.panes, getRoot: () => workspacePathRef.current,
    getSessionId: () => foundation.conversation.activeChat.activeSessionId,
    getSnapshot: (paneId) => terminal.snapshotsRef.current[paneId], now: Date.now,
    persist: foundation.shell.paneTranscripts.persistPaneTranscript,
  });
  const exportRenderPerfSnapshot = createRenderPerfExport({
    createFile: (root, parent, name) => invoke("create_workspace_file", { root, parent, name }),
    getPaneCount: (root) => terminal.panesForSession(root).length,
    getPerfState: () => renderPerfRef.current, getRoot: () => workspacePathRef.current,
    now: () => new Date().toISOString(), setError: setLaunchError,
    writeFile: (root, path, content, expectedModifiedMs) =>
      invoke("write_text_file", { root, path, content, expectedModifiedMs }),
  });
  return { exportRenderPerfSnapshot, saveActivePaneTranscript };
};

const appMenusFrom = (
  core: CoreRuntime,
  exports: ReturnType<typeof exportRuntimeFrom>,
  rail: ReturnType<typeof projectRailRuntimeFrom>,
) => {
  const { editor, foundation, interaction, project } = core;
  const { root, shell, workspace } = foundation;
  const { activeChat, browser } = foundation.conversation;
  const { appMenuAssembly, terminalContextMenuItems } = appRuntimeMenusFrom({
    ...foundation.composer, ...interaction, activeAgentSession: foundation.activeAgentSession,
    activeChat, browser, chrome: shell.chrome, composerSending: shell.composerSending,
    contextMenuHost: foundation.contextMenuHost, editorSession: workspace.editorSession,
    editorSurface: editor.editorSurface, profiles: workspace.profiles,
    saveActivePaneTranscript: exports.saveActivePaneTranscript,
    setOrchestrationError: shell.setOrchestrationError,
    setOrchestrationOpen: shell.setOrchestrationOpen, shellLayout: shell.shellLayout,
    terminal: workspace.terminal, workspacePath: root.workspacePath, worktrees: shell.worktrees,
  });
  const visiblePaletteCommands = visibleAppCommandPaletteCommands({
    ...foundation.composer, ...foundation.search, ...interaction,
    activeAgentSession: foundation.activeAgentSession, activeChat, browser,
    chatSearchViewResults: foundation.search.chatSearchViewResults,
    closeSelectedEditorTab: () => {
      const selected = workspace.editorSession.selectedFile;
      if (selected) void editor.editorNavigation.closeTab(selected);
    },
    commandPalette: foundation.commandPalette, commandPaletteSources: shell.commandPaletteSources,
    editorFileWorkflow: editor.editorFileWorkflow, editorSession: workspace.editorSession,
    editorSurface: editor.editorSurface, editorWorkspace: foundation.editorWorkspace,
    exportRenderPerfSnapshot: exports.exportRenderPerfSnapshot,
    openChatSearchResult: project.openChatSearchResult, paneTranscripts: shell.paneTranscripts,
    persistence: workspace.persistence, profiles: workspace.profiles,
    projectEntryActions: project.projectEntryActions,
    projectSessionNavigationActions: project.projectSessionNavigationActions,
    quickOpen: foundation.search.quickOpen, saveEditorFile: editor.saveEditorFile,
    setOrchestrationError: shell.setOrchestrationError, setOrchestrationOpen: shell.setOrchestrationOpen,
    setSettingsOpen: shell.setSettingsOpen, shellLayout: shell.shellLayout,
    terminal: workspace.terminal, terminalFind: foundation.terminalFind,
    visibleOpenProjects: rail.visibleOpenProjects, workspacePath: root.workspacePath,
    worktrees: shell.worktrees,
  });
  return { appMenuAssembly, terminalContextMenuItems, visiblePaletteCommands };
};

const useAppLifecycles = (core: CoreRuntime) => {
  const { editor, foundation, interaction, project } = core;
  const { root, shell, workspace } = foundation;
  useAgentHookRuntime({
    activeChat: foundation.conversation.activeChat,
    agentActivityHook: foundation.conversation.agentActivityHook,
    editorFileWorkflow: editor.editorFileWorkflow, editorSession: workspace.editorSession,
    persistence: workspace.persistence, setStatus: root.setAgentHookStatus,
    terminal: workspace.terminal, terminalSurface: interaction.terminalSurface,
    workspacePath: root.workspacePath, workspacePathRef: root.workspacePathRef,
  });
  useEditorWorkspaceRuntime({
    editorFileWorkflow: editor.editorFileWorkflow, editorSession: workspace.editorSession,
    editorWorkspace: foundation.editorWorkspace, persistence: workspace.persistence,
    treeRef: root.treeRef, workspacePath: root.workspacePath,
    workspacePathRef: root.workspacePathRef, workspaceTree: workspace.workspaceTree,
  });
  useAppTerminalRuntime({
    approvalMode: foundation.conversation.agentApprovalMode, browser: foundation.conversation.browser,
    commandPalette: foundation.commandPalette,
    detectLocalServer: project.detectLocalDevServerFromSnapshot,
    pickWorkspace: project.pickWorkspace, projectEntryActions: project.projectEntryActions,
    quickOpen: foundation.search.quickOpen,
    recordActivity: foundation.conversation.agentActivityHook.recordAgentActivity,
    sendResize: interaction.sendTerminalResize,
    setAgentActivity: foundation.conversation.agentActivityHook.setAgentActivityEvents,
    setError: root.setLaunchError, setSettingsOpen: shell.setSettingsOpen,
    shell: {
      chrome: shell.chrome, mcpOAuth: shell.mcpOAuth, paneTranscripts: shell.paneTranscripts,
      setAiConnectionSettings: shell.setAiConnectionSettings,
      setBackgroundExits: shell.setBackgroundExits,
      setCommandPaletteSources: shell.setCommandPaletteSources,
      setKeybindingOverrides: shell.setKeybindingOverrides, setWorktrees: shell.setWorktrees,
    },
    workspace, workspaceOpenActions: project.workspaceOpenActions,
    workspacePathRef: root.workspacePathRef,
    refs: {
      aiConnectionSettings: root.aiConnectionSettingsRef, canvas: root.canvasRef, frame: root.frame,
      imeInput: root.imeInputRef, ipcSampleCounter: root.ipcSampleCounter, latest: root.latest,
      metrics: root.metrics, renderPerf: root.renderPerfRef, selection: root.selection,
      selecting: root.selecting, store: root.storeRef, terminalHost: root.terminalHostRef,
    },
  });
};

const settingsRuntimeFrom = (core: CoreRuntime) => {
  const { foundation, interaction } = core;
  const { root, shell, workspace } = foundation;
  return buildSettingsActions({
    aiConnectionSettingsRef: root.aiConnectionSettingsRef,
    browser: foundation.conversation.browser, chrome: shell.chrome,
    commandPaletteSources: shell.commandPaletteSources,
    composerSettingsActions: interaction.composerSettingsActions,
    composerWorkspace: workspace.composerWorkspace, keybindingOverrides: shell.keybindingOverrides,
    mcpOAuth: shell.mcpOAuth, persistence: workspace.persistence, profiles: workspace.profiles,
    resetDurableChats: resetDurableChatStore, setActiveKeybindingOverrides,
    setAiConnectionSettings: shell.setAiConnectionSettings,
    setCommandPaletteSources: shell.setCommandPaletteSources,
    setKeybindingOverrides: shell.setKeybindingOverrides, storeRef: root.storeRef,
    workspacePath: root.workspacePath, workspacePathRef: root.workspacePathRef,
  });
};

const appWorkbenchPropsFrom = (
  core: CoreRuntime,
  menus: ReturnType<typeof appMenusFrom>,
  rail: ReturnType<typeof projectRailRuntimeFrom>,
  settings: ReturnType<typeof settingsRuntimeFrom>,
) => ({
  ...core.foundation.root, ...core.foundation.workspace, ...core.foundation.shell,
  ...core.foundation.search, ...core.foundation.conversation, ...core.foundation.composer,
  ...core.foundation, ...core.project, ...core.interaction, ...core.editor, ...menus, ...rail,
  connectionActions: settings.settingsConnectionActions,
  contextMenuElement: core.foundation.contextMenuHost.element,
  openUrl, preferenceActions: settings.settingsPreferenceActions,
  scopedActions: settings.settingsScopedActions,
  worktreeLabelDialog: core.foundation.root.worktreeLabelRequest.dialog,
});

export const useAppRuntime = () => {
  const core = useAppCoreRuntime();
  const rail = projectRailRuntimeFrom(core);
  const exports = exportRuntimeFrom(core);
  const menus = appMenusFrom(core, exports, rail);
  useAppLifecycles(core);
  return appWorkbenchPropsFrom(core, menus, rail, settingsRuntimeFrom(core));
};
