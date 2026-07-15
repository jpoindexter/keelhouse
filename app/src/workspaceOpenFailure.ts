import {
  activeProjectSessionId,
  ensureProjectSessions,
  setActiveProjectSession,
  setProjectSessionStatus,
  upsertOpenProject,
  type ActiveSessionByProject,
  type OpenProject,
  type ProjectSessionsByProject,
} from "./workspaceState";

type PlanWorkspaceOpenFailureInput = {
  activeSessions: ActiveSessionByProject;
  now: number;
  openProjects: OpenProject[];
  path: string;
  sessions: ProjectSessionsByProject;
};

export const planWorkspaceOpenFailure = ({
  activeSessions,
  now,
  openProjects,
  path,
  sessions,
}: PlanWorkspaceOpenFailureInput) => {
  const nextOpenProjects = upsertOpenProject(openProjects, path, "attention");
  let nextSessions = ensureProjectSessions(sessions, path, now);
  let nextActiveSessions = activeSessions;
  const sessionId = activeProjectSessionId(nextActiveSessions, nextSessions, path);
  if (sessionId) {
    nextActiveSessions = setActiveProjectSession(nextActiveSessions, path, sessionId);
    nextSessions = setProjectSessionStatus(nextSessions, path, sessionId, "attention", now);
  }
  return {
    activeSessions: nextActiveSessions,
    openProjects: nextOpenProjects,
    sessions: nextSessions,
  };
};
