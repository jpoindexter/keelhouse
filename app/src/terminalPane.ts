export type TerminalPaneState = "idle" | "starting" | "running" | "exited" | "error";
export type TerminalPaneProjectStatus = "running" | "exited" | "attention";
export const MAX_TERMINAL_PANE_LABEL_LENGTH = 48;

export const terminalPaneStateLabel = (state: TerminalPaneState, exitCode: number | null) => {
  if (state === "idle") return "No pane";
  if (state === "starting") return "Starting";
  if (state === "running") return "Running";
  if (state === "exited") return exitCode == null ? "Exited" : `Exited ${exitCode}`;
  return "Error";
};

export const terminalPaneCwdLabel = (path: string | null) => {
  if (!path) return "No cwd";
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
};

export const terminalPaneDisplayName = (profileLabel: string, index: number) => `${profileLabel} ${index + 1}`;

export const normalizeTerminalPaneLabel = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_TERMINAL_PANE_LABEL_LENGTH);
};

export const terminalPaneLabelForDisplay = (customLabel: string | null | undefined, profileLabel: string, index: number) =>
  normalizeTerminalPaneLabel(customLabel) ?? terminalPaneDisplayName(profileLabel, index);

export const terminalPaneProjectStatus = (panes: Array<{ state: TerminalPaneState }>): TerminalPaneProjectStatus => {
  if (panes.some((pane) => pane.state === "running" || pane.state === "starting")) return "running";
  if (panes.length > 0 && panes.every((pane) => pane.state === "exited")) return "exited";
  return "attention";
};
