import { useLayoutEffect, useRef, useState } from "react";

import { AppIcon } from "./icons";
import type { ToolTrayMode } from "./workbenchLayout";

type ToolTrayTabsProps = {
  mode: ToolTrayMode;
  onModeChange: (mode: ToolTrayMode) => void;
  onClose: () => void;
};

export const toolTraySelection = (current: ToolTrayMode, next: ToolTrayMode): ToolTrayMode | null =>
  current === next ? null : next;

const showsEditor = (mode: ToolTrayMode) => mode === "editor" || mode === "split";
const showsBrowser = (mode: ToolTrayMode) => mode === "browser" || mode === "split";

export type ToolTrayDensity = "full" | "compact" | "icons";

export const toolTrayDensity = (width: number): ToolTrayDensity => {
  if (width < 420) return "icons";
  if (width < 620) return "compact";
  return "full";
};

export function ToolTrayTabs({ mode, onModeChange, onClose }: ToolTrayTabsProps) {
  const trayRef = useRef<HTMLElement | null>(null);
  const [density, setDensity] = useState<ToolTrayDensity>("compact");

  useLayoutEffect(() => {
    const tray = trayRef.current;
    if (!tray) return;

    const updateDensity = (width: number) => {
      setDensity((current) => {
        const next = toolTrayDensity(width);
        return current === next ? current : next;
      });
    };
    updateDensity(tray.getBoundingClientRect().width);

    const observer = new ResizeObserver(([entry]) => updateDensity(entry.contentRect.width));
    observer.observe(tray);
    return () => observer.disconnect();
  }, []);

  const choose = (next: ToolTrayMode) => {
    const selection = toolTraySelection(mode, next);
    if (selection == null) onClose();
    else onModeChange(selection);
  };

  return (
    <nav ref={trayRef} className={`tool-tray-tabs tool-tray-tabs--${density}`} aria-label="Tool tray surfaces" data-density={density}>
      <button
        className={`tool-tray-tabs__tab ${mode === "files" ? "tool-tray-tabs__tab--active" : ""}`}
        type="button"
        aria-pressed={mode === "files"}
        title={mode === "files" ? "Hide Files panel" : "Show Files panel"}
        onClick={() => choose("files")}
      >
        <AppIcon name="folder" />
        <span>Files</span>
      </button>
      <button
        className={`tool-tray-tabs__tab ${showsEditor(mode) ? "tool-tray-tabs__tab--active" : ""}`}
        type="button"
        aria-pressed={showsEditor(mode)}
        title={mode === "editor" ? "Hide Editor panel" : "Show Editor panel"}
        onClick={() => choose("editor")}
      >
        <AppIcon name="file" />
        <span>Editor</span>
      </button>
      <button
        className={`tool-tray-tabs__tab ${showsBrowser(mode) ? "tool-tray-tabs__tab--active" : ""}`}
        type="button"
        aria-pressed={showsBrowser(mode)}
        title={mode === "browser" ? "Hide Browser panel" : "Show Browser panel"}
        onClick={() => choose("browser")}
      >
        <AppIcon name="browser" />
        <span>Browser</span>
      </button>
      <button
        className={`tool-tray-tabs__tab ${mode === "git" ? "tool-tray-tabs__tab--active" : ""}`}
        type="button"
        aria-pressed={mode === "git"}
        title={mode === "git" ? "Hide Git panel" : "Show Git panel"}
        onClick={() => choose("git")}
      >
        <AppIcon name="git" />
        <span>Git</span>
      </button>
      <span className="tool-tray-tabs__spacer" />
      <button
        className="tool-tray-tabs__icon"
        type="button"
        title="Hide tools"
        aria-label="Hide tool tray"
        onClick={onClose}
      >
        <AppIcon name="close" />
      </button>
    </nav>
  );
}
