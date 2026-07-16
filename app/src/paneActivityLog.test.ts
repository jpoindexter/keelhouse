import { describe, expect, it, vi } from "vitest";
import type { LaunchProfile } from "./launchProfiles";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import { createPaneActivityLog } from "./paneActivityLog";

const profile: LaunchProfile = {
  id: "codex", label: "Codex", command: "codex", args: [], useLoginShell: false,
};
const pane: ManagedTerminalPane = {
  createdAt: 1, cwd: "/repo", exitCode: null, id: 4, label: null, profile, slot: 0, state: "running",
};

const createOptions = () => ({
  approvalMode: vi.fn(() => "ask" as const),
  recordActivity: vi.fn(),
});

describe("createPaneActivityLog", () => {
  it("records pane creation against the pane's own handle", () => {
    const options = createOptions();
    const log = createPaneActivityLog(options);

    log.recordCreated(pane, "/repo", "chat");

    expect(options.recordActivity).toHaveBeenCalledWith(
      expect.objectContaining({ paneId: 4, projectId: "/repo", projectSessionId: "chat" }),
      expect.objectContaining({ kind: "process", label: "Created pane" }),
    );
  });

  it("records worktree pane creation with its branch detail", () => {
    const options = createOptions();
    const log = createPaneActivityLog(options);

    log.recordCreatedWorktree(pane, "/repo", "chat", "agent/task");

    expect(options.recordActivity).toHaveBeenCalledWith(
      expect.objectContaining({ paneId: 4 }),
      expect.objectContaining({ detail: expect.stringContaining("agent/task") }),
    );
  });
});
