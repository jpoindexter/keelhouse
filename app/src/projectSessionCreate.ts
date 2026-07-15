import {
  newProjectSession,
  setActiveProjectSession,
  upsertProjectSession,
  type ActiveSessionByProject,
  type ProjectSessionsByProject,
} from "./workspaceState";

type PlanProjectSessionCreateInput = {
  activeSessions: ActiveSessionByProject;
  now: number;
  projectPath: string;
  sessions: ProjectSessionsByProject;
};

export const planProjectSessionCreate = ({
  activeSessions,
  now,
  projectPath,
  sessions,
}: PlanProjectSessionCreateInput) => {
  const session = {
    ...newProjectSession(sessions[projectPath] ?? [], now),
    status: "exited" as const,
  };
  return {
    activeSessions: setActiveProjectSession(activeSessions, projectPath, session.id),
    session,
    sessions: upsertProjectSession(sessions, projectPath, session),
  };
};
