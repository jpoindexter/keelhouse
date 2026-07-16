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
