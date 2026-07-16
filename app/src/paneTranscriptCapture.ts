import type { ManagedTerminalPane } from "./managedTerminalPane";
import { terminalSnapshotText } from "./terminalTranscript";

type Snapshot = Parameters<typeof terminalSnapshotText>[0];

type PaneTranscriptCaptureOptions = {
  getActivePane: () => ManagedTerminalPane | null;
  getPanes: () => ManagedTerminalPane[];
  getRoot: () => string | null;
  getSessionId: () => string | null;
  getSnapshot: (paneId: number) => Snapshot | undefined;
  now: () => number;
  persist: (
    root: string, sessionId: string, pane: ManagedTerminalPane,
    paneIndex: number, text: string, capturedAt: number,
  ) => void;
};

export const createPaneTranscriptCapture = (options: PaneTranscriptCaptureOptions) => () => {
  const pane = options.getActivePane();
  const root = options.getRoot();
  const sessionId = options.getSessionId();
  if (!pane || !root || !sessionId) return;
  const snapshot = options.getSnapshot(pane.id);
  if (!snapshot) return;
  const paneIndex = options.getPanes().findIndex((item) => item.id === pane.id);
  options.persist(root, sessionId, pane, paneIndex, terminalSnapshotText(snapshot), options.now());
};
