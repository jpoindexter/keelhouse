import type { AgentApprovalMode } from "./agentSessionHandle";

export type AppActionKind =
  | "focus-pane"
  | "open-file"
  | "open-diff"
  | "attach-reference"
  | "interrupt-process"
  | "restart-process"
  | "terminate-process"
  | "create-pane"
  | "close-pane"
  | "open-browser-preview"
  | "save-file"
  | "find-in-file"
  | "open-folder"
  | "clear-terminal";

export type AppActionRisk = "low" | "medium" | "high" | "destructive" | "blocked";
export type AppActionRequestedBy = "user" | "composer" | "agent" | "system";
export type AppActionDecision = "approved" | "denied" | "blocked";

export type AppActionDescriptor = {
  id: string;
  kind: AppActionKind;
  label: string;
  target?: string;
  risk: AppActionRisk;
  requestedBy: AppActionRequestedBy;
  reason?: string;
  undoHint?: string;
};

export type AppActionAuditEvent = {
  actionId: string;
  kind: AppActionKind;
  label: string;
  target?: string;
  risk: AppActionRisk;
  requestedBy: AppActionRequestedBy;
  decision: AppActionDecision;
  approvalMode: AgentApprovalMode;
  reason: string;
  undoHint?: string;
  prompted: boolean;
  timestamp: number;
};

export type AppActionApprovalPrompt = (action: AppActionDescriptor, message: string) => boolean | Promise<boolean>;

export const createAppAction = (
  action: Omit<AppActionDescriptor, "id"> & Partial<Pick<AppActionDescriptor, "id">>,
  timestamp = Date.now(),
): AppActionDescriptor => ({
  ...action,
  id: action.id ?? `${action.kind}:${timestamp}`,
});

export const appActionNeedsApproval = (action: AppActionDescriptor, approvalMode: AgentApprovalMode) => {
  if (action.risk === "blocked") return false;
  if (action.risk === "destructive") return true;
  if (action.requestedBy === "user") return false;
  if (approvalMode === "fullAccess") return false;
  if (action.risk === "low") return false;
  return approvalMode === "ask" || approvalMode === "approveSafe";
};

export const appActionApprovalMessage = (action: AppActionDescriptor) => {
  const target = action.target ? `\nTarget: ${action.target}` : "";
  const undo = action.undoHint ? `\nUndo: ${action.undoHint}` : "";
  return `Approve app action: ${action.label}?${target}\nRisk: ${action.risk}${undo}`;
};

export const resolveAppAction = async (
  action: AppActionDescriptor,
  approvalMode: AgentApprovalMode,
  promptApproval: AppActionApprovalPrompt = () => false,
  timestamp = Date.now(),
): Promise<AppActionAuditEvent> => {
  if (action.risk === "blocked") {
    return {
      actionId: action.id,
      kind: action.kind,
      label: action.label,
      target: action.target,
      risk: action.risk,
      requestedBy: action.requestedBy,
      decision: "blocked",
      approvalMode,
      reason: action.reason ?? "Action is outside the current app-owned surface.",
      undoHint: action.undoHint,
      prompted: false,
      timestamp,
    };
  }
  const prompted = appActionNeedsApproval(action, approvalMode);
  const approved = prompted ? await promptApproval(action, appActionApprovalMessage(action)) : true;
  return {
    actionId: action.id,
    kind: action.kind,
    label: action.label,
    target: action.target,
    risk: action.risk,
    requestedBy: action.requestedBy,
    decision: approved ? "approved" : "denied",
    approvalMode,
    reason: approved
      ? action.reason ?? (prompted ? "Approved by user." : "Allowed by approval policy.")
      : "Denied by user.",
    undoHint: action.undoHint,
    prompted,
    timestamp,
  };
};

export const appActionAuditLabel = (audit: AppActionAuditEvent) => {
  if (audit.decision === "approved") return "Action approved";
  if (audit.decision === "denied") return "Action denied";
  return "Action blocked";
};
