import { normalizeProjectStatus } from "./workspaceSessionNormalization";
import { MAX_OPEN_PROJECTS, MAX_PROJECT_SESSIONS, MAX_RECENT_PROJECTS } from "./workspaceStateTypes";
import type {
  ActiveSessionByProject,
  OpenProject,
  ProjectRailStatus,
  ProjectSession,
  ProjectSessionsByProject,
  ProjectSessionStatus,
} from "./workspaceStateTypes";

export { normalizeProjectSessionsByProject } from "./workspaceSessionNormalization";
export { MAX_OPEN_PROJECTS, MAX_PROJECT_SESSIONS, MAX_RECENT_PROJECTS } from "./workspaceStateTypes";
export type {
  ActiveSessionByProject,
  OpenProject,
  ProjectRailStatus,
  ProjectSession,
  ProjectSessionOrchestration,
  ProjectSessionsByProject,
  ProjectSessionStatus,
} from "./workspaceStateTypes";

export const normalizeRecentProjects = (value: unknown): string[] =>
  Array.isArray(value)
    ? Array.from(new Set(value.filter((path): path is string => typeof path === "string" && path.trim().length > 0))).slice(
        0,
        MAX_RECENT_PROJECTS,
      )
    : [];

export const pushRecentProject = (projects: string[], path: string) => [
  path,
  ...projects.filter((project) => project !== path),
].slice(0, MAX_RECENT_PROJECTS);

export const removeRecentProject = (projects: string[], path: string) => projects.filter((project) => project !== path);

export const normalizeOpenProjects = (value: unknown): OpenProject[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const projects: OpenProject[] = [];
  for (const item of value) {
    const objectItem = typeof item === "object" && item != null && !Array.isArray(item) ? item as Record<string, unknown> : null;
    const path = typeof item === "string" ? item : typeof objectItem?.path === "string" ? objectItem.path : "";
    const trimmed = path.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    projects.push({
      path: trimmed,
      status: objectItem ? normalizeProjectStatus(objectItem.status) : "exited",
    });
    if (projects.length >= MAX_OPEN_PROJECTS) break;
  }
  return projects;
};

export const openProjectsFromRecent = (projects: string[]): OpenProject[] =>
  projects.slice(0, MAX_OPEN_PROJECTS).map((path) => ({ path, status: "exited" }));

export const upsertOpenProject = (
  projects: OpenProject[],
  path: string,
  status: ProjectRailStatus,
): OpenProject[] => [
  { path, status },
  ...projects.filter((project) => project.path !== path),
].slice(0, MAX_OPEN_PROJECTS);

export const setOpenProjectStatus = (
  projects: OpenProject[],
  path: string,
  status: ProjectRailStatus,
): OpenProject[] => projects.map((project) => (project.path === path ? { ...project, status } : project));

export const removeOpenProject = (projects: OpenProject[], path: string) => projects.filter((project) => project.path !== path);

export const planProjectClose = (
  projects: OpenProject[],
  activePath: string | null,
  closingPath: string,
) => {
  const remaining = removeOpenProject(projects, closingPath);
  return {
    remaining,
    wasActive: activePath === closingPath,
    fallbackPath: activePath === closingPath ? remaining[0]?.path ?? null : activePath,
  };
};

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const WEEK_MS = 604_800_000;

