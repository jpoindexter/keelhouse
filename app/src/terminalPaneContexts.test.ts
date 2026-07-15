import { describe, expect, it, vi } from "vitest";

import { defaultTerminalLaunchProfile } from "./launchProfiles";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import { createTerminalPaneContexts, type TerminalPanesByContext } from "./terminalPaneContexts";

const pane = (id: number, state: ManagedTerminalPane["state"] = "running"): ManagedTerminalPane => ({
  createdAt: id, cwd: "/workspace", exitCode: null, id, label: null,
  profile: defaultTerminalLaunchProfile(), slot: id - 1, state,
});

const setup = () => {
  const key = "/workspace\nchat-1";
  const refs = {
    activePaneIds: { current: { [key]: 2 } },
    activeWorkspace: { current: "/workspace" as string | null },
    panes: { current: [pane(1), pane(2)] },
    panesByContext: { current: { [key]: [pane(1), pane(2)] } as TerminalPanesByContext },
  };
  const persistPaneLayout = vi.fn();
  const setActivePaneId = vi.fn();
  const setPanes = vi.fn();
  const contexts = createTerminalPaneContexts({
    ...refs,
    activeSessionForProject: (root) => root === "/workspace" ? "chat-1" : null,
    persistPaneLayout,
    setActivePaneId,
    setPanes,
  });
  return { contexts, key, persistPaneLayout, refs, setActivePaneId, setPanes };
};

describe("createTerminalPaneContexts", () => {
  it("uses the saved active pane when it still belongs to the session", () => {
    const subject = setup();
    expect(subject.contexts.activePaneForSession("/workspace", "chat-1")).toBe(2);
  });

  it("synchronizes visible panes when updating the active session", () => {
    const subject = setup();
    const next = [pane(3)];
    subject.contexts.setSessionPanes("/workspace", "chat-1", next, 3);

    expect(subject.refs.panesByContext.current[subject.key]).toEqual(next);
    expect(subject.setPanes).toHaveBeenCalledWith(next);
    expect(subject.setActivePaneId).toHaveBeenCalledWith(3);
    expect(subject.persistPaneLayout).toHaveBeenCalledWith("/workspace", "chat-1", next);
  });

  it("updates pane state in its owning session context", () => {
    const subject = setup();
    const next = subject.contexts.setPaneState(2, "exited", 0);

    expect(next.find((item) => item.id === 2)).toMatchObject({ state: "exited", exitCode: 0 });
    expect(subject.refs.panesByContext.current[subject.key][1]).toMatchObject({ state: "exited" });
  });
});
