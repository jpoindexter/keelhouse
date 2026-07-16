import type { MouseEvent, PointerEvent, RefObject } from "react";
import type { AgentSessionHandle } from "./agentSessionHandle";
import type { BottomUtilityTrayProps } from "./BottomUtilityTray";
import type { UtilityTrayMode } from "./BottomUtilityTabs";
import type { ContextMenuItem } from "./ContextMenu";
import type { LaunchProfile } from "./launchProfiles";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import type { useShellLayout } from "./useShellLayout";
import type { useWorkspaceDomain } from "./useWorkspaceDomain";

type WorkspaceDomain = ReturnType<typeof useWorkspaceDomain>;

type BottomUtilityTrayInput = {
  activeAgentSession: {
    activeTerminalPane: ManagedTerminalPane | null;
    selectedAgentActivityLog: BottomUtilityTrayProps["events"];
  };
  activeAgentSessionHandle: AgentSessionHandle | null;
  activeTerminalProfile: { label: string };
  appMenuAssembly: {
    terminalPaneContextMenuItems: (pane: ManagedTerminalPane) => ContextMenuItem[];
    utilityTrayTabContextMenuItems: (mode: UtilityTrayMode) => ContextMenuItem[];
  };
  canvasRef: RefObject<HTMLCanvasElement | null>;
  contextMenuHost: { openContextMenu: (event: MouseEvent, items: ContextMenuItem[]) => void };
  defaultTerminalLaunchProfile: () => LaunchProfile;
  imeInputRef: RefObject<HTMLTextAreaElement | null>;
  paste: (text: string) => void;
  pickWorkspace: (options?: { openTerminal?: boolean }) => Promise<unknown>;
  profiles: WorkspaceDomain["profiles"];
  renameTerminalPane: (pane: ManagedTerminalPane) => Promise<unknown>;
  shellLayout: ReturnType<typeof useShellLayout>;
  terminal: WorkspaceDomain["terminal"];
  terminalContextMenuItems: () => ContextMenuItem[];
  terminalFind: BottomUtilityTrayProps["find"];
  terminalHostRef: RefObject<HTMLDivElement | null>;
  terminalSurface: {
    createTerminalPane: (profile: LaunchProfile) => Promise<unknown>;
    focusTerminalPane: (paneId: number) => Promise<unknown>;
    restartTerminalPane: (pane: ManagedTerminalPane) => Promise<unknown>;
    terminateTerminalPane: (pane: ManagedTerminalPane) => Promise<unknown>;
  };
  utilityTrayControls: {
    openUtilityTray: (mode: UtilityTrayMode) => Promise<unknown>;
    toggleUtilityTrayVisibility: () => void;
  };
  workspacePath: string | null;
};

type TrayHandlers = Pick<
  BottomUtilityTrayProps,
  "onClose" | "onCreate" | "onFocus" | "onKill" | "onOpenFolder" | "onOpenTab" | "onPaneContextMenu"
  | "onPaste" | "onProfileChange" | "onRename" | "onResizeStart" | "onRestart" | "onStartShell"
  | "onTabContextMenu" | "onTerminalContextMenu" | "onToggleVisibility"
>;

const trayHandlersFrom = (input: BottomUtilityTrayInput): TrayHandlers => ({
  onClose: () => { if (input.activeAgentSessionHandle) void input.activeAgentSessionHandle.close(); },
  onCreate: (profile) => void input.terminalSurface.createTerminalPane(profile),
  onFocus: (paneId) => void input.terminalSurface.focusTerminalPane(paneId),
  onKill: () => { if (input.activeAgentSession.activeTerminalPane) void input.terminalSurface.terminateTerminalPane(input.activeAgentSession.activeTerminalPane); },
  onOpenFolder: () => void input.pickWorkspace({ openTerminal: true }),
  onOpenTab: (mode) => void input.utilityTrayControls.openUtilityTray(mode),
  onPaneContextMenu: (event, pane) => input.contextMenuHost.openContextMenu(event, input.appMenuAssembly.terminalPaneContextMenuItems(pane)),
  onPaste: (text) => input.paste(text),
  onProfileChange: (profileId) => { void input.profiles.switchTerminalProfile(input.profiles.resolveProfile(profileId)); },
  onRename: (pane) => void input.renameTerminalPane(pane),
  onResizeStart: (event: PointerEvent<HTMLButtonElement>) => { input.shellLayout.setAgentSurfaceMode("terminal"); input.shellLayout.beginUtilityTrayResize(event); },
  onRestart: () => { if (input.activeAgentSession.activeTerminalPane) void input.terminalSurface.restartTerminalPane(input.activeAgentSession.activeTerminalPane); },
  onStartShell: () => void input.terminalSurface.createTerminalPane(input.defaultTerminalLaunchProfile()),
  onTabContextMenu: (event, mode) => input.contextMenuHost.openContextMenu(event, input.appMenuAssembly.utilityTrayTabContextMenuItems(mode)),
  onTerminalContextMenu: (event) => input.contextMenuHost.openContextMenu(event, input.terminalContextMenuItems()),
  onToggleVisibility: input.utilityTrayControls.toggleUtilityTrayVisibility,
});

export const bottomUtilityTrayPropsFrom = (input: BottomUtilityTrayInput): BottomUtilityTrayProps => ({
  activePane: input.activeAgentSession.activeTerminalPane, activePaneId: input.terminal.activePaneId,
  activeProfileLabel: input.activeTerminalProfile.label, canClose: Boolean(input.activeAgentSessionHandle),
  canvasRef: input.canvasRef, events: input.activeAgentSession.selectedAgentActivityLog, find: input.terminalFind,
  hasWorkspace: Boolean(input.workspacePath), imeInputRef: input.imeInputRef,
  launchProfile: input.profiles.terminalProfile, launchProfileChanging: input.profiles.changing,
  launchProfiles: input.profiles.allProfiles,
  mode: input.shellLayout.utilityTrayMode, open: input.shellLayout.agentSurfaceMode === "terminal", panes: input.terminal.panes,
  terminalHostRef: input.terminalHostRef,
  ...trayHandlersFrom(input),
});
