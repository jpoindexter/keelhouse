import type { AppIconName } from "./icons";

export type SettingsCategoryId = "general" | "appearance" | "layout" | "agents" | "connections" | "app" | "browser" | "git" | "shortcuts";

export type SettingsCategoryGroupId = "personal" | "workbench" | "integrations";

export type SettingsCategoryGroup = {
  id: SettingsCategoryGroupId;
  label: string;
};

export type SettingsCategory = {
  id: SettingsCategoryId;
  label: string;
  description: string;
  groupId: SettingsCategoryGroupId;
  icon: AppIconName;
};

/* Only categories whose rows map to real app behavior today render.
   Unsupported execution remains visibly unavailable instead of appearing as
   a working control; MCP credentials and lifecycle hook execution arrive with
   their dedicated roadmap cards. */
export const SETTINGS_CATEGORY_GROUPS: SettingsCategoryGroup[] = [
  { id: "personal", label: "Personal" },
  { id: "workbench", label: "Workbench" },
  { id: "integrations", label: "Integrations" },
];

export const SETTINGS_CATEGORIES: SettingsCategory[] = [
  { id: "general", label: "General", description: "Startup, notifications, and local application behavior.", groupId: "personal", icon: "settings" },
  { id: "appearance", label: "Appearance", description: "Theme and visual presentation.", groupId: "personal", icon: "layout" },
  { id: "shortcuts", label: "Keyboard shortcuts", description: "Search and customize supported workbench shortcuts.", groupId: "personal", icon: "file" },
  { id: "layout", label: "Layout", description: "Tool placement and interface restoration.", groupId: "workbench", icon: "layout" },
  { id: "agents", label: "Agents", description: "Default provider and approval behavior for chats.", groupId: "workbench", icon: "agent" },
  { id: "browser", label: "Browser preview", description: "Project and chat preview behavior.", groupId: "workbench", icon: "browser" },
  { id: "connections", label: "Connections", description: "AI providers, project environment, and MCP servers.", groupId: "integrations", icon: "connection" },
  { id: "git", label: "Git", description: "Repository health and source-host links.", groupId: "integrations", icon: "git" },
  { id: "app", label: "App configuration", description: "Local storage, ignored folders, and reset controls.", groupId: "integrations", icon: "settings" },
];

export type SettingsValueScope = "global" | "project" | "chat";

export type SettingsRowDef = {
  id: string;
  categoryId: SettingsCategoryId;
  label: string;
  hint: string;
  keywords: string[];
  scope: SettingsValueScope;
};

