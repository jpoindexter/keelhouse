import type { UtilityTrayMode } from "./BottomUtilityTabs";
import type { TerminalPaneState } from "./terminalPane";
import type { ProjectSession } from "./workspaceStateTypes";

const basename = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? path;

type AppSurfaceLabelsInput = {
  activeRunId: string | undefined;
  activeSessionId: string | null;
  sessions: ProjectSession[];
  trayMode: UtilityTrayMode;
  workspacePath: string | null;
};

export const deriveAppSurfaceLabels = (input: AppSurfaceLabelsInput) => ({
  activeSessionTitle: input.activeSessionId
    ? input.sessions.find((session) => session.id === input.activeSessionId)?.title ?? "New chat"
    : "No chat",
  activeWorkspaceName: input.workspacePath ? basename(input.workspacePath) : "Open workspace",
  primarySurfaceLabel: "Codex",
  primarySurfaceState: (input.activeRunId ? "starting" : "idle") as TerminalPaneState,
  primarySurfaceStatusLabel: input.activeRunId ? "Working" : "Ready",
  utilityTrayStatusLabel: input.trayMode.charAt(0).toUpperCase() + input.trayMode.slice(1),
});
