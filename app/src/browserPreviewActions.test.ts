import { describe, expect, it, vi } from "vitest";
import type { AppActionDecision } from "./appActions";
import { createBrowserPreviewActions } from "./browserPreviewActions";
import { defaultScopedSettings } from "./scopedSettings";

const createActions = () => {
  const calls: string[] = [];
  const state = {
    currentRoot: "/repo" as string | null,
    currentSessionId: "session-1" as string | null,
    projects: { "/other": "http://localhost:4173/" } as Record<string, string>,
    scopedSettings: defaultScopedSettings(),
    sessions: {} as Record<string, string>,
  };
  const dependencies = {
    gateAction: vi.fn(async (): Promise<AppActionDecision> => "approved"),
    getState: vi.fn(() => state),
    restoreLocation: vi.fn(() => { calls.push("restore"); }),
    saveStore: vi.fn(async () => { calls.push("save"); }),
    setError: vi.fn((message: string | null) => { calls.push(`error:${message}`); }),
    setLocation: vi.fn(() => { calls.push("location"); }),
    setProjects: vi.fn((projects: Record<string, string>) => {
      calls.push("projects");
      state.projects = projects;
    }),
    setScopedSettings: vi.fn((settings) => {
      calls.push("scoped");
      state.scopedSettings = settings;
    }),
    setSessions: vi.fn((sessions: Record<string, string>) => {
      calls.push("sessions");
      state.sessions = sessions;
    }),
    setStoreValue: vi.fn(async (key: string) => { calls.push(`store:${key}`); }),
  };
  return { actions: createBrowserPreviewActions(dependencies), calls, dependencies, state };
};

describe("createBrowserPreviewActions", () => {
  it("persists project, session, and scoped browser URLs together", async () => {
    const { actions, calls, dependencies } = createActions();

    await actions.persistUrl("/repo", "session-1", "http://localhost:5173/");

    expect(dependencies.setProjects).toHaveBeenCalledWith(expect.objectContaining({
      "/other": "http://localhost:4173/",
      "/repo": "http://localhost:5173/",
    }));
    expect(dependencies.setSessions).toHaveBeenCalledWith({
      "/repo\nsession-1": "http://localhost:5173/",
    });
    expect(dependencies.setScopedSettings).toHaveBeenCalledWith(expect.objectContaining({
      chats: expect.objectContaining({
        "/repo\nsession-1": expect.objectContaining({ browserUrl: "http://localhost:5173/" }),
      }),
    }));
    expect(calls.slice(-4)).toEqual([
      "store:browserPreviewByProject", "store:browserPreviewBySession",
      "store:scopedSettings", "save",
    ]);
  });

  it("restores the most specific scoped browser URL", () => {
    const { actions, dependencies, state } = createActions();
    state.scopedSettings = {
      ...state.scopedSettings,
      projects: { "/repo": { browserUrl: "http://localhost:4000/" } },
      chats: { "/repo\nsession-1": { browserUrl: "http://localhost:5000/" } },
    };

    actions.restoreUrl("/repo", "session-1");

    expect(dependencies.restoreLocation).toHaveBeenCalledWith("http://localhost:5000/");
  });

  it("does not persist a browser URL without a workspace", async () => {
    const { actions, dependencies } = createActions();

    await actions.persistUrl(null, null, "http://localhost:5173/");

    expect(dependencies.setProjects).not.toHaveBeenCalled();
    expect(dependencies.setStoreValue).not.toHaveBeenCalled();
  });

  it("persists only project scope when no session is active", async () => {
    const { actions, dependencies, state } = createActions();

    await actions.persistUrl("/repo", null, "http://localhost:5173/");

    expect(dependencies.setSessions).toHaveBeenCalledWith(state.sessions);
    expect(dependencies.setScopedSettings).toHaveBeenCalledWith(expect.objectContaining({
      projects: expect.objectContaining({
        "/repo": expect.objectContaining({ browserUrl: "http://localhost:5173/" }),
      }),
      chats: {},
    }));
  });

  it("rejects an unsupported browser URL before requesting approval", async () => {
    const { actions, dependencies } = createActions();

    const navigated = await actions.navigate("javascript:alert(1)");

    expect(navigated).toBe(false);
    expect(dependencies.setError).toHaveBeenCalledWith("Enter an http, https, or file URL.");
    expect(dependencies.gateAction).not.toHaveBeenCalled();
  });

  it("navigates and persists a normalized URL after approval", async () => {
    const { actions, calls, dependencies } = createActions();

    const navigated = await actions.navigate("localhost:5173");

    expect(navigated).toBe(true);
    expect(dependencies.gateAction).toHaveBeenCalledWith(expect.objectContaining({
      kind: "open-browser-preview",
      target: "http://localhost:5173/",
    }));
    expect(dependencies.setLocation).toHaveBeenCalledWith("http://localhost:5173/");
    expect(calls).toContain("save");
  });

  it("does not change location when navigation approval is denied", async () => {
    const { actions, dependencies } = createActions();
    dependencies.gateAction.mockResolvedValueOnce("denied");

    const navigated = await actions.navigate("localhost:5173");

    expect(navigated).toBe(false);
    expect(dependencies.setLocation).not.toHaveBeenCalled();
    expect(dependencies.setStoreValue).not.toHaveBeenCalled();
  });
});