export const SETTINGS_ROWS: SettingsRowDef[] = [
  {
    id: "agents.profile",
    categoryId: "agents",
    label: "Default chat provider",
    hint: "Structured provider used when a chat starts. Providers without an adapter remain available in Raw terminal.",
    keywords: ["codex", "claude", "gemini", "shell", "profile", "agent"],
    scope: "global",
  },
  {
    id: "agents.permission",
    categoryId: "agents",
    label: "Permission mode",
    hint: "How composer-driven app actions are approved for the active chat.",
    keywords: ["ask", "approve", "full access", "approval", "gate"],
    scope: "chat",
  },
  {
    id: "agents.connections",
    categoryId: "agents",
    label: "Provider connections",
    hint: "Local CLI, sign-in, version, and structured-chat capability. No credential values are read or stored.",
    keywords: ["codex", "claude", "gemini", "provider", "connection", "auth", "oauth", "login", "health", "version"],
    scope: "global",
  },
  {
    id: "agents.terminal-profiles",
    categoryId: "agents",
    label: "Raw terminal profiles",
    hint: "Add local CLI commands that can be selected when creating a raw terminal pane.",
    keywords: ["custom", "command", "cli", "terminal", "profile", "local", "path"],
    scope: "global",
  },
  {
    id: "agents.worktree-policy",
    categoryId: "agents",
    label: "Worktree policy",
    hint: "Current isolated-pane location, naming, and cleanup behavior.",
    keywords: ["worktree", "branch", "location", "cleanup", "parallel", "isolation"],
    scope: "project",
  },
  {
    id: "agents.hook-policy",
    categoryId: "agents",
    label: "Lifecycle hook policy",
    hint: "Safety boundary for project setup and cleanup automation.",
    keywords: ["hook", "setup", "run", "cleanup", "teardown", "script", "approval"],
    scope: "project",
  },
  {
    id: "agents.environment-policy",
    categoryId: "agents",
    label: "Environment policy",
    hint: "Current project shell inheritance and credential-display boundary.",
    keywords: ["environment", "env", "path", "shell", "secret", "credential", "override"],
    scope: "project",
  },
  {
    id: "connections.manage",
    categoryId: "connections",
    label: "AI and MCP connections",
    hint: "Provider model defaults, Keychain-backed API credentials, project environment, and MCP server entries.",
    keywords: ["provider", "api key", "credential", "keychain", "model", "mcp", "oauth", "environment", "env"],
    scope: "global",
  },
  {
    id: "layout.dock",
    categoryId: "layout",
    label: "Tool tray position",
    hint: "Where the editor/browser tray docks in the workbench.",
    keywords: ["dock", "left", "right", "bottom", "hidden", "tray"],
    scope: "global",
  },
  {
    id: "layout.tray",
    categoryId: "layout",
    label: "Tray surfaces",
    hint: "Which tool surfaces the tray shows.",
    keywords: ["editor", "browser", "split", "tools"],
    scope: "global",
  },
  {
    id: "layout.reset",
    categoryId: "layout",
    label: "Reset layout",
    hint: "Return to the demo default: tray docked right on Editor.",
    keywords: ["demo", "default", "first open", "reset"],
    scope: "global",
  },
  {
    id: "browser.url",
    categoryId: "browser",
    label: "Preview URL",
    hint: "Remembered per project and chat; Enter applies.",
    keywords: ["localhost", "preview", "address", "url"],
    scope: "chat",
  },
  {
    id: "git.health",
    categoryId: "git",
    label: "Repository",
    hint: "Detected from the active workspace via git status.",
    keywords: ["branch", "repo", "status", "changes", "health"],
    scope: "project",
  },
  {
    id: "git.source-control",
    categoryId: "git",
    label: "Hosting CLI",
    hint: "Detected git/gh/glab presence and login state. PR/MR links and self-hosted GitLab arrive with the full SOURCE-CONTROL-CONNECTIONS card.",
    keywords: ["github", "gitlab", "gh", "glab", "auth", "login", "cli", "hosting"],
    scope: "project",
  },
  {
    id: "git.remote-links",
    categoryId: "git",
    label: "Remote",
    hint: "Opens the active repo's remote host in your default browser. Detected from the origin remote; works for GitHub, GitLab, and self-hosted hosts.",
    keywords: ["github", "gitlab", "pull request", "merge request", "issues", "pipeline", "ci", "remote", "open"],
    scope: "project",
  },
  {
    id: "app.ignored",
    categoryId: "app",
    label: "Ignored folders",
    hint: "Filtered from the file tree and watcher in addition to .gitignore. Fixed for now.",
    keywords: ["node_modules", "gitignore", "tree", "watcher", "exclude"],
    scope: "global",
  },
  {
    id: "app.theme",
    categoryId: "appearance",
    label: "Theme and font",
    hint: "Graphite with steel-cyan accent; Inter is bundled. More themes arrive with the THEME card.",
    keywords: ["color", "dark", "font", "inter", "appearance"],
    scope: "global",
  },
  {
    id: "app.notifications",
    categoryId: "general",
    label: "Background notifications",
    hint: "Send a macOS notification when an agent exits in a project you are not viewing. Off by default.",
    keywords: ["notification", "badge", "background", "macos", "alert"],
    scope: "global",
  },
  {
    id: "app.reset",
    categoryId: "app",
    label: "Reset all local data",
    hint: "Clear saved projects, chats, transcripts, layout, and local state files. Cannot be undone.",
    keywords: ["reset", "clear", "uninstall", "wipe", "delete", "local data"],
    scope: "global",
  },
  {
    id: "shortcuts.palette-sources",
    categoryId: "shortcuts",
    label: "Command palette sources",
    hint: "Choose which live workbench objects appear in Shift+Cmd+P results.",
    keywords: ["command palette", "source", "files", "tabs", "worktrees", "commands"],
    scope: "global",
  },
  {
    id: "shortcuts.reference",
    categoryId: "shortcuts",
    label: "Active shortcuts",
    hint: "Searchable reference with supported overrides and conflict detection.",
    keywords: ["keys", "keyboard", "bindings", "cmd", "reference"],
    scope: "global",
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
