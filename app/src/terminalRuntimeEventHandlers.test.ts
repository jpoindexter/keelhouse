import { describe, expect, it, vi } from "vitest";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import { createTerminalRuntimeEventHandlers } from "./terminalRuntimeEventHandlers";
import { terminalRuntimeFromHook } from "./terminalRuntimeEventHandlers";

const ref = <T,>(current: T) => ({ current });
const profile = { id: "codex", label: "Codex", command: "codex", args: [], useLoginShell: false };
const pane: ManagedTerminalPane = {
  createdAt: 1, cwd: "/repo", exitCode: null, id: 7, label: null,
  profile, slot: 0, state: "running",
};

const createOptions = () => ({
  activePaneId: ref<number | null>(7),
  activeSessionForProject: vi.fn(() => "chat" as string | null),
  approvalMode: "ask" as const,
  contextForPaneId: vi.fn(() => ({ projectRoot: "/repo", sessionId: "chat" })),
  detectLocalServer: vi.fn(),
  intentionallyTerminatedPaneIds: new Set<number>(),
  ipcSampleCounter: ref(19),
  latest: ref<unknown>(null),
  notificationsEnabled: ref(false),
  notifyBackgroundExit: vi.fn(async () => {}),
  now: vi.fn(() => 10),
  persistTranscript: vi.fn(),
  projectStatus: vi.fn(() => "attention" as const),
  recordActivity: vi.fn(),
  recordIpcPayload: vi.fn(),
  renderPerf: ref({ samples: 0 }),
  requestPaint: vi.fn(),
  setBackgroundExits: vi.fn(),
  setError: vi.fn(),
  setPaneState: vi.fn(() => [{ ...pane, exitCode: 1, state: "exited" as const }]),
  snapshotText: vi.fn(() => "terminal output"),
  snapshots: ref<Record<number, unknown>>({}),
  updateProjectStatus: vi.fn(async () => {}),
  updateSessionStatus: vi.fn(async () => {}),
  workspacePath: ref<string | null>("/repo"),
});

describe("createTerminalRuntimeEventHandlers", () => {
  it("stores an active grid snapshot, samples IPC size, and requests paint", () => {
    const options = createOptions();
    const handlers = createTerminalRuntimeEventHandlers(options);
    const payload = { paneId: 7, snapshot: { rows: 24 } };

    handlers.handleGridPayload(payload);

    expect(options.snapshots.current[7]).toEqual({ rows: 24 });
    expect(options.latest.current).toEqual({ rows: 24 });
    expect(options.detectLocalServer).toHaveBeenCalledWith(7, { rows: 24 });
    expect(options.recordIpcPayload).toHaveBeenCalledWith(
      options.renderPerf.current, JSON.stringify(payload).length,
    );
    expect(options.requestPaint).toHaveBeenCalledOnce();
  });

  it("records an active pane exit and persists its final transcript", () => {
    const options = createOptions();
    options.snapshots.current[7] = { rows: 24 };
    const handlers = createTerminalRuntimeEventHandlers(options);

    handlers.handlePaneExit({ paneId: 7, command: "codex", code: 1, message: "failed" });

    expect(options.recordActivity).toHaveBeenCalledWith(
      expect.objectContaining({ paneId: 7, projectId: "/repo", projectSessionId: "chat" }),
      expect.objectContaining({ label: "Command failed", target: "/repo" }),
    );
    expect(options.setError).toHaveBeenCalledWith("failed");
    expect(options.updateProjectStatus).toHaveBeenCalledWith("/repo", "attention");
    expect(options.updateSessionStatus).toHaveBeenCalledWith("/repo", "chat", "exited");
    expect(options.persistTranscript).toHaveBeenCalledWith(
      "/repo", "chat", expect.objectContaining({ id: 7 }), 0, "terminal output", 10,
    );
  });
});

describe("terminalRuntimeFromHook", () => {
  it("maps pane-hook refs onto the runtime handler names", () => {
    const options = createOptions();
    const hook = {
      activePaneIdRef: options.activePaneId,
      contextForPaneId: options.contextForPaneId,
      intentionallyTerminatedPaneIdsRef: { current: options.intentionallyTerminatedPaneIds },
      projectStatusForRoot: options.projectStatus,
      setPaneState: options.setPaneState,
      snapshotsRef: options.snapshots,
    };

    const mapped = terminalRuntimeFromHook(hook, options);

    expect(mapped.activePaneId).toBe(options.activePaneId);
    expect(mapped.contextForPaneId).toBe(options.contextForPaneId);
    expect(mapped.projectStatus).toBe(options.projectStatus);
    expect(mapped.snapshots).toBe(options.snapshots);
  });
});
