import { MAX_PROJECT_SESSIONS } from "./workspaceStateTypes";
import type {
  ProjectRailStatus,
  ProjectSession,
  ProjectSessionOrchestration,
  ProjectSessionsByProject,
} from "./workspaceStateTypes";

const recordFrom = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value != null && !Array.isArray(value) ? value as Record<string, unknown> : null;

const optionalString = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined;
const optionalTimestamp = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;

export const normalizeProjectStatus = (value: unknown): ProjectRailStatus =>
  value === "running" || value === "exited" || value === "attention" ? value : "exited";

const normalizeOrchestration = (value: unknown): ProjectSessionOrchestration | undefined => {
  const item = recordFrom(value);
  if (!item) return undefined;
  const dispatchId = optionalString(item.dispatchId);
  const parentSessionId = optionalString(item.parentSessionId);
  const task = optionalString(item.task);
  const provider = item.provider;
  const approvalMode = item.approvalMode;
  const worktreeMode = item.worktreeMode;
  const index = typeof item.index === "number" && Number.isInteger(item.index) ? item.index : -1;
  const count = typeof item.count === "number" && Number.isInteger(item.count) ? item.count : -1;
  const budgetSeconds = typeof item.budgetSeconds === "number" && Number.isInteger(item.budgetSeconds)
    ? item.budgetSeconds
    : -1;
  const targetValues: unknown[] | null = Array.isArray(item.targets) ? item.targets : null;
  const valid = dispatchId && parentSessionId && task
    && index >= 0
    && count >= 2 && count <= 8
    && (provider === "codex" || provider === "claude")
    && (approvalMode === "ask" || approvalMode === "approveSafe" || approvalMode === "fullAccess")
    && budgetSeconds >= 30 && budgetSeconds <= 3600
    && targetValues
    && (worktreeMode === "shared" || worktreeMode === "isolated");
  if (!valid) return undefined;
  const targets = Array.from(new Set(targetValues.filter(
    (target): target is string => typeof target === "string" && Boolean(target.trim()),
  ).map((target) => target.trim())));
  return {
    dispatchId, parentSessionId, index, count, task, provider,
    ...(optionalString(item.model) ? { model: optionalString(item.model) } : {}),
    approvalMode, budgetSeconds, targets, worktreeMode,
    ...(optionalString(item.worktreePath) ? { worktreePath: optionalString(item.worktreePath) } : {}),
    ...(optionalString(item.worktreeBranch) ? { worktreeBranch: optionalString(item.worktreeBranch) } : {}),
    ...(optionalTimestamp(item.returnedAt) ? { returnedAt: optionalTimestamp(item.returnedAt) } : {}),
  };
};

const sessionMetadata = (item: Record<string, unknown>): Partial<ProjectSession> => ({
  ...(item.archived === true ? { archived: true } : {}),
  ...(optionalTimestamp(item.pinnedAt) ? { pinnedAt: optionalTimestamp(item.pinnedAt) } : {}),
  ...(optionalString(item.parentSessionId) ? { parentSessionId: optionalString(item.parentSessionId) } : {}),
  ...(optionalString(item.parentMessageId) ? { parentMessageId: optionalString(item.parentMessageId) } : {}),
  ...(optionalTimestamp(item.forkedAt) ? { forkedAt: optionalTimestamp(item.forkedAt) } : {}),
  ...(optionalString(item.checkpointId) ? { checkpointId: optionalString(item.checkpointId) } : {}),
  ...(optionalTimestamp(item.checkpointCreatedAt) ? { checkpointCreatedAt: optionalTimestamp(item.checkpointCreatedAt) } : {}),
  ...(optionalString(item.recoveryCheckpointId) ? { recoveryCheckpointId: optionalString(item.recoveryCheckpointId) } : {}),
});

const normalizeProjectSession = (value: unknown): ProjectSession | null => {
  const item = recordFrom(value);
  if (!item) return null;
  const id = optionalString(item.id);
  const title = optionalString(item.title);
  if (!id || !title) return null;
  const orchestration = normalizeOrchestration(item.orchestration);
  return {
    id,
    title,
    status: normalizeProjectStatus(item.status),
    updatedAt: typeof item.updatedAt === "number" && Number.isFinite(item.updatedAt) ? item.updatedAt : 0,
    ...sessionMetadata(item),
    ...(orchestration ? { orchestration } : {}),
  };
};

export const normalizeProjectSessionsByProject = (value: unknown): ProjectSessionsByProject => {
  const record = recordFrom(value);
  if (!record) return {};
  const entries = Object.entries(record).map(([path, sessions]) => {
    const trimmedPath = path.trim();
    if (!trimmedPath || !Array.isArray(sessions)) return null;
    const seen = new Set<string>();
    const normalized = sessions.map(normalizeProjectSession).filter((session): session is ProjectSession => {
      if (!session || seen.has(session.id)) return false;
      seen.add(session.id);
      return true;
    }).slice(0, MAX_PROJECT_SESSIONS);
    return normalized.length > 0 ? [trimmedPath, normalized] as const : null;
  }).filter((entry): entry is readonly [string, ProjectSession[]] => entry != null);
  return Object.fromEntries(entries);
};
