import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  DEFAULT_SIDE_DRAWER_WIDTH,
  DEFAULT_TOOL_TRAY_MODE,
  DEFAULT_WORKBENCH_LAYOUT,
  DEFAULT_WORKBENCH_SIZING,
  effectiveWorkbenchLayout,
} from "./workbenchLayout";
import type { ToolTrayMode, WorkbenchLayoutMode, WorkbenchSizing } from "./workbenchLayout";
import {
  readStoredSideDrawerCollapsed,
  readStoredSideDrawerWidth,
  readStoredToolTrayMode,
  readStoredWorkbenchLayout,
  readStoredWorkbenchSizing,
  clamp,
  workbenchStorageKeys,
} from "./workbenchLayoutStorage";

export const useWorkbenchLayout = () => {
  const [workbenchLayout, setStoredWorkbenchLayout] = useState<WorkbenchLayoutMode>(readStoredWorkbenchLayout);
  const [toolTrayMode, setToolTrayMode] = useState<ToolTrayMode>(readStoredToolTrayMode);
  const [workbenchSizing, setWorkbenchSizing] = useState<WorkbenchSizing>(readStoredWorkbenchSizing);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [narrowPanelOpen, setNarrowPanelOpen] = useState(false);
  const [sideDrawerWidth, setSideDrawerWidth] = useState(readStoredSideDrawerWidth);
  const [sideDrawerCollapsed, setSideDrawerCollapsed] = useState(readStoredSideDrawerCollapsed);
  const workbenchRef = useRef<HTMLElement | null>(null);
  const renderedWorkbenchLayout = effectiveWorkbenchLayout(workbenchLayout, viewportWidth, narrowPanelOpen);

  const setWorkbenchLayout = (layout: WorkbenchLayoutMode) => {
    setStoredWorkbenchLayout(layout);
    setNarrowPanelOpen(layout !== "hidden");
  };

  const workbenchStyle = {
    "--tool-tray-size": `${workbenchSizing.trayPercent}%`,
    "--tool-primary-size": `${workbenchSizing.toolSplitPercent}%`,
  } as CSSProperties;
  const appShellStyle = {
    "--side-drawer-width": `${sideDrawerCollapsed ? 52 : sideDrawerWidth}px`,
    "--dock-width": `${workbenchSizing.trayPercent === DEFAULT_WORKBENCH_SIZING.trayPercent
      ? 430
      : Math.max(240, (viewportWidth - (sideDrawerCollapsed ? 52 : sideDrawerWidth) - 6) * (workbenchSizing.trayPercent / 100))}px`,
  } as CSSProperties;

  const beginSideDrawerResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (sideDrawerCollapsed) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.classList.add("is-resizing-workbench");
    const move = (pointerEvent: PointerEvent) => setSideDrawerWidth(clamp(pointerEvent.clientX, 220, 420));
    const stop = () => {
      document.body.classList.remove("is-resizing-workbench");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
    window.addEventListener("pointercancel", stop, { once: true });
  };

  const nudgeSideDrawerResize = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    setSideDrawerWidth((width) => clamp(width + (event.key === "ArrowRight" ? 12 : -12), 220, 420));
  };

  const beginWorkbenchResize = (kind: "tray" | "tools", event: ReactPointerEvent<HTMLButtonElement>) => {
    if (renderedWorkbenchLayout === "hidden") return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.classList.add("is-resizing-workbench");
    const move = (pointerEvent: PointerEvent) => {
      const rect = workbenchRef.current?.getBoundingClientRect();
      if (!rect) return;
      setWorkbenchSizing((current) => {
        if (kind === "tray") {
          const next = renderedWorkbenchLayout === "right"
            ? ((rect.right - pointerEvent.clientX) / rect.width) * 100
            : renderedWorkbenchLayout === "left"
              ? ((pointerEvent.clientX - rect.left) / rect.width) * 100
              : ((rect.bottom - pointerEvent.clientY) / rect.height) * 100;
          return { ...current, trayPercent: clamp(next, 18, 54) };
        }
        const next = renderedWorkbenchLayout === "bottom"
          ? ((pointerEvent.clientX - rect.left) / rect.width) * 100
          : ((pointerEvent.clientY - rect.top) / rect.height) * 100;
        return { ...current, toolSplitPercent: clamp(next, 25, 75) };
      });
    };
    const stop = () => {
      document.body.classList.remove("is-resizing-workbench");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
    window.addEventListener("pointercancel", stop, { once: true });
  };

  const nudgeWorkbenchResize = (kind: "tray" | "tools", event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!event.key.startsWith("Arrow")) return;
    event.preventDefault();
    const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 3 : -3;
    setWorkbenchSizing((current) => {
      if (kind === "tray") {
        const direction = renderedWorkbenchLayout === "left" || renderedWorkbenchLayout === "bottom" ? delta : -delta;
        return { ...current, trayPercent: clamp(current.trayPercent + direction, 18, 54) };
      }
      const direction = renderedWorkbenchLayout === "bottom"
        ? event.key === "ArrowRight" ? 3 : event.key === "ArrowLeft" ? -3 : 0
        : event.key === "ArrowDown" ? 3 : event.key === "ArrowUp" ? -3 : 0;
      return { ...current, toolSplitPercent: clamp(current.toolSplitPercent + direction, 25, 75) };
    });
  };

  const resetWorkbenchLayout = () => {
    setStoredWorkbenchLayout(DEFAULT_WORKBENCH_LAYOUT);
    setNarrowPanelOpen(false);
    setToolTrayMode(DEFAULT_TOOL_TRAY_MODE);
    setWorkbenchSizing(DEFAULT_WORKBENCH_SIZING);
    setSideDrawerWidth(DEFAULT_SIDE_DRAWER_WIDTH);
    setSideDrawerCollapsed(false);
  };

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(workbenchStorageKeys.layout, workbenchLayout);
      window.localStorage.setItem(workbenchStorageKeys.sizing, JSON.stringify(workbenchSizing));
      window.localStorage.setItem(workbenchStorageKeys.toolTrayMode, toolTrayMode);
      window.localStorage.setItem(workbenchStorageKeys.sideDrawerWidth, String(sideDrawerWidth));
      window.localStorage.setItem(workbenchStorageKeys.sideDrawerCollapsed, sideDrawerCollapsed ? "true" : "false");
    } catch {
      // Layout persistence is best-effort.
    }
  }, [sideDrawerCollapsed, sideDrawerWidth, toolTrayMode, workbenchLayout, workbenchSizing]);

  return {
    appShellStyle,
    beginSideDrawerResize,
    beginWorkbenchResize,
    nudgeSideDrawerResize,
    nudgeWorkbenchResize,
    resetWorkbenchLayout,
    renderedWorkbenchLayout,
    setSideDrawerCollapsed,
    setToolTrayMode,
    setWorkbenchLayout,
    sideDrawerCollapsed,
    toolTrayMode,
    workbenchLayout,
    workbenchRef,
    workbenchSizing,
    workbenchStyle,
  };
};
