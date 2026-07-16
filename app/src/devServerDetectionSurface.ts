import type { AgentActivityEvent } from "./agentActivity";
import type { AgentApprovalMode, AgentSessionHandleDescriptor } from "./agentSessionHandle";
import {
  resolveBrowserDevServerDetection,
} from "./browserDevServerDetection";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import { terminalSnapshotText } from "./terminalTranscript";

type Snapshot = Parameters<typeof terminalSnapshotText>[0];
type DetectionInput = Parameters<typeof resolveBrowserDevServerDetection>[0];
type DetectedServer = NonNullable<ReturnType<typeof resolveBrowserDevServerDetection>>["server"];

type ActivityInput = Pick<AgentActivityEvent, "kind" | "label" | "status">
  & Partial<Pick<AgentActivityEvent, "detail" | "outputRef" | "target">>;

type DevServerDetectionOptions = {
  approvalMode: (root: string, sessionId: string) => AgentApprovalMode;
  contextForPane: (paneId: number) => DetectionInput["context"];
  fallbackPanes: () => ManagedTerminalPane[];
  fallbackRoot: () => string | null;
  fallbackSessionId: DetectionInput["fallbackSessionId"];
  getPrevious: () => DetectionInput["previous"];
  now: () => number;
  recordActivity: (handle: AgentSessionHandleDescriptor | null, event: ActivityInput) => void;
  setDetectedServer: (server: DetectedServer) => void;
};

export const createDevServerDetection = (options: DevServerDetectionOptions) =>
  (paneId: number, snapshot: Snapshot) => {
    const detection = resolveBrowserDevServerDetection({
      approvalMode: options.approvalMode,
      context: options.contextForPane(paneId),
      fallbackPanes: options.fallbackPanes(),
      fallbackRoot: options.fallbackRoot(),
      fallbackSessionId: options.fallbackSessionId,
      now: options.now,
      paneId,
      previous: options.getPrevious(),
      text: terminalSnapshotText(snapshot),
    });
    if (!detection) return;
    options.setDetectedServer(detection.server);
    options.recordActivity(detection.handle, {
      kind: "browser", label: "Detected dev server", detail: detection.server.url,
      target: detection.server.url, outputRef: "terminal", status: "complete",
    });
  };
