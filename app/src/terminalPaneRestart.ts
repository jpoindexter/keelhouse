import type { ManagedTerminalPane } from "./managedTerminalPane";

export const replaceRestartedPane = (
  panes: ManagedTerminalPane[],
  previousPaneId: number,
  nextPaneId: number,
  createdAt: number,
): ManagedTerminalPane[] => panes.map((pane) =>
  pane.id === previousPaneId
    ? { ...pane, id: nextPaneId, state: "running", exitCode: null, createdAt }
    : pane,
);
