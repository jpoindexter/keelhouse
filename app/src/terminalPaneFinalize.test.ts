import { describe, expect, it, vi } from "vitest";
import type { LaunchProfile } from "./launchProfiles";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import { createTerminalPaneFinalize } from "./terminalPaneFinalize";

const profile: LaunchProfile = {
  id: "zsh", label: "zsh", command: "zsh", args: [], useLoginShell: true,
};
const pane: ManagedTerminalPane = {
  createdAt: 1, cwd: "/repo", exitCode: null, id: 1, label: null, profile, slot: 0, state: "running",
};

const createOptions = () => ({
  getProjectStatus: vi.fn(() => "running" as const),
  persistProfile: vi.fn(async () => {}),
  scheduleResize: vi.fn(),
  setError: vi.fn(),
  setTerminalProfile: vi.fn(),
  statusForPanes: vi.fn(() => "running" as const),
  updateProjectStatus: vi.fn(async () => {}),
  updateSessionStatus: vi.fn(async () => {}),
});

describe("createTerminalPaneFinalize", () => {
  it("persists the profile, clears errors, and refreshes both statuses", async () => {
    const options = createOptions();
    const finalize = createTerminalPaneFinalize(options);

    await finalize("/repo", [pane], profile);

    expect(options.setTerminalProfile).toHaveBeenCalledWith(profile);
    expect(options.persistProfile).toHaveBeenCalledWith(profile);
    expect(options.setError).toHaveBeenCalledWith(null);
    expect(options.scheduleResize).toHaveBeenCalled();
    expect(options.updateProjectStatus).toHaveBeenCalledWith("/repo", "running");
    expect(options.updateSessionStatus).toHaveBeenCalledWith("/repo", "running");
    expect(options.statusForPanes).toHaveBeenCalledWith([pane]);
  });
});
