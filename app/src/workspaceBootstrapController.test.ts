import { describe, expect, it, vi } from "vitest";
import { bootstrapRefsFromHooks, createWorkspaceBootstrapController } from "./workspaceBootstrapController";

const ref = <T,>(current: T) => ({ current });

type Data = {
  activeFiles: Record<string, string>;
  activeSessions: Record<string, string>;
  agentActivity: string[];
  aiConnectionSettings: Record<string, string>;
  browserProjects: string[];
  browserSessions: string[];
  chatConversations: Record<string, string>;
  commandPaletteSources: string[];
  composerHarness: Record<string, string>;
  customProfiles: string[];
  keybindings: Record<string, string>;
  lastFolder: string | undefined;
  launchProfile: { id: string };
  notificationsEnabled: boolean;
  openProjects: string[];
  paneLabels: Record<string, string[]>;
  paneLayouts: Record<string, string>;
  paneTranscripts: Record<string, string>;
  projectSessions: Record<string, string[]>;
  recentProjects: string[];
  scopedSettings: Record<string, string>;
  sessionSnapshots: Record<string, string>;
  store: { id: string };
  terminalProfile: { id: string };
  theme: "mono-ghost" | null;
  worktrees: string[];
};

const data = (): Data => ({
  activeFiles: { "/repo": "a.ts" },
  activeSessions: { "/repo": "chat" },
  agentActivity: ["event"],
  aiConnectionSettings: { anthropic: "key" },
  browserProjects: ["browser-project"],
  browserSessions: ["browser-session"],
  chatConversations: { chat: "conversation" },
  commandPaletteSources: ["palette"],
  composerHarness: { chat: "harness" },
  customProfiles: ["custom"],
  keybindings: { save: "mod+s" },
  lastFolder: "/repo",
  launchProfile: { id: "codex" },
  notificationsEnabled: true,
  openProjects: ["open"],
  paneLabels: { session: ["label"] },
  paneLayouts: { session: "layout" },
  paneTranscripts: { pane: "transcript" },
  projectSessions: { "/repo": ["session"] },
  recentProjects: ["recent"],
  scopedSettings: { global: "settings" },
  sessionSnapshots: { session: "snapshot" },
  store: { id: "store" },
  terminalProfile: { id: "zsh" },
  theme: "mono-ghost",
  worktrees: ["worktree"],
});

const createOptions = () => ({
  hydrateProfiles: vi.fn(),
  loadBootstrap: vi.fn(async () => data()),
  openWorkspace: vi.fn(async () => {}),
  pickWorkspace: vi.fn(async () => {}),
  refreshSecretPresence: vi.fn(),
  refs: {
    activeFiles: ref<Data["activeFiles"]>({}),
    activeSessions: ref<Data["activeSessions"]>({}),
    aiConnectionSettings: ref<Data["aiConnectionSettings"]>({}),
    browserProjects: ref<Data["browserProjects"]>([]),
    browserSessions: ref<Data["browserSessions"]>([]),
    chatConversations: ref<Data["chatConversations"]>({}),
    composerHarness: ref<Data["composerHarness"]>({}),
    openProjects: ref<Data["openProjects"]>([]),
    paneLayouts: ref<Data["paneLayouts"]>({}),
    projectSessions: ref<Data["projectSessions"]>({}),
    recentProjects: ref<Data["recentProjects"]>([]),
    scopedSettings: ref<Data["scopedSettings"]>({}),
    sessionSnapshots: ref<Data["sessionSnapshots"]>({}),
    store: ref<Data["store"] | null>(null),
  },
  sendResize: vi.fn(),
  setters: {
    setActiveSessions: vi.fn(),
    setAgentActivity: vi.fn(),
    setAiConnectionSettings: vi.fn(),
    setBrowserProjects: vi.fn(),
    setBrowserSessions: vi.fn(),
    setChatConversations: vi.fn(),
    setCommandPaletteSources: vi.fn(),
    setComposerHarness: vi.fn(),
    setKeybindingOverrides: vi.fn(),
    setKeybindings: vi.fn(),
    setNotificationsEnabled: vi.fn(),
    setOpenProjects: vi.fn(),
    setPaneLabels: vi.fn(),
    setPaneTranscripts: vi.fn(),
    setProjectSessions: vi.fn(),
    setRecentProjects: vi.fn(),
    setScopedSettings: vi.fn(),
    setTheme: vi.fn(),
    setWorktrees: vi.fn(),
  },
});

