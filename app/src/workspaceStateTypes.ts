export const MAX_RECENT_PROJECTS = 8;
export const MAX_OPEN_PROJECTS = 8;
export const MAX_PROJECT_SESSIONS = 100;

export type ProjectRailStatus = "running" | "exited" | "attention";
export type ProjectSessionStatus = ProjectRailStatus;

export type ProjectSessionOrchestration = {
  dispatchId: string;
  parentSessionId: string;
  index: number;
  count: number;
  task: string;
  provider: "codex" | "claude";
  model?: string;
  approvalMode: "ask" | "approveSafe" | "fullAccess";
  budgetSeconds: number;
  targets: string[];
  worktreeMode: "shared" | "isolated";
  worktreePath?: string;
  worktreeBranch?: string;
  returnedAt?: number;
};

export type OpenProject = {
  path: string;
  status: ProjectRailStatus;
};

export type ProjectSession = {
  id: string;
  title: string;
  status: ProjectSessionStatus;
  updatedAt: number;
  archived?: boolean;
  pinnedAt?: number;
  parentSessionId?: string;
  parentMessageId?: string;
  forkedAt?: number;
  checkpointId?: string;
  checkpointCreatedAt?: number;
  recoveryCheckpointId?: string;
  orchestration?: ProjectSessionOrchestration;
};

export type ProjectSessionsByProject = Record<string, ProjectSession[]>;
export type ActiveSessionByProject = Record<string, string>;
