// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultTerminalLaunchProfile } from "./launchProfiles";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import { useTerminalPaneController } from "./useTerminalPaneController";

const pane = (id: number): ManagedTerminalPane => ({
  createdAt: id,
  cwd: "/repo",
  exitCode: null,
  id,
  label: null,
  profile: defaultTerminalLaunchProfile(),
  slot: id - 1,
  state: "running",
});

const createOptions = () => ({
  activeSessionForProject: vi.fn((root: string | null) => root === "/repo" ? "session-1" : null),
  activeWorkspace: { current: "/repo" as string | null },
  persistPaneLayout: vi.fn(),
});

describe("useTerminalPaneController", () => {
  it("synchronizes visible state when an active session receives panes", () => {
    const options = createOptions();
    const { result } = renderHook(() => useTerminalPaneController<unknown>(options));
    const panes = [pane(1), pane(2)];

    act(() => result.current.setSessionPanes("/repo", "session-1", panes, 2));

    expect(result.current.panes).toEqual(panes);
    expect(result.current.panesRef.current).toEqual(panes);
    expect(result.current.activePaneId).toBe(2);
    expect(result.current.activePaneIdRef.current).toBe(2);
    expect(options.persistPaneLayout).toHaveBeenCalledWith("/repo", "session-1", panes);
  });

  it("updates pane labels through their persistence ref", () => {
    const options = createOptions();
    const { result } = renderHook(() => useTerminalPaneController<unknown>(options));
    const labels = { "/repo\nsession-1": [{ label: "Dev", slot: 0, updatedAt: 10 }] };

    act(() => result.current.setPaneLabels(labels));

    expect(result.current.paneLabelsRef.current).toEqual(labels);
  });
});
