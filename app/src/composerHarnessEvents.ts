import type { AgentActivityEvent } from "./agentActivity";
import type { AgentSessionHandleDescriptor } from "./agentSessionHandle";

type EventStatus = AgentActivityEvent["status"];
type ActivityInput = Pick<AgentActivityEvent, "kind" | "label" | "status">
  & Partial<Pick<AgentActivityEvent, "detail">>;

type ComposerHarnessEventLogOptions = {
  getDescriptor: () => AgentSessionHandleDescriptor | null;
  recordActivity: (
    handle: AgentSessionHandleDescriptor | null, event: ActivityInput,
  ) => void;
};

export const createComposerHarnessEventLog = (options: ComposerHarnessEventLogOptions) =>
  (label: string, detail: string, status: EventStatus = "complete") => {
    options.recordActivity(options.getDescriptor(), {
      kind: "app",
      label,
      detail,
      status,
    });
  };