export const sessionRecencyLabel = (updatedAt: number, now: number = Date.now()): string => {
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) return "";
  const elapsed = now - updatedAt;
  if (elapsed < MINUTE_MS) return "now";
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)}m`;
  if (elapsed < DAY_MS) return `${Math.floor(elapsed / HOUR_MS)}h`;
  if (elapsed < WEEK_MS) return `${Math.floor(elapsed / DAY_MS)}d`;
  return `${Math.floor(elapsed / WEEK_MS)}w`;
};

export const defaultProjectSession = (updatedAt: number = Date.now()): ProjectSession => ({
  id: `session-${Math.max(0, Math.floor(updatedAt)).toString(36)}`,
  title: "Current work",
  status: "exited",
  updatedAt,
});

export const newProjectSession = (existing: ProjectSession[], updatedAt: number = Date.now()): ProjectSession => ({
  id: `session-${Math.max(0, Math.floor(updatedAt)).toString(36)}`,
  title: existing.length === 0 ? "New chat" : `New chat ${existing.length + 1}`,
  status: "running",
  updatedAt,
});

export const setProjectSessionArchived = (
  sessions: ProjectSessionsByProject,
  path: string,
  sessionId: string,
  archived: boolean,
): ProjectSessionsByProject => {
  const list = sessions[path];
  if (!list) return sessions;
  // Never archive the last un-archived session — a project must keep a live
  // workbench to return to, mirroring the delete last-session protection.
  if (archived && list.filter((s) => !s.archived).length <= 1) return sessions;
  return {
    ...sessions,
    [path]: list.map((session) =>
      session.id === sessionId ? { ...session, archived: archived ? true : undefined } : session,
    ),
  };
};

export const setProjectSessionPinned = (
  sessions: ProjectSessionsByProject,
  path: string,
  sessionId: string,
  pinned: boolean,
  pinnedAt: number = Date.now(),
): ProjectSessionsByProject => {
  const list = sessions[path];
  if (!list) return sessions;
  return {
    ...sessions,
    [path]: list.map((session) =>
      session.id === sessionId ? { ...session, pinnedAt: pinned ? pinnedAt : undefined } : session,
    ),
  };
};

export const activeSessionsForRail = (sessions: ProjectSession[], showArchived: boolean): ProjectSession[] =>
  (showArchived ? [...sessions] : sessions.filter((session) => !session.archived))
    .sort((a, b) => {
      if (a.pinnedAt && b.pinnedAt) return b.pinnedAt - a.pinnedAt;
      if (a.pinnedAt) return -1;
      if (b.pinnedAt) return 1;
      return 0;
    });

export const archivedSessionCount = (sessions: ProjectSession[]): number =>
  sessions.filter((session) => session.archived).length;

export const normalizeActiveSessionByProject = (value: unknown): ActiveSessionByProject => {
  if (typeof value !== "object" || value == null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] =>
        entry[0].trim().length > 0 && typeof entry[1] === "string" && entry[1].trim().length > 0,
    ),
  );
};

export const ensureProjectSessions = (
  sessionsByProject: ProjectSessionsByProject,
  projectPath: string,
  updatedAt: number = Date.now(),
): ProjectSessionsByProject => {
  if (!projectPath || sessionsByProject[projectPath]?.length > 0) return sessionsByProject;
  return {
    ...sessionsByProject,
    [projectPath]: [defaultProjectSession(updatedAt)],
  };
};

export const upsertProjectSession = (
  sessionsByProject: ProjectSessionsByProject,
  projectPath: string,
  session: ProjectSession,
): ProjectSessionsByProject => {
  const existing = sessionsByProject[projectPath] ?? [];
  return {
    ...sessionsByProject,
    [projectPath]: [session, ...existing.filter((item) => item.id !== session.id)].slice(0, MAX_PROJECT_SESSIONS),
  };
};

export const removeProjectSession = (
  sessionsByProject: ProjectSessionsByProject,
  projectPath: string,
  sessionId: string,
): ProjectSessionsByProject => {
  const existing = sessionsByProject[projectPath];
  if (!existing || existing.length <= 1) return sessionsByProject;
  return {
    ...sessionsByProject,
    [projectPath]: existing.filter((session) => session.id !== sessionId),
  };
};

export const setProjectSessionStatus = (
  sessionsByProject: ProjectSessionsByProject,
  projectPath: string,
  sessionId: string,
  status: ProjectSessionStatus,
  updatedAt: number = Date.now(),
): ProjectSessionsByProject => {
  const existing = sessionsByProject[projectPath];
  if (!existing) return sessionsByProject;
  return {
    ...sessionsByProject,
    [projectPath]: existing.map((session) => (session.id === sessionId ? { ...session, status, updatedAt } : session)),
  };
};

export const activeProjectSessionId = (
  activeByProject: ActiveSessionByProject,
  sessionsByProject: ProjectSessionsByProject,
  projectPath: string | null,
): string | null => {
  if (!projectPath) return null;
  const sessions = sessionsByProject[projectPath] ?? [];
  const active = activeByProject[projectPath];
  return sessions.some((session) => session.id === active) ? active : sessions[0]?.id ?? null;
};

export const setActiveProjectSession = (
  activeByProject: ActiveSessionByProject,
  projectPath: string,
  sessionId: string,
): ActiveSessionByProject => ({
  ...activeByProject,
  [projectPath]: sessionId,
});

export const isMissingWorkspaceError = (message: string) =>
  message.includes("Workspace folder does not exist") || message.includes("Workspace path is not a folder");

export type ActiveFileByWorkspace = Record<string, string>;

export const normalizeActiveFileByWorkspace = (value: unknown): ActiveFileByWorkspace => {
  if (typeof value !== "object" || value == null || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] =>
        entry[0].trim().length > 0 && typeof entry[1] === "string" && entry[1].trim().length > 0,
    ),
  );
};

export const rememberActiveFile = (
  activeFiles: ActiveFileByWorkspace,
  workspacePath: string,
  filePath: string,
): ActiveFileByWorkspace => ({
  ...activeFiles,
  [workspacePath]: filePath,
});

export const forgetActiveFile = (activeFiles: ActiveFileByWorkspace, workspacePath: string): ActiveFileByWorkspace => {
  const next = { ...activeFiles };
  delete next[workspacePath];
  return next;
};
