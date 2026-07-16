import type { AgentActivityEvent } from "./agentActivity";
import type { AgentApprovalMode, AgentSessionHandleDescriptor } from "./agentSessionHandle";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import {
  buildCreatedPaneActivity,
  buildCreatedWorktreePaneActivity,
} from "./paneActivityRecords";

type ActivityInput = Pick<AgentActivityEvent, "kind" | "label" | "status">
  & Partial<Pick<AgentActivityEvent, "detail" | "target">>;

type PaneActivityLogOptions = {
  approvalMode: () => AgentApprovalMode;
  recordActivity: (
    handle: AgentSessionHandleDescriptor | null, event: ActivityInput,
  ) => void;
};

export const createPaneActivityLog = (options: PaneActivityLogOptions) => ({
  recordCreated: (pane: ManagedTerminalPane, projectId: string, projectSessionId: string) => {
    const record = buildCreatedPaneActivity({
      approvalMode: options.approvalMode(), pane, projectId, projectSessionId,
    });
    options.recordActivity(record.handle, record.event);
  },
  recordCreatedWorktree: (
    pane: ManagedTerminalPane, projectId: string, projectSessionId: string, branch: string,
  ) => {
    const record = buildCreatedWorktreePaneActivity({
      approvalMode: options.approvalMode(), branch, pane, projectId, projectSessionId,
    });
    options.recordActivity(record.handle, record.event);
  },
});
