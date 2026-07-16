import type { LaunchProfile } from "./launchProfiles";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import type { TerminalPaneProjectStatus } from "./terminalPane";
import type { ProjectRailStatus } from "./workspaceStateTypes";

type TerminalPaneFinalizeOptions = {
  getProjectStatus: (root: string) => ProjectRailStatus;
  persistProfile: (profile: LaunchProfile) => Promise<unknown>;
  scheduleResize: () => void;
  setError: (error: string | null) => void;
  setTerminalProfile: (profile: LaunchProfile) => void;
  statusForPanes: (panes: ManagedTerminalPane[]) => TerminalPaneProjectStatus;
  updateProjectStatus: (root: string, status: ProjectRailStatus) => Promise<unknown>;
  updateSessionStatus: (
    root: string, status: TerminalPaneProjectStatus,
  ) => Promise<unknown>;
};

export const createTerminalPaneFinalize = (options: TerminalPaneFinalizeOptions) =>
  async (root: string, nextPanes: ManagedTerminalPane[], profile: LaunchProfile) => {
    options.setTerminalProfile(profile);
    await options.persistProfile(profile);
    options.setError(null);
    options.scheduleResize();
    await options.updateProjectStatus(root, options.getProjectStatus(root));
    await options.updateSessionStatus(root, options.statusForPanes(nextPanes));
  };
