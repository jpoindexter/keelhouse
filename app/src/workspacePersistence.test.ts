import { describe, expect, it, vi } from "vitest";

import type { PaneLayoutsBySession } from "./sessionRestore";
import type { PaneLabelsBySession } from "./workspaceBootstrap";
import type { OpenProject, ProjectSessionsByProject } from "./workspaceState";
import { createWorkspacePersistence } from "./workspacePersistence";

const setup = () => {
  const store = { set: vi.fn().mockResolvedValue(undefined), save: vi.fn().mockResolvedValue(undefined) };
  const refs = {
    activeFiles: { current: {} as Record<string, string> },
    activeSessions: { current: { "/workspace": "chat-1" } as Record<string, string> },
    openProjects: { current: [] as OpenProject[] },
    paneLabels: { current: {} as PaneLabelsBySession },
    paneLayouts: { current: {
      "/workspace\nchat-1": [{ slot: 0, profileId: "shell", label: null }],
    } as PaneLayoutsBySession },
    projectSessions: { current: {} as ProjectSessionsByProject },
    sessionSnapshots: { current: {
      "/workspace\nchat-1": { tabs: ["App.tsx"] },
    } as Record<string, { tabs: string[] }> },
    store: { current: store },
  };
  const setPaneLabels = vi.fn();
  const persistence = createWorkspacePersistence({
    ...refs,
    getActiveSession: (root) => root ? refs.activeSessions.current[root] ?? null : null,
    getPanes: () => [],
    setActiveSessions: vi.fn(),
    setOpenProjects: vi.fn(),
    setPaneLabels,
    setProjectSessions: vi.fn(),
  });
  return { persistence, refs, setPaneLabels, store };
};

describe("createWorkspacePersistence", () => {
  it("persists the active file for a workspace", async () => {
    const subject = setup();
    await subject.persistence.persistActiveFile("/workspace", "/workspace/src/App.tsx");

    expect(subject.refs.activeFiles.current).toEqual({ "/workspace": "/workspace/src/App.tsx" });
    expect(subject.store.set).toHaveBeenCalledWith("activeFileByWorkspace", subject.refs.activeFiles.current);
    expect(subject.store.save).toHaveBeenCalledOnce();
  });

  it("normalizes and orders persisted pane labels by slot", async () => {
    const subject = setup();
    await subject.persistence.persistPaneLabel("/workspace", 2, "  review   agent  ");
    await subject.persistence.persistPaneLabel("/workspace", 0, "shell");

    expect(subject.refs.paneLabels.current["/workspace\nchat-1"]).toMatchObject([
      { slot: 0, label: "shell" },
      { slot: 2, label: "review agent" },
    ]);
    expect(subject.setPaneLabels).toHaveBeenLastCalledWith(subject.refs.paneLabels.current);
  });

  it("removes both editor and pane restore records for a session", () => {
    const subject = setup();
    subject.persistence.removeSessionRestore("/workspace", "chat-1");

    expect(subject.refs.sessionSnapshots.current).toEqual({});
    expect(subject.refs.paneLayouts.current).toEqual({});
    expect(subject.store.set).toHaveBeenCalledWith("sessionEditorSnapshots", {});
    expect(subject.store.set).toHaveBeenCalledWith("paneLayoutsBySession", {});
  });
});
