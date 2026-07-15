import {
  activeProjectSessionId,
  setActiveProjectSession,
  setProjectSessionStatus,
  type ActiveSessionByProject,
  type ProjectRailStatus,
  type ProjectSessionsByProject,
} from "./workspaceState";

type PlanProjectSessionSwitchInput = {
  activeSessions: ActiveSessionByProject;
  currentRoot: string | null;
  now: number;
  previousStatus: ProjectRailStatus;
  projectPath: string;
  sessionId: string;
  sessions: ProjectSessionsByProject;
  targetStatus: ProjectRailStatus;
};

export const planProjectSessionSwitch = ({
  activeSessions,
  currentRoot,
  now,
  previousStatus,
  projectPath,
  sessionId,
  sessions,
  targetStatus,
}: PlanProjectSessionSwitchInput) => {
  const sameProject = currentRoot === projectPath;
  let nextSessions = sessions;
  const nextActiveSessions = setActiveProjectSession(activeSessions, projectPath, sessionId);
  const previousSessionId = activeProjectSessionId(activeSessions, sessions, projectPath);
  if (sameProject && previousSessionId && previousSessionId !== sessionId) {
    nextSessions = setProjectSessionStatus(nextSessions, projectPath, previousSessionId, previousStatus, now);
  }
  nextSessions = setProjectSessionStatus(
    nextSessions,
    projectPath,
    sessionId,
    sameProject ? targetStatus : "exited",
    now,
  );
  return { activeSessions: nextActiveSessions, sameProject, sessions: nextSessions };
};
