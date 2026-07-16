import type { LaunchProfile } from "./launchProfiles";

type WorkspacePickerOptions = {
  createTerminalPane: (profile: LaunchProfile) => Promise<boolean>;
  defaultProfile: () => LaunchProfile;
  openDirectoryDialog: () => Promise<string | string[] | null>;
  requestOpenWorkspace: (path: string) => Promise<boolean>;
};

export const createWorkspacePicker = (options: WorkspacePickerOptions) =>
  async (pick: { openTerminal?: boolean } = {}) => {
    const dir = await options.openDirectoryDialog();
    if (typeof dir !== "string") return false;
    const opened = await options.requestOpenWorkspace(dir);
    if (!opened) return false;
    if (pick.openTerminal) return options.createTerminalPane(options.defaultProfile());
    return true;
  };
