import type { AppIconName } from "./icons";

export type SettingsCategoryId = "general" | "layout" | "browser" | "git";

export type SettingsCategory = {
  id: SettingsCategoryId;
  label: string;
  icon: AppIconName;
};

/* Only categories whose rows map to real app behavior today render.
   MCP servers, Agent hooks, Connections, Environments, Worktrees,
   Keyboard shortcuts, and Appearance arrive with their roadmap cards
   (AI-CONNECTIONS, AGENT-HOOKS, KEYBINDINGS-CONFIG, THEME). */
export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  { id: "general", label: "General", icon: "agent" },
  { id: "layout", label: "Layout", icon: "workspace" },
  { id: "browser", label: "Browser preview", icon: "browser" },
  { id: "git", label: "Git", icon: "git" },
];

export type SettingsRowDef = {
  id: string;
  categoryId: SettingsCategoryId;
  label: string;
  hint: string;
  keywords: string[];
};

export const SETTINGS_ROWS: SettingsRowDef[] = [
  {
    id: "general.profile",
    categoryId: "general",
    label: "Default agent",
    hint: "Launch profile used when a pane starts in the current workspace.",
    keywords: ["codex", "claude", "gemini", "shell", "profile", "agent"],
  },
  {
    id: "general.permission",
    categoryId: "general",
    label: "Permission mode",
    hint: "How composer-driven app actions are approved for the active session.",
    keywords: ["ask", "approve", "full access", "approval", "gate"],
  },
  {
    id: "layout.dock",
    categoryId: "layout",
    label: "Tool tray position",
    hint: "Where the editor/browser tray docks in the workbench.",
    keywords: ["dock", "left", "right", "bottom", "hidden", "tray"],
  },
  {
    id: "layout.tray",
    categoryId: "layout",
    label: "Tray surfaces",
    hint: "Which tool surfaces the tray shows.",
    keywords: ["editor", "browser", "split", "tools"],
  },
  {
    id: "layout.reset",
    categoryId: "layout",
    label: "Reset layout",
    hint: "Return to the demo default: tray docked right on Editor.",
    keywords: ["demo", "default", "first open", "reset"],
  },
  {
    id: "browser.url",
    categoryId: "browser",
    label: "Preview URL",
    hint: "Remembered per project and session; Enter applies.",
    keywords: ["localhost", "preview", "address", "url"],
  },
  {
    id: "git.health",
    categoryId: "git",
    label: "Repository",
    hint: "Detected from the active workspace via git status.",
    keywords: ["branch", "repo", "status", "changes", "health"],
  },
];

export const filterSettingsRows = (rows: SettingsRowDef[], query: string): SettingsRowDef[] => {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) =>
    [row.label, row.hint, row.categoryId, ...row.keywords].some((text) => text.toLowerCase().includes(needle)),
  );
};

export const settingsRowsForCategory = (
  rows: SettingsRowDef[],
  categoryId: SettingsCategoryId,
): SettingsRowDef[] => rows.filter((row) => row.categoryId === categoryId);