describe("createWorkspaceBootstrapController", () => {
  it("hydrates refs and state from the bootstrap snapshot", () => {
    const options = createOptions();
    const controller = createWorkspaceBootstrapController(options);
    const snapshot = data();

    controller.applyBootstrap(snapshot);

    expect(options.refs.store.current).toEqual({ id: "store" });
    expect(options.refs.recentProjects.current).toEqual(["recent"]);
    expect(options.refs.aiConnectionSettings.current).toEqual({ anthropic: "key" });
    expect(options.refs.activeFiles.current).toEqual({ "/repo": "a.ts" });
    expect(options.hydrateProfiles).toHaveBeenCalledWith({
      customProfiles: ["custom"], launchProfile: { id: "codex" }, terminalProfile: { id: "zsh" },
    });
    expect(options.setters.setAiConnectionSettings).toHaveBeenCalledWith({ anthropic: "key" });
    expect(options.refreshSecretPresence).toHaveBeenCalledWith({ anthropic: "key" });
    expect(options.setters.setProjectSessions).toHaveBeenCalledWith({ "/repo": ["session"] });
    expect(options.setters.setChatConversations).toHaveBeenCalledWith({ chat: "conversation" });
    expect(options.setters.setTheme).toHaveBeenCalledWith("mono-ghost");
    expect(options.setters.setNotificationsEnabled).toHaveBeenCalledWith(true);
    expect(options.setters.setWorktrees).toHaveBeenCalledWith(["worktree"]);
  });

  it("leaves theme and notifications untouched when absent", () => {
    const options = createOptions();
    const controller = createWorkspaceBootstrapController(options);

    controller.applyBootstrap({ ...data(), notificationsEnabled: false, theme: null });

    expect(options.setters.setTheme).not.toHaveBeenCalled();
    expect(options.setters.setNotificationsEnabled).not.toHaveBeenCalled();
  });

  it("reopens the last folder on init and schedules a resize", async () => {
    const options = createOptions();
    const controller = createWorkspaceBootstrapController(options);

    await controller.initWorkspace();

    expect(options.refs.store.current).toEqual({ id: "store" });
    expect(options.openWorkspace).toHaveBeenCalledWith("/repo", { id: "codex" });
    expect(options.pickWorkspace).not.toHaveBeenCalled();
    expect(options.sendResize).toHaveBeenCalled();
  });

  it("falls back to picking a workspace when no folder is saved", async () => {
    const options = createOptions();
    options.loadBootstrap.mockResolvedValue({ ...data(), lastFolder: undefined });
    const controller = createWorkspaceBootstrapController(options);

    await controller.initWorkspace();

    expect(options.openWorkspace).not.toHaveBeenCalled();
    expect(options.pickWorkspace).toHaveBeenCalled();
  });
});

describe("bootstrapRefsFromHooks", () => {
  it("collects the bootstrap refs from each owning hook bundle", () => {
    const options = createOptions();
    const refs = bootstrapRefsFromHooks({
      browser: {
        projectRecordsRef: options.refs.browserProjects,
        sessionRecordsRef: options.refs.browserSessions,
      },
      composer: {
        chatConversationsRef: options.refs.chatConversations,
        composerHarnessBySessionRef: options.refs.composerHarness,
        scopedSettingsRef: options.refs.scopedSettings,
      },
      editorSession: {
        activeFilesByWorkspaceRef: options.refs.activeFiles,
        sessionEditorSnapshotsRef: options.refs.sessionSnapshots,
      },
      persistence: {
        activeSessionByProjectRef: options.refs.activeSessions,
        openProjectsRef: options.refs.openProjects,
        projectSessionsRef: options.refs.projectSessions,
        recentProjectsRef: options.refs.recentProjects,
      },
      settingsRef: options.refs.aiConnectionSettings,
      storeRef: options.refs.store,
      terminal: { paneLayoutsRef: options.refs.paneLayouts },
    });

    expect(refs.activeFiles).toBe(options.refs.activeFiles);
    expect(refs.browserProjects).toBe(options.refs.browserProjects);
    expect(refs.chatConversations).toBe(options.refs.chatConversations);
    expect(refs.paneLayouts).toBe(options.refs.paneLayouts);
    expect(refs.recentProjects).toBe(options.refs.recentProjects);
    expect(refs.store).toBe(options.refs.store);
  });
});
