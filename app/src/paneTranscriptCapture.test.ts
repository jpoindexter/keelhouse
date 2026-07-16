import { describe, expect, it, vi } from "vitest";
import type { LaunchProfile } from "./launchProfiles";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import { createPaneTranscriptCapture } from "./paneTranscriptCapture";

const profile: LaunchProfile = {
  id: "shell", label: "Shell", command: "zsh", args: [], useLoginShell: true,
};
const pane = (id: number): ManagedTerminalPane => ({
  createdAt: 1, cwd: "/repo", exitCode: null, id, label: null, profile, slot: id - 1, state: "running",
});

const snapshot = { cells: [{ t: "h" }, { t: "i" }], cols: 2, rows: 1 };

const createOptions = () => ({
  getActivePane: vi.fn(() => pane(2) as ManagedTerminalPane | null),
  getPanes: vi.fn(() => [pane(1), pane(2)]),
  getRoot: vi.fn(() => "/repo" as string | null),
  getSessionId: vi.fn(() => "chat" as string | null),
  getSnapshot: vi.fn(() => snapshot as typeof snapshot | undefined),
  now: () => 42,
  persist: vi.fn(),
});

describe("createPaneTranscriptCapture", () => {
  it("persists the active pane transcript with its index and text", () => {
    const options = createOptions();
    const capture = createPaneTranscriptCapture(options);

    capture();

    expect(options.persist).toHaveBeenCalledWith(
      "/repo", "chat", expect.objectContaining({ id: 2 }), 1, "hi", 42,
    );
  });

  it("does nothing without a pane, session, or snapshot", () => {
    const options = createOptions();
    options.getSnapshot.mockReturnValue(undefined);
    const capture = createPaneTranscriptCapture(options);
    capture();

    options.getSnapshot.mockReturnValue(snapshot);
    options.getSessionId.mockReturnValue(null);
    capture();

    expect(options.persist).not.toHaveBeenCalled();
  });
});
