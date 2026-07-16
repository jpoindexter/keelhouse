type CaptureInput<TPersistLayout, TPersistSnapshots> = {
  key: string;
  persistPaneLayout: TPersistLayout;
  persistSnapshots: TPersistSnapshots;
  root: string;
  sessionId: string;
};

type SessionSnapshotCaptureOptions<TPersistLayout, TPersistSnapshots> = {
  capture: (input: CaptureInput<TPersistLayout, TPersistSnapshots>) => void;
  getRoot: () => string | null;
  makeKey: (root: string, sessionId: string) => string;
  persistPaneLayout: TPersistLayout;
  persistSnapshots: TPersistSnapshots;
  resolveSessionId: (root: string | null) => string | null;
};

export const createSessionSnapshotCapture = <TPersistLayout, TPersistSnapshots>(
  options: SessionSnapshotCaptureOptions<TPersistLayout, TPersistSnapshots>,
) => () => {
  const root = options.getRoot();
  const sessionId = options.resolveSessionId(root);
  if (!root || !sessionId) return;
  options.capture({
    key: options.makeKey(root, sessionId),
    persistPaneLayout: options.persistPaneLayout,
    persistSnapshots: options.persistSnapshots,
    root,
    sessionId,
  });
};
