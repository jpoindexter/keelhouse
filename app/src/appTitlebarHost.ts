import type { AppTitlebarProps } from "./AppTitlebar";
import type { WorkbenchLayoutMode } from "./workbenchLayout";

/**
 * The titlebar Tools toggle hides a visible dock, and restores the stored dock
 * side when hidden — defaulting to the right dock if no side was ever chosen.
 */
export const nextToolsLayout = (
  renderedLayout: WorkbenchLayoutMode,
  storedLayout: WorkbenchLayoutMode,
): WorkbenchLayoutMode => {
  if (renderedLayout !== "hidden") return "hidden";
  return storedLayout === "hidden" ? "right" : storedLayout;
};

type AppTitlebarInput = {
  activeSessionTitle: string;
  newTask: () => Promise<unknown>;
  openCommandPalette: () => void;
  openSettings: () => void;
  openWorkspaceFolder: (path: string) => Promise<unknown>;
  renderedLayout: WorkbenchLayoutMode;
  resetInterface: () => void;
  setLayout: (layout: WorkbenchLayoutMode) => void;
  setToolMode: AppTitlebarProps["onToolModeChange"];
  sideDrawerCollapsed: boolean;
  storedLayout: WorkbenchLayoutMode;
  surfaceLabel: string;
  surfaceState: AppTitlebarProps["primarySurfaceState"];
  surfaceStatusLabel: string;
  terminalOpen: boolean;
  toggleRawTerminal: () => Promise<unknown>;
  toggleSideDrawer: () => void;
  toolMode: AppTitlebarProps["toolMode"];
  workspacePath: string | null;
};

export const appTitlebarPropsFrom = (input: AppTitlebarInput): AppTitlebarProps => ({
  activeSessionTitle: input.activeSessionTitle,
  hasWorkspace: Boolean(input.workspacePath),
  layout: input.renderedLayout,
  primarySurfaceLabel: input.surfaceLabel,
  primarySurfaceState: input.surfaceState,
  primarySurfaceStatusLabel: input.surfaceStatusLabel,
  sideDrawerOpen: !input.sideDrawerCollapsed,
  terminalOpen: input.terminalOpen,
  toolMode: input.toolMode,
  toolsOpen: input.renderedLayout !== "hidden",
  onCreateChat: () => void input.newTask(),
  onLayoutChange: input.setLayout,
  onOpenCommandPalette: input.openCommandPalette,
  onOpenSettings: input.openSettings,
  onOpenWorkspace: () => { if (input.workspacePath) void input.openWorkspaceFolder(input.workspacePath); },
  onResetInterface: input.resetInterface,
  onToggleSideDrawer: input.toggleSideDrawer,
  onToggleTerminal: () => void input.toggleRawTerminal(),
  onToggleTools: () => input.setLayout(nextToolsLayout(input.renderedLayout, input.storedLayout)),
  onToolModeChange: input.setToolMode,
});
