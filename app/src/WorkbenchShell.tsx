import type {
  CSSProperties, KeyboardEvent, PointerEvent, ReactNode, RefObject,
} from "react";
import { ToolTrayTabs } from "./ToolTrayTabs";
import type { ToolTrayMode, WorkbenchLayoutMode } from "./workbenchLayout";
import type { AgentSurfaceMode } from "./useShellLayout";

const COLLAPSED_TRAY_HEIGHT_PX = 42;

export type WorkbenchShellProps = {
  handlers: {
    beginSideDrawerResize: (event: PointerEvent<HTMLButtonElement>) => void;
    hideTools: () => void;
    nudgeSideDrawerResize: (event: KeyboardEvent<HTMLButtonElement>) => void;
    setToolTrayMode: (mode: ToolTrayMode) => void;
  };
  layout: {
    appShellStyle: CSSProperties;
    renderedWorkbenchLayout: WorkbenchLayoutMode;
    settingsOpen: boolean;
    sideDrawerCollapsed: boolean;
    surfaceMode: AgentSurfaceMode;
    toolTrayMode: ToolTrayMode;
    utilityTrayHeight: number;
    workbenchStyle: CSSProperties;
  };
  refs: { workbenchRef: RefObject<HTMLElement | null> };
  slots: { main: ReactNode; overlays: ReactNode; rail: ReactNode; titlebar: ReactNode };
};

export const WorkbenchShell = (props: WorkbenchShellProps) => {
  const { layout } = props;
  const utilityOpen = layout.surfaceMode === "terminal";
  return (
    <div
      className={`app-shell ${layout.sideDrawerCollapsed ? "app-shell--side-drawer-collapsed" : ""} ${layout.renderedWorkbenchLayout === "hidden" ? "app-shell--tools-hidden" : ""} ${layout.settingsOpen ? "app-shell--settings-open" : ""}`}
      style={layout.appShellStyle}
    >
      {props.slots.titlebar}
      {props.slots.rail}
      {!layout.sideDrawerCollapsed ? (
        <button
          className="side-drawer-resizer"
          type="button"
          aria-label="Resize side drawer"
          title="Resize side drawer"
          onPointerDown={props.handlers.beginSideDrawerResize}
          onKeyDown={props.handlers.nudgeSideDrawerResize}
        />
      ) : null}
      <main
        ref={props.refs.workbenchRef}
        className={`workbench workbench--drawer-${layout.renderedWorkbenchLayout} workbench--tools-${layout.toolTrayMode} ${utilityOpen ? "workbench--utility-open" : ""}`}
        style={{
          ...layout.workbenchStyle,
          "--utility-tray-height": `${utilityOpen ? layout.utilityTrayHeight : COLLAPSED_TRAY_HEIGHT_PX}px`,
        } as CSSProperties}
      >
        {layout.renderedWorkbenchLayout !== "hidden" ? (
          <ToolTrayTabs
            mode={layout.toolTrayMode}
            onModeChange={props.handlers.setToolTrayMode}
            onClose={props.handlers.hideTools}
          />
        ) : null}
        {props.slots.main}
      </main>
      {props.slots.overlays}
    </div>
  );
};
