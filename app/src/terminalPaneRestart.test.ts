import { describe, expect, it } from "vitest";
import { replaceRestartedPane } from "./terminalPaneRestart";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import type { LaunchProfile } from "./launchProfiles";

const profile: LaunchProfile = {
  args: [],
  command: "/bin/zsh",
  id: "shell",
  label: "Shell",
  useLoginShell: false,
};

const pane = (id: number): ManagedTerminalPane => ({
  createdAt: id,
  cwd: "/repo",
  exitCode: id === 1 ? 7 : null,
  id,
  label: null,
  profile,
  slot: id,
  state: id === 1 ? "exited" : "running",
});

describe("terminal pane restart", () => {
  it("replaces the restarted pane id and marks it running", () => {
    const panes = replaceRestartedPane([pane(1), pane(2)], 1, 9, 1234);

    expect(panes.map((item) => item.id)).toEqual([9, 2]);
    expect(panes[0]).toMatchObject({
      createdAt: 1234,
      exitCode: null,
      state: "running",
    });
  });

  it("keeps unrelated panes unchanged by reference", () => {
    const other = pane(2);
    const panes = replaceRestartedPane([pane(1), other], 1, 9, 1234);

    expect(panes[1]).toBe(other);
  });
});
