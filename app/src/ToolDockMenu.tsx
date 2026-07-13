import type { MouseEvent } from "react";

import { AppIcon } from "./icons";
import type { ToolTrayMode, WorkbenchLayoutMode } from "./workbenchLayout";

type ToolDockMenuProps = {
  layout: WorkbenchLayoutMode;
  toolMode: ToolTrayMode;
  onLayoutChange: (layout: WorkbenchLayoutMode) => void;
  onToolModeChange: (mode: ToolTrayMode) => void;
};

export function ToolDockMenu({ layout, toolMode, onLayoutChange, onToolModeChange }: ToolDockMenuProps) {
  const close = (event: MouseEvent<HTMLElement>) => event.currentTarget.closest("details")?.removeAttribute("open");
  const chooseLayout = (next: WorkbenchLayoutMode, event: MouseEvent<HTMLButtonElement>) => {
    onLayoutChange(next);
    // Surface switching lives in the tray tab strip; opening from hidden
    // restores the last tool mode so the menu stays position-only.
    if (layout === "hidden" && next !== "hidden") onToolModeChange(toolMode);
    close(event);
  };
  return (
    <details className="tool-dock-menu" aria-label="Tools and dock position">
      <summary>
        <AppIcon name="more" />
      </summary>
      <div className="tool-dock-menu__popover" role="menu">
        <span className="tool-dock-menu__label">Position</span>
        <button className={layout === "left" ? "is-active" : ""} type="button" role="menuitem" onClick={(event) => chooseLayout("left", event)}>
          <AppIcon name="file" /><span>Dock left</span>
        </button>
        <button className={layout === "right" ? "is-active" : ""} type="button" role="menuitem" onClick={(event) => chooseLayout("right", event)}>
          <AppIcon name="file" /><span>Dock right</span>
        </button>
        <button className={layout === "bottom" ? "is-active" : ""} type="button" role="menuitem" onClick={(event) => chooseLayout("bottom", event)}>
          <AppIcon name="browser" /><span>Dock bottom</span>
        </button>
        <button className={layout === "hidden" ? "is-active" : ""} type="button" role="menuitem" onClick={(event) => chooseLayout("hidden", event)}>
          <AppIcon name="close" /><span>Hide tools</span>
        </button>
      </div>
    </details>
  );
}
