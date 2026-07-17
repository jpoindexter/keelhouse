import { AppIcon, paneStateIconName } from "./icons";
import type { TerminalPaneState } from "./terminalPane";
import { ToolDockMenu } from "./ToolDockMenu";
import { toggleNativeWindowMaximize } from "./windowControls";
import type { ToolTrayMode, WorkbenchLayoutMode } from "./workbenchLayout";

export type AppTitlebarProps = {
  activeSessionTitle: string;
  hasWorkspace: boolean;
  layout: WorkbenchLayoutMode;
  primarySurfaceLabel: string;
  primarySurfaceState: TerminalPaneState;
  primarySurfaceStatusLabel: string;
  sideDrawerOpen: boolean;
  terminalOpen: boolean;
  toolMode: ToolTrayMode;
  toolsOpen: boolean;
  onCreateChat: () => void;
  onLayoutChange: (layout: WorkbenchLayoutMode) => void;
  onOpenCommandPalette: () => void;
  onOpenSettings: () => void;
  onOpenWorkspace: () => void;
  onResetInterface: () => void;
  onToggleSideDrawer: () => void;
  onToggleTerminal: () => void;
  onToggleTools: () => void;
  onToolModeChange: (mode: ToolTrayMode) => void;
};

const TitlebarIdentity = (props: Pick<AppTitlebarProps, "hasWorkspace" | "sideDrawerOpen" | "onCreateChat" | "onOpenCommandPalette" | "onResetInterface" | "onToggleSideDrawer">) => (
  <div className="titlebar-identity" data-tauri-drag-region>
    <button className={`titlebar-action titlebar-leading-action ${props.sideDrawerOpen ? "titlebar-action--active" : ""}`} type="button" title="Toggle Threads" aria-label="Toggle Threads" aria-pressed={props.sideDrawerOpen} onClick={props.onToggleSideDrawer}><AppIcon name="panelLeft" /></button>
    <button className="titlebar-action" type="button" title="New Task" aria-label="New Task" onClick={props.onCreateChat}><AppIcon name="newChat" /></button>
    <button className="titlebar-action" type="button" title="Search tasks or run a command" aria-label="Search tasks or run a command" onClick={props.onOpenCommandPalette}><AppIcon name="search" /></button>
    <button className="titlebar-action" type="button" title="Reset interface" aria-label="Reset interface" onClick={props.onResetInterface}><AppIcon name="reload" /></button>
  </div>
);

const ActiveChatContext = (props: Pick<AppTitlebarProps, "activeSessionTitle" | "hasWorkspace" | "layout" | "toolMode" | "onLayoutChange" | "onOpenWorkspace" | "onToolModeChange">) => (
  <div className="titlebar-agent-context" aria-label="Active chat" data-tauri-drag-region>
    <div className="titlebar-workspace" data-tauri-drag-region onDoubleClick={(event) => { event.preventDefault(); void toggleNativeWindowMaximize(); }} title="Current chat. Double-click to maximize or restore the window.">
      <AppIcon name="file" /><span>{props.activeSessionTitle}</span>
    </div>
    <div className="titlebar-chat-actions" aria-label="Chat actions">
      <button className="titlebar-action" type="button" title="Open workspace externally" aria-label="Open workspace externally" disabled={!props.hasWorkspace} onClick={props.onOpenWorkspace}><AppIcon name="openExternal" /></button>
      <ToolDockMenu layout={props.layout} toolMode={props.toolMode} onLayoutChange={props.onLayoutChange} onToolModeChange={props.onToolModeChange} />
    </div>
  </div>
);

const TitlebarActions = (props: Pick<AppTitlebarProps, "primarySurfaceLabel" | "primarySurfaceState" | "primarySurfaceStatusLabel" | "terminalOpen" | "toolsOpen" | "onOpenSettings" | "onToggleTerminal" | "onToggleTools">) => (
  <div className="titlebar-actions">
    <div className="titlebar-panel-toggles" aria-label="Toggle panels">
      <button className={`titlebar-action ${props.terminalOpen ? "titlebar-action--active" : ""}`} type="button" title={props.terminalOpen ? "Hide Terminal" : "Show Terminal"} aria-label="Toggle Terminal tray" aria-pressed={props.terminalOpen} onClick={props.onToggleTerminal}><AppIcon name="panelBottom" /></button>
      <button className={`titlebar-action ${props.toolsOpen ? "titlebar-action--active" : ""}`} type="button" title="Toggle Tools" aria-label="Toggle Tools" aria-pressed={props.toolsOpen} onClick={props.onToggleTools}><AppIcon name="panelRight" /></button>
    </div>
    <span className={`titlebar-pill titlebar-pill--${props.primarySurfaceState}`} title={`${props.primarySurfaceLabel} · ${props.primarySurfaceStatusLabel}`}><AppIcon name={paneStateIconName(props.primarySurfaceState)} /><span>{props.primarySurfaceLabel}</span></span>
    <button className="titlebar-action" type="button" title="More" aria-label="Open settings and more" onClick={props.onOpenSettings}><AppIcon name="more" /></button>
  </div>
);

export const AppTitlebar = (props: AppTitlebarProps) => (
  <header className="app-titlebar" aria-label="Application chrome" data-tauri-drag-region>
    <TitlebarIdentity {...props} />
    <div className="titlebar-splitter" aria-hidden="true" />
    <ActiveChatContext {...props} />
    <div className="titlebar-splitter" aria-hidden="true" />
    <TitlebarActions {...props} />
  </header>
);
