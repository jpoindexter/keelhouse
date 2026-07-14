import {
  DEFAULT_SIDE_DRAWER_WIDTH,
  DEFAULT_TOOL_TRAY_MODE,
  DEFAULT_WORKBENCH_LAYOUT,
  DEFAULT_WORKBENCH_SIZING,
  normalizeStoredSideDrawerWidth,
} from "./workbenchLayout";
import type { ToolTrayMode, WorkbenchLayoutMode, WorkbenchSizing } from "./workbenchLayout";

const WORKBENCH_LAYOUT_STORAGE_KEY = "keelhouse.workbench.layout.v4";
const WORKBENCH_SIZING_STORAGE_KEY = "keelhouse.workbench.sizing.v2";
const TOOL_TRAY_MODE_STORAGE_KEY = "keelhouse.workbench.toolTrayMode.v4";
const SIDE_DRAWER_WIDTH_STORAGE_KEY = "keelhouse.sideDrawer.width.v3";
const SIDE_DRAWER_COLLAPSED_STORAGE_KEY = "keelhouse.sideDrawer.collapsed.v2";

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const readStoredWorkbenchLayout = (): WorkbenchLayoutMode => {
  try {
    const value = window.localStorage.getItem(WORKBENCH_LAYOUT_STORAGE_KEY);
    return value === "left" || value === "right" || value === "bottom" || value === "hidden" ? value : DEFAULT_WORKBENCH_LAYOUT;
  } catch {
    return DEFAULT_WORKBENCH_LAYOUT;
  }
};

export const readStoredWorkbenchSizing = (): WorkbenchSizing => {
  try {
    const raw = window.localStorage.getItem(WORKBENCH_SIZING_STORAGE_KEY);
    if (!raw) return DEFAULT_WORKBENCH_SIZING;
    const value = JSON.parse(raw) as Partial<WorkbenchSizing>;
    return {
      trayPercent: clamp(typeof value.trayPercent === "number" ? value.trayPercent : DEFAULT_WORKBENCH_SIZING.trayPercent, 18, 54),
      toolSplitPercent: clamp(typeof value.toolSplitPercent === "number" ? value.toolSplitPercent : DEFAULT_WORKBENCH_SIZING.toolSplitPercent, 25, 75),
    };
  } catch {
    return DEFAULT_WORKBENCH_SIZING;
  }
};

export const readStoredToolTrayMode = (): ToolTrayMode => {
  try {
    const value = window.localStorage.getItem(TOOL_TRAY_MODE_STORAGE_KEY);
    return value === "files" || value === "editor" || value === "browser" || value === "git" || value === "split" ? value : DEFAULT_TOOL_TRAY_MODE;
  } catch {
    return DEFAULT_TOOL_TRAY_MODE;
  }
};

export const readStoredSideDrawerWidth = () => {
  try {
    return normalizeStoredSideDrawerWidth(window.localStorage.getItem(SIDE_DRAWER_WIDTH_STORAGE_KEY));
  } catch {
    return DEFAULT_SIDE_DRAWER_WIDTH;
  }
};

export const readStoredSideDrawerCollapsed = () => {
  try {
    return window.localStorage.getItem(SIDE_DRAWER_COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
};

export const workbenchStorageKeys = {
  layout: WORKBENCH_LAYOUT_STORAGE_KEY,
  sizing: WORKBENCH_SIZING_STORAGE_KEY,
  toolTrayMode: TOOL_TRAY_MODE_STORAGE_KEY,
  sideDrawerWidth: SIDE_DRAWER_WIDTH_STORAGE_KEY,
  sideDrawerCollapsed: SIDE_DRAWER_COLLAPSED_STORAGE_KEY,
} as const;
