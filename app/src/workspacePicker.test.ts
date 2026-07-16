import { describe, expect, it, vi } from "vitest";
import type { LaunchProfile } from "./launchProfiles";
import { createWorkspacePicker } from "./workspacePicker";

const profile: LaunchProfile = {
  id: "zsh", label: "zsh", command: "zsh", args: [], useLoginShell: true,
};

const createOptions = () => ({
  createTerminalPane: vi.fn(async () => true),
  defaultProfile: () => profile,
  openDirectoryDialog: vi.fn(async () => "/repo" as string | string[] | null),
  requestOpenWorkspace: vi.fn(async () => true),
});

describe("createWorkspacePicker", () => {
  it("opens the chosen folder and reports success", async () => {
    const options = createOptions();
    const pick = createWorkspacePicker(options);

    expect(await pick()).toBe(true);

    expect(options.requestOpenWorkspace).toHaveBeenCalledWith("/repo");
    expect(options.createTerminalPane).not.toHaveBeenCalled();
  });

  it("optionally opens a terminal after the workspace", async () => {
    const options = createOptions();
    const pick = createWorkspacePicker(options);

    expect(await pick({ openTerminal: true })).toBe(true);

    expect(options.createTerminalPane).toHaveBeenCalledWith(profile);
  });

  it("bails out on a cancelled dialog or failed open", async () => {
    const options = createOptions();
    options.openDirectoryDialog.mockResolvedValue(null);
    const pick = createWorkspacePicker(options);
    expect(await pick()).toBe(false);

    options.openDirectoryDialog.mockResolvedValue("/repo");
    options.requestOpenWorkspace.mockResolvedValue(false);
    expect(await pick({ openTerminal: true })).toBe(false);
    expect(options.createTerminalPane).not.toHaveBeenCalled();
  });
});
