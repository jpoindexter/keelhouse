import { describe, expect, it, vi } from "vitest";
import { createDevServerDetection } from "./devServerDetectionSurface";
import type { LaunchProfile } from "./launchProfiles";
import type { ManagedTerminalPane } from "./managedTerminalPane";

const profile: LaunchProfile = {
  id: "shell", label: "Shell", command: "zsh", args: [], useLoginShell: true,
};
const pane: ManagedTerminalPane = {
  createdAt: 1, cwd: "/repo", exitCode: null, id: 4, label: null, profile, slot: 0, state: "running",
};

const snapshotWith = (line: string) => ({
  cells: [...line].map((t) => ({ t })),
  cols: line.length,
  rows: 1,
});

const createOptions = () => ({
  approvalMode: vi.fn(() => "ask" as const),
  contextForPane: vi.fn(() => ({ panes: [pane], projectRoot: "/repo", root: "/repo", sessionId: "chat" })),
  fallbackPanes: () => [pane],
  fallbackRoot: () => "/repo" as string | null,
  fallbackSessionId: vi.fn(() => "chat" as string | null),
  getPrevious: vi.fn(() => null),
  now: () => 42,
  recordActivity: vi.fn(),
  setDetectedServer: vi.fn(),
});

describe("createDevServerDetection", () => {
  it("publishes a detected dev server and records browser activity", () => {
    const options = createOptions();
    const detect = createDevServerDetection(options);

    detect(4, snapshotWith("Local: http://localhost:5173/ ready"));

    expect(options.setDetectedServer).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringContaining("http://localhost:5173") }),
    );
    expect(options.recordActivity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ kind: "browser", label: "Detected dev server" }),
    );
  });

  it("stays silent when the snapshot has no server url", () => {
    const options = createOptions();
    const detect = createDevServerDetection(options);

    detect(4, snapshotWith("compiling..."));

    expect(options.setDetectedServer).not.toHaveBeenCalled();
    expect(options.recordActivity).not.toHaveBeenCalled();
  });
});
