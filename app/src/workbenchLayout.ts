export type WorkbenchLayoutMode = "left" | "right" | "bottom" | "hidden";
export type ToolTrayMode = "files" | "editor" | "browser" | "git" | "split";

export type WorkbenchSizing = {
  trayPercent: number;
  toolSplitPercent: number;
};

export const DEFAULT_WORKBENCH_LAYOUT: WorkbenchLayoutMode = "right";
export const DEFAULT_TOOL_TRAY_MODE: ToolTrayMode = "files";
export const DEFAULT_WORKBENCH_SIZING: WorkbenchSizing = { trayPercent: 39, toolSplitPercent: 58 };
export const DEFAULT_SIDE_DRAWER_WIDTH = 332;

export const normalizeStoredSideDrawerWidth = (value: string | null) => {
  if (value == null || value.trim() === "") return DEFAULT_SIDE_DRAWER_WIDTH;
  const width = Number(value);
  return Number.isFinite(width) ? Math.min(Math.max(width, 220), 420) : DEFAULT_SIDE_DRAWER_WIDTH;
};

export const effectiveWorkbenchLayout = (
  layout: WorkbenchLayoutMode,
  viewportWidth: number,
  narrowPanelOpen = false,
) => {
  if (layout === "left" || layout === "right") {
    return viewportWidth <= 1120 && !narrowPanelOpen ? "hidden" : layout;
  }
  return layout;
};

export const usableAgentWidth = ({
  viewportWidth,
  drawerWidth,
  drawerCollapsed,
  layout,
  trayPercent,
}: {
  viewportWidth: number;
  drawerWidth: number;
  drawerCollapsed: boolean;
  layout: WorkbenchLayoutMode;
  trayPercent: number;
}) => {
  const mainWidth = viewportWidth - (drawerCollapsed ? 52 : drawerWidth);
  return layout === "left" || layout === "right" ? mainWidth * (1 - trayPercent / 100) : mainWidth;
};

/* The centered run/activity/composer column is `min(860, agentWidth - pad)`.
   The horizontal padding narrows under 1100px so the column stays readable at
   the 900px minimum window instead of compressing below the 600px floor. */
export const RUN_COLUMN_MAX = 860;
export const runColumnPadding = (agentWidth: number) => (agentWidth < 1100 ? 24 : 56);
export const runColumnWidth = (agentWidth: number) =>
  Math.min(RUN_COLUMN_MAX, agentWidth - runColumnPadding(agentWidth));
