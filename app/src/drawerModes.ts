import type { AppIconName } from "./icons";
import type { SideDrawerMode } from "./useShellLayout";

export const DRAWER_MODES: Array<{
  id: SideDrawerMode;
  label: string;
  icon: AppIconName;
}> = [
  { id: "projects", label: "Projects", icon: "workspace" },
  { id: "files", label: "Files", icon: "file" },
  { id: "git", label: "Git", icon: "git" },
  { id: "browser", label: "Browser", icon: "browser" },
  { id: "settings", label: "Settings", icon: "settings" },
];

export const drawerTitleFor = (mode: SideDrawerMode) => mode === "projects"
  ? "Project chats"
  : DRAWER_MODES.find((candidate) => candidate.id === mode)?.label ?? DRAWER_MODES[0].label;
