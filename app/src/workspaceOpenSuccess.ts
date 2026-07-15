import {
  activeProjectSessionId,
  ensureProjectSessions,
  pushRecentProject,
  setActiveProjectSession,
  setOpenProjectStatus,
  setProjectSessionStatus,
  upsertOpenProject,
  type ActiveSessionByProject,
  type OpenProject,
  type ProjectRailStatus,
  type ProjectSessionsByProject,
} from "./workspaceState";

type PlanWorkspaceOpenSuccessInput = {
  activeSessions: ActiveSessionByProject;
  now: number;
  openProjects: OpenProject[];
  previousRoot: string | null;
  previousStatus: ProjectRailStatus;
  projectStatus: ProjectRailStatus;
  recentProjects: string[];
  root: string;
  sessionStatus: ProjectRailStatus;
  sessions: ProjectSessionsByProject;
};

export const planWorkspaceOpenSuccess = ({
  activeSessions,
  now,
  openProjects,
  previousRoot,
  previousStatus,
  projectStatus,
  recentProjects,
  root,
  sessionStatus,
  sessions,
}: PlanWorkspaceOpenSuccessInput) => {
  const nextRecentProjects = pushRecentProject(recentProjects, root);
  const previousProjects = previousRoot && previousRoot !== root
    ? setOpenProjectStatus(openProjects, previousRoot, previousStatus)
    : openProjects;
  const nextOpenProjects = upsertOpenProject(previousProjects, root, projectStatus);
  let nextSessions = sessions;
  let nextActiveSessions = activeSessions;
  if (previousRoot && previousRoot !== root) {
    const previousSessionId = activeProjectSessionId(nextActiveSessions, nextSessions, previousRoot);
    if (previousSessionId) {
      nextSessions = setProjectSessionStatus(nextSessions, previousRoot, previousSessionId, previousStatus, now);
    }
  }
  nextSessions = ensureProjectSessions(nextSessions, root, now);
  const sessionId = activeProjectSessionId(nextActiveSessions, nextSessions, root);
  if (sessionId) {
    nextActiveSessions = setActiveProjectSession(nextActiveSessions, root, sessionId);
    nextSessions = setProjectSessionStatus(nextSessions, root, sessionId, sessionStatus, now);
  }
  return {
    activeSessions: nextActiveSessions,
    openProjects: nextOpenProjects,
    recentProjects: nextRecentProjects,
    sessionId,
    sessions: nextSessions,
  };
};
