import type { AgentActivityStatus } from "./icons";
import type { AgentSessionHandleDescriptor, AgentSessionProcessState } from "./agentSessionHandle";

export type AgentActivityKind = "prompt" | "process" | "command" | "file" | "tool" | "git" | "approval" | "browser" | "app" | "error" | "complete";

export type AgentActivityEvent = {
  id: string;
  projectId: string;
  projectSessionId: string;
  paneId: string;
  kind: AgentActivityKind;
  label: string;
  detail?: string;
  target?: string;
  exitCode?: number;
  outputRef?: string;
  undoHint?: string;
  status: AgentActivityStatus;
  timestamp: number;
};

export const MAX_AGENT_ACTIVITY_EVENTS = 6;
export const MAX_AGENT_ACTIVITY_LOG_EVENTS = 200;
export type AgentActivityLogFilter = "all" | AgentActivityKind;
export const AGENT_ACTIVITY_LOG_FILTERS: AgentActivityLogFilter[] = ["all", "prompt", "process", "command", "file", "tool", "git", "app", "approval", "browser", "error", "complete"];

export const agentActivityStatusFromProcess = (state: AgentSessionProcessState): AgentActivityStatus => {
  if (state === "starting") return "waiting";
  if (state === "running") return "running";
  if (state === "waiting") return "waiting";
  if (state === "exited") return "exited";
  return "error";
};

export const agentCurrentActivity = (handle: AgentSessionHandleDescriptor | null): AgentActivityEvent | null => {
  if (!handle) return null;
  return {
    id: `${handle.id}:current`,
    projectId: handle.projectId,
    projectSessionId: handle.projectSessionId,
    paneId: handle.id,
    kind: handle.processState === "errored" ? "error" : handle.processState === "exited" ? "complete" : "process",
    label: handle.activity.label,
    detail: `${handle.label} - ${handle.agentProfileLabel}`,
    status: agentActivityStatusFromProcess(handle.processState),
    timestamp: handle.activity.updatedAt,
  };
};

export const createAgentActivityEvent = (
  handle: AgentSessionHandleDescriptor,
  event: Pick<AgentActivityEvent, "kind" | "label" | "status"> & Partial<Pick<AgentActivityEvent, "detail" | "target" | "exitCode" | "outputRef" | "undoHint" | "timestamp">>,
): AgentActivityEvent => ({
  id: `${handle.id}:${event.kind}:${event.timestamp ?? Date.now()}`,
  projectId: handle.projectId,
  projectSessionId: handle.projectSessionId,
  paneId: handle.id,
  kind: event.kind,
  label: event.label,
  detail: event.detail,
  target: event.target,
  exitCode: event.exitCode,
  outputRef: event.outputRef,
  undoHint: event.undoHint,
  status: event.status,
  timestamp: event.timestamp ?? Date.now(),
});

export const pushAgentActivityEvent = (
  events: AgentActivityEvent[],
  event: AgentActivityEvent,
  limit = MAX_AGENT_ACTIVITY_EVENTS,
) => [event, ...events.filter((item) => item.id !== event.id)].slice(0, limit);

export const normalizeAgentActivityEvents = (value: unknown): AgentActivityEvent[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((event): AgentActivityEvent[] => {
    if (!event || typeof event !== "object") return [];
    const data = event as Partial<Record<keyof AgentActivityEvent, unknown>>;
    if (typeof data.id !== "string" || typeof data.projectId !== "string" || typeof data.projectSessionId !== "string" || typeof data.paneId !== "string") return [];
    if (typeof data.kind !== "string" || !AGENT_ACTIVITY_LOG_FILTERS.includes(data.kind as AgentActivityLogFilter) || data.kind === "all") return [];
    if (typeof data.label !== "string" || !data.label.trim()) return [];
    if (typeof data.status !== "string" || !["thinking", "running", "waiting", "error", "exited", "complete"].includes(data.status)) return [];
    if (typeof data.timestamp !== "number" || !Number.isFinite(data.timestamp)) return [];
    return [{
      id: data.id,
      projectId: data.projectId,
      projectSessionId: data.projectSessionId,
      paneId: data.paneId,
      kind: data.kind as AgentActivityKind,
      label: data.label,
      detail: typeof data.detail === "string" ? data.detail : undefined,
      target: typeof data.target === "string" ? data.target : undefined,
      exitCode: typeof data.exitCode === "number" ? data.exitCode : undefined,
      outputRef: typeof data.outputRef === "string" ? data.outputRef : undefined,
      undoHint: typeof data.undoHint === "string" ? data.undoHint : undefined,
      status: data.status as AgentActivityStatus,
      timestamp: data.timestamp,
    }];
  }).slice(0, MAX_AGENT_ACTIVITY_LOG_EVENTS);
};

export const filterAgentActivityEvents = (events: AgentActivityEvent[], filter: AgentActivityLogFilter) =>
  filter === "all" ? events : events.filter((event) => event.kind === filter);

export const agentActivityTimeLabel = (timestamp: number) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date);
};
