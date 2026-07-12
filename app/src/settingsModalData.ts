import type { AppIconName } from "./icons";

export type SettingsCategoryId = "general" | "layout" | "app" | "browser" | "git" | "shortcuts";

export type SettingsCategory = {
  id: SettingsCategoryId;
  label: string;
  icon: AppIconName;
};

/* Only categories whose rows map to real app behavior today render.
   MCP servers, Agent hooks, Connections, Environments, and Worktrees
   arrive with their roadmap cards (AI-CONNECTIONS, AGENT-HOOKS, WORKTREE);
   shortcut OVERRIDES arrive with KEYBINDINGS-CONFIG (the reference here
   is read-only); theme variants arrive with THEME. */
export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  { id: "general", label: "General", icon: "agent" },
  { id: "layout", label: "Layout", icon: "workspace" },
  { id: "app", label: "App configuration", icon: "settings" },
  { id: "browser", label: "Browser preview", icon: "browser" },
  { id: "git", label: "Git", icon: "git" },
  { id: "shortcuts", label: "Keyboard shortcuts", icon: "file" },
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
  {
    id: "git.source-control",
    categoryId: "git",
    label: "Hosting CLI",
    hint: "Detected git/gh/glab presence and login state. PR/MR links and self-hosted GitLab arrive with the full SOURCE-CONTROL-CONNECTIONS card.",
    keywords: ["github", "gitlab", "gh", "glab", "auth", "login", "cli", "hosting"],
  },
  {
    id: "git.remote-links",
    categoryId: "git",
    label: "Remote",
    hint: "Opens the active repo's remote host in your default browser. Detected from the origin remote; works for GitHub, GitLab, and self-hosted hosts.",
    keywords: ["github", "gitlab", "pull request", "merge request", "issues", "pipeline", "ci", "remote", "open"],
  },
  {
    id: "app.ignored",
    categoryId: "app",
    label: "Ignored folders",
    hint: "Filtered from the file tree and watcher in addition to .gitignore. Fixed for now.",
    keywords: ["node_modules", "gitignore", "tree", "watcher", "exclude"],
  },
  {
    id: "app.theme",
    categoryId: "app",
    label: "Theme and font",
    hint: "Graphite with steel-cyan accent; Inter is bundled. More themes arrive with the THEME card.",
    keywords: ["color", "dark", "font", "inter", "appearance"],
  },
  {
    id: "app.notifications",
    categoryId: "app",
    label: "Background notifications",
    hint: "Send a macOS notification when an agent exits in a project you are not viewing. Off by default.",
    keywords: ["notification", "badge", "background", "macos", "alert"],
  },
  {
    id: "app.reset",
    categoryId: "app",
    label: "Reset all local data",
    hint: "Clear saved projects, sessions, transcripts, layout, and local state files. Cannot be undone.",
    keywords: ["reset", "clear", "uninstall", "wipe", "delete", "local data"],
  },
  {
    id: "shortcuts.reference",
    categoryId: "shortcuts",
    label: "Active shortcuts",
    hint: "Read-only reference. Overrides and conflict detection arrive with KEYBINDINGS-CONFIG.",
    keywords: ["keys", "keyboard", "bindings", "cmd", "reference"],
  },
];

/* Mirrors the backend noisy-dir filter (is_noisy_dir in lib.rs) — keep in
   sync by hand until a real need makes it configurable. */
export const IGNORED_FOLDERS = [".git", ".next", ".turbo", ".vite", "build", "coverage", "dist", "node_modules", "target"];

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
