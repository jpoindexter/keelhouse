import { useState, type Dispatch, type SetStateAction } from "react";
import {
  appActionAuditLabel,
  resolveAppAction,
  type AppActionApprovalPrompt,
  type AppActionAuditEvent,
  type AppActionDescriptor,
} from "./appActions";
import {
  MAX_AGENT_ACTIVITY_LOG_EVENTS,
  createAgentActivityEvent,
  pushAgentActivityEvent,
  type AgentActivityEvent,
  type AgentActivityLogFilter,
} from "./agentActivity";
import type {
  AgentApprovalMode,
  AgentSessionHandleDescriptor,
} from "./agentSessionHandle";

type MutableValue<T> = { current: T };

type AgentActivityControllerOptions = {
  activeAgentDescriptor: MutableValue<AgentSessionHandleDescriptor | null>;
  activeProviderId: string | null;
  activeProviderLabel: string;
  approvalMode: AgentApprovalMode;
  confirmAction: AppActionApprovalPrompt;
  getChatApprovalMode: (projectRoot: string, sessionId: string) => AgentApprovalMode;
  getRoot: () => string | null;
  getSessionId: (projectRoot: string | null) => string | null;
  now?: () => number;
  persistEvents: (events: AgentActivityEvent[]) => void;
};

const buildActiveChatHandle = (
  options: AgentActivityControllerOptions,
): AgentSessionHandleDescriptor | null => {
  const projectId = options.getRoot();
  const projectSessionId = options.getSessionId(projectId);
  if (!projectId || !projectSessionId) return null;
  const timestamp = (options.now ?? Date.now)();
  return {
    id: `chat:${projectSessionId}`, paneId: -1, projectId, projectSessionId,
    cwd: projectId, label: "Structured chat",
    agentProfileId: options.activeProviderId ?? "codex",
    agentProfileLabel: options.activeProviderLabel, processState: "running",
    approvalMode: options.getChatApprovalMode(projectId, projectSessionId),
    exitCode: null, createdAt: timestamp,
    activity: { label: "Agent hook", status: "running", updatedAt: timestamp },
  };
};

const recordActivity = (
  options: AgentActivityControllerOptions,
  setEvents: Dispatch<SetStateAction<AgentActivityEvent[]>>,
  handle: AgentSessionHandleDescriptor | null,
  event: Parameters<typeof createAgentActivityEvent>[1],
) => {
  if (!handle) return;
  const nextEvent = createAgentActivityEvent(handle, {
    ...event, timestamp: event.timestamp ?? (options.now ?? Date.now)(),
  });
  setEvents((events) => {
    const next = pushAgentActivityEvent(events, nextEvent, MAX_AGENT_ACTIVITY_LOG_EVENTS);
    options.persistEvents(next);
    return next;
  });
};

const shouldLogAudit = (audit: AppActionAuditEvent) =>
  audit.prompted || audit.decision !== "approved" || audit.requestedBy !== "user";

const gateAction = async (
  options: AgentActivityControllerOptions,
  record: (handle: AgentSessionHandleDescriptor | null, event: Parameters<typeof createAgentActivityEvent>[1]) => void,
  action: AppActionDescriptor,
  handle: AgentSessionHandleDescriptor | null,
) => {
  const audit = await resolveAppAction(
    action, options.approvalMode, options.confirmAction, (options.now ?? Date.now)(),
  );
  if (shouldLogAudit(audit)) record(handle, {
    kind: "approval", label: appActionAuditLabel(audit), detail: audit.label,
    target: audit.target, undoHint: audit.undoHint,
    status: audit.decision === "approved" ? "complete" : "error",
    provenance: "app-action", runCardKind: "approval",
  });
  return audit;
};

export function useAgentActivityController(options: AgentActivityControllerOptions) {
  const [agentActivityEvents, setAgentActivityEvents] = useState<AgentActivityEvent[]>([]);
  const activeChatActivityHandle = () => buildActiveChatHandle(options);
  const activeAgentActivityHandle = () =>
    options.activeAgentDescriptor.current ?? activeChatActivityHandle();
  const recordAgentActivity = (
    handle: AgentSessionHandleDescriptor | null,
    event: Parameters<typeof createAgentActivityEvent>[1],
  ) => recordActivity(options, setAgentActivityEvents, handle, event);
  const gateAppAction = (
    action: AppActionDescriptor,
    handle: AgentSessionHandleDescriptor | null = activeAgentActivityHandle(),
  ) => gateAction(options, recordAgentActivity, action, handle);
  return {
    activeAgentActivityHandle, activeChatActivityHandle, agentActivityEvents,
    agentActivityFilter: "all" as AgentActivityLogFilter, gateAppAction,
    recordAgentActivity, setAgentActivityEvents,
  };
}
