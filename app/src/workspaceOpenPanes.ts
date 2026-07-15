import type { LaunchProfile } from "./launchProfiles";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import type { PaneLayoutRecord } from "./sessionRestore";

type BuildWorkspaceOpenPaneInput = {
  createdAt: number;
  cwd: string;
  layout: PaneLayoutRecord;
  paneId: number;
  profile: LaunchProfile;
  savedLabel: string | null;
};

export const buildWorkspaceOpenPane = ({
  createdAt,
  cwd,
  layout,
  paneId,
  profile,
  savedLabel,
}: BuildWorkspaceOpenPaneInput): ManagedTerminalPane => ({
  createdAt,
  cwd,
  exitCode: null,
  id: paneId,
  label: layout.label ?? savedLabel,
  profile,
  slot: layout.slot,
  state: "running",
});
