import { AppIcon } from "./icons";
import { BrowserToolsDrawer, type BrowserToolsDrawerProps } from "./BrowserToolsDrawer";
import { DRAWER_MODES } from "./drawerModes";
import { FilesSideDrawer, type FilesSideDrawerProps } from "./FilesSideDrawer";
import { ProjectThreadsDrawer, type ProjectThreadsDrawerProps } from "./ProjectThreadsDrawer";
import { QuickSettingsDrawer, type QuickSettingsDrawerProps } from "./QuickSettingsDrawer";
import { SourceControlDrawer, type SourceControlDrawerProps } from "./SourceControlDrawer";
import type { SideDrawerMode } from "./useShellLayout";

export type WorkspaceSideRailProps = {
  activeTitle: string;
  browser: BrowserToolsDrawerProps;
  collapsed: boolean;
  files: FilesSideDrawerProps;
  git: SourceControlDrawerProps;
  mode: SideDrawerMode;
  onOpenSettings: () => void;
  onSelectMode: (mode: SideDrawerMode) => void;
  projects: ProjectThreadsDrawerProps;
  settings: QuickSettingsDrawerProps;
};

const DrawerModeSwitcher = (props: Pick<WorkspaceSideRailProps, "mode" | "onOpenSettings" | "onSelectMode">) => (
  <div className="drawer-mode-switcher" role="tablist" aria-label="Side drawer">
    {DRAWER_MODES.map((mode) => (
      <button
        className={`drawer-mode-switcher__button ${props.mode === mode.id ? "drawer-mode-switcher__button--active" : ""}`}
        type="button"
        role="tab"
        key={mode.id}
        aria-selected={props.mode === mode.id}
        title={mode.label}
        onClick={() => {
          if (mode.id === "settings") {
            props.onOpenSettings();
            return;
          }
          props.onSelectMode(mode.id);
        }}
      >
        <AppIcon name={mode.icon} />
        <span>{mode.label}</span>
      </button>
    ))}
  </div>
);

export const WorkspaceSideRail = (props: WorkspaceSideRailProps) => (
  <aside
    className={`file-rail ${props.collapsed ? "file-rail--collapsed" : ""}`}
    aria-label={`${props.mode === "projects" ? "Project threads" : props.activeTitle} drawer`}
  >
    <div className="drawer-toolbar">
      <span>{props.mode === "projects" ? "Threads" : props.activeTitle}</span>
    </div>
    <DrawerModeSwitcher mode={props.mode} onOpenSettings={props.onOpenSettings} onSelectMode={props.onSelectMode} />
    {!props.collapsed && props.mode === "projects" ? <ProjectThreadsDrawer {...props.projects} /> : null}
    {!props.collapsed && props.mode === "git" ? <SourceControlDrawer {...props.git} /> : null}
    {!props.collapsed && props.mode === "browser" ? <BrowserToolsDrawer {...props.browser} /> : null}
    {!props.collapsed && props.mode === "settings" ? <QuickSettingsDrawer {...props.settings} /> : null}
    {!props.collapsed && props.mode === "files" ? <FilesSideDrawer {...props.files} /> : null}
  </aside>
);
