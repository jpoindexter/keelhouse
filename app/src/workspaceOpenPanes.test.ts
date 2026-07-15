import { describe, expect, it } from "vitest";
import { buildWorkspaceOpenPane } from "./workspaceOpenPanes";
import type { LaunchProfile } from "./launchProfiles";

const shellProfile: LaunchProfile = {
  id: "shell",
  label: "Shell",
  command: "/bin/zsh",
  args: ["-l"],
  useLoginShell: false,
};

describe("buildWorkspaceOpenPane", () => {
  it("builds a running pane from a restored layout record", () => {
    const pane = buildWorkspaceOpenPane({
      createdAt: 55,
      cwd: "/repo",
      layout: { slot: 2, profileId: "shell", label: "Server" },
      paneId: 9,
      profile: shellProfile,
      savedLabel: "Saved label",
    });

    expect(pane).toEqual({
      createdAt: 55,
      cwd: "/repo",
      exitCode: null,
      id: 9,
      label: "Server",
      profile: shellProfile,
      slot: 2,
      state: "running",
    });
  });

  it("falls back to the saved label when the layout has no label", () => {
    const pane = buildWorkspaceOpenPane({
      createdAt: 56,
      cwd: "/repo",
      layout: { slot: 0, profileId: "shell", label: null },
      paneId: 10,
      profile: shellProfile,
      savedLabel: "Shell 1",
    });

    expect(pane.label).toBe("Shell 1");
  });
});
