import {
  buildAgentSessionHandleDescriptor,
  type AgentApprovalMode,
  type AgentSessionHandleDescriptor,
} from "./agentSessionHandle";
import { detectLocalDevServerUrl } from "./browserPreview";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import { terminalPaneLabelForDisplay } from "./terminalPane";
import type { DetectedLocalDevServer } from "./useBrowserPreviewController";

type BrowserDevServerContext = {
  panes: ManagedTerminalPane[];
  projectRoot: string;
  sessionId: string;
};

type BrowserDevServerDetectionInput = {
  approvalMode: (projectRoot: string, sessionId: string) => AgentApprovalMode;
  context: BrowserDevServerContext | null;
  fallbackPanes: ManagedTerminalPane[];
  fallbackRoot: string | null;
  fallbackSessionId: (projectRoot: string | null) => string | null;
  now: () => number;
  paneId: number;
  previous: DetectedLocalDevServer | null;
  text: string;
};

type BrowserDevServerDetection = {
  handle: AgentSessionHandleDescriptor;
  server: DetectedLocalDevServer;
};

const isDuplicate = (
  previous: DetectedLocalDevServer | null,
  server: Omit<DetectedLocalDevServer, "detectedAt" | "paneLabel">,
) => previous?.url === server.url && previous.paneId === server.paneId &&
  previous.projectId === server.projectId && previous.projectSessionId === server.projectSessionId;

export const resolveBrowserDevServerDetection = (
  input: BrowserDevServerDetectionInput,
): BrowserDevServerDetection | null => {
  const url = detectLocalDevServerUrl(input.text);
  if (!url) return null;
  const projectRoot = input.context?.projectRoot ?? input.fallbackRoot;
  const panes = input.context?.panes ?? input.fallbackPanes;
  const projectSessionId = input.context?.sessionId ?? input.fallbackSessionId(projectRoot);
  const paneIndex = panes.findIndex((pane) => pane.id === input.paneId);
  const pane = panes[paneIndex] ?? null;
  if (!projectRoot || !projectSessionId || !pane) return null;
  const scope = { paneId: input.paneId, projectId: projectRoot, projectSessionId, url };
  if (isDuplicate(input.previous, scope)) return null;
  const paneLabel = terminalPaneLabelForDisplay(
    pane.label, pane.profile.label, paneIndex >= 0 ? paneIndex : pane.slot,
  );
  return {
    server: { ...scope, detectedAt: input.now(), paneLabel },
    handle: buildAgentSessionHandleDescriptor({
      approvalMode: input.approvalMode(projectRoot, projectSessionId),
      label: paneLabel, pane, projectId: projectRoot, projectSessionId,
    }),
  };
};
