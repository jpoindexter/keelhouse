// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createAppAction } from "./appActions";
import type { AgentSessionHandleDescriptor } from "./agentSessionHandle";
import { useAgentActivityController } from "./useAgentActivityController";

const paneHandle: AgentSessionHandleDescriptor = {
  activity: { label: "Running", status: "running", updatedAt: 20 },
  agentProfileId: "codex",
  agentProfileLabel: "Codex",
  approvalMode: "ask",
  createdAt: 10,
  cwd: "/repo",
  exitCode: null,
  id: "pane:7",
  label: "Terminal task",
  paneId: 7,
  processState: "running",
  projectId: "/repo",
  projectSessionId: "session-1",
};

const createOptions = () => ({
  activeAgentDescriptor: { current: null as AgentSessionHandleDescriptor | null },
  activeProviderId: "claude" as string | null,
  activeProviderLabel: "Claude",
  approvalMode: "ask" as const,
  confirmAction: vi.fn(() => false),
  getChatApprovalMode: vi.fn(() => "approveSafe" as const),
  getRoot: vi.fn(() => "/repo" as string | null),
  getSessionId: vi.fn(() => "session-1" as string | null),
  now: vi.fn(() => 100),
  persistEvents: vi.fn(),
});

describe("useAgentActivityController", () => {
  it("records and persists activity for a real handle", () => {
    const options = createOptions();
    const { result } = renderHook(() => useAgentActivityController(options));

    act(() => result.current.recordAgentActivity(paneHandle, {
      detail: "src/App.tsx",
      kind: "file",
      label: "Edited file",
      status: "complete",
      timestamp: 120,
    }));

    expect(result.current.agentActivityEvents).toEqual([
      expect.objectContaining({
        detail: "src/App.tsx",
        id: "pane:7:file:120",
        label: "Edited file",
      }),
    ]);
    expect(options.persistEvents).toHaveBeenCalledWith(result.current.agentActivityEvents);
  });

  it("uses a pane handle when present and otherwise builds the active chat handle", () => {
    const options = createOptions();
    const { result, rerender } = renderHook(() => useAgentActivityController(options));

    expect(result.current.activeAgentActivityHandle()).toMatchObject({
      agentProfileId: "claude",
      approvalMode: "approveSafe",
      id: "chat:session-1",
      paneId: -1,
      projectId: "/repo",
    });
    options.activeAgentDescriptor.current = paneHandle;
    rerender();
    expect(result.current.activeAgentActivityHandle()).toBe(paneHandle);
  });

  it("records prompted denials but not silent user approvals", async () => {
    const options = createOptions();
    const { result } = renderHook(() => useAgentActivityController(options));
    const composerAction = createAppAction({
      kind: "create-pane",
      label: "Create pane",
      requestedBy: "composer",
      risk: "medium",
    }, 1);
    const userAction = createAppAction({
      kind: "open-file",
      label: "Open file",
      requestedBy: "user",
      risk: "low",
    }, 2);

    await act(async () => {
      await expect(result.current.gateAppAction(composerAction)).resolves.toMatchObject({
        decision: "denied",
        prompted: true,
      });
    });
    expect(result.current.agentActivityEvents[0]).toMatchObject({
      kind: "approval",
      label: "Action denied",
      status: "error",
    });
    await act(async () => {
      await expect(result.current.gateAppAction(userAction)).resolves.toMatchObject({
        decision: "approved",
        prompted: false,
      });
    });
    expect(result.current.agentActivityEvents).toHaveLength(1);
  });
});
