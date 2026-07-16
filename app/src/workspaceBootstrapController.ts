type Ref<T> = { current: T };

type WorkspaceBootstrapData = {
  activeFiles: unknown;
  activeSessions: unknown;
  agentActivity: unknown;
  aiConnectionSettings: unknown;
  browserProjects: unknown;
  browserSessions: unknown;
  chatConversations: unknown;
  commandPaletteSources: unknown;
  composerHarness: unknown;
  customProfiles: unknown;
  keybindings: unknown;
  lastFolder: string | undefined;
  launchProfile: unknown;
  notificationsEnabled: boolean;
  openProjects: unknown;
  paneLabels: unknown;
  paneLayouts: unknown;
  paneTranscripts: unknown;
  projectSessions: unknown;
  recentProjects: unknown;
  scopedSettings: unknown;
  sessionSnapshots: unknown;
  store: unknown;
  terminalProfile: unknown;
  theme: "mono-ghost" | null;
  worktrees: unknown;
};

type WorkspaceBootstrapControllerOptions<
  TData extends WorkspaceBootstrapData,
  TSessionSnapshotSink,
> = {
  hydrateProfiles: (input: {
    customProfiles: TData["customProfiles"];
    launchProfile: TData["launchProfile"];
    terminalProfile: TData["terminalProfile"];
  }) => void;
  loadBootstrap: () => Promise<TData>;
  openWorkspace: (folder: string, profile: TData["launchProfile"]) => Promise<unknown>;
  pickWorkspace: () => Promise<unknown>;
  refreshSecretPresence: (settings: TData["aiConnectionSettings"]) => void;
  refs: {
    activeFiles: Ref<TData["activeFiles"]>;
    activeSessions: Ref<TData["activeSessions"]>;
    aiConnectionSettings: Ref<TData["aiConnectionSettings"]>;
    browserProjects: Ref<TData["browserProjects"]>;
    browserSessions: Ref<TData["browserSessions"]>;
    chatConversations: Ref<TData["chatConversations"]>;
    composerHarness: Ref<TData["composerHarness"]>;
    openProjects: Ref<TData["openProjects"]>;
    paneLayouts: Ref<TData["paneLayouts"]>;
    projectSessions: Ref<TData["projectSessions"]>;
    recentProjects: Ref<TData["recentProjects"]>;
    scopedSettings: Ref<TData["scopedSettings"]>;
    sessionSnapshots: Ref<TSessionSnapshotSink>;
    store: Ref<TData["store"] | null>;
  };
  sendResize: () => void;
  setters: {
    setActiveSessions: (value: TData["activeSessions"]) => void;
    setAgentActivity: (value: TData["agentActivity"]) => void;
    setAiConnectionSettings: (value: TData["aiConnectionSettings"]) => void;
    setBrowserProjects: (value: TData["browserProjects"]) => void;
    setBrowserSessions: (value: TData["browserSessions"]) => void;
    setChatConversations: (value: TData["chatConversations"]) => void;
    setCommandPaletteSources: (value: TData["commandPaletteSources"]) => void;
    setComposerHarness: (value: TData["composerHarness"]) => void;
    setKeybindingOverrides: (value: TData["keybindings"]) => void;
    setKeybindings: (value: TData["keybindings"]) => void;
    setNotificationsEnabled: (enabled: boolean) => void;
    setOpenProjects: (value: TData["openProjects"]) => void;
    setPaneLabels: (value: TData["paneLabels"]) => void;
    setPaneTranscripts: (value: TData["paneTranscripts"]) => void;
    setProjectSessions: (value: TData["projectSessions"]) => void;
    setRecentProjects: (value: TData["recentProjects"]) => void;
    setScopedSettings: (value: TData["scopedSettings"]) => void;
    setTheme: (theme: "mono-ghost") => void;
    setWorktrees: (value: TData["worktrees"]) => void;
  };
};

const applyBootstrapRefs = <TData extends WorkspaceBootstrapData & { sessionSnapshots: TSink }, TSink>(
  options: WorkspaceBootstrapControllerOptions<TData, TSink>,
  data: TData,
) => {
  const { refs } = options;
  refs.store.current = data.store;
  refs.recentProjects.current = data.recentProjects;
  refs.openProjects.current = data.openProjects;
  refs.projectSessions.current = data.projectSessions;
  refs.activeSessions.current = data.activeSessions;
  refs.browserProjects.current = data.browserProjects;
  refs.browserSessions.current = data.browserSessions;
  refs.composerHarness.current = data.composerHarness;
  refs.scopedSettings.current = data.scopedSettings;
  refs.chatConversations.current = data.chatConversations;
  refs.sessionSnapshots.current = data.sessionSnapshots;
  refs.paneLayouts.current = data.paneLayouts;
  refs.aiConnectionSettings.current = data.aiConnectionSettings;
  refs.activeFiles.current = data.activeFiles;
};

const applyBootstrapState = <TData extends WorkspaceBootstrapData & { sessionSnapshots: TSink }, TSink>(
  options: WorkspaceBootstrapControllerOptions<TData, TSink>,
  data: TData,
) => {
  const { setters } = options;
  options.hydrateProfiles({
    customProfiles: data.customProfiles,
    launchProfile: data.launchProfile,
    terminalProfile: data.terminalProfile,
  });
  setters.setAiConnectionSettings(data.aiConnectionSettings);
  options.refreshSecretPresence(data.aiConnectionSettings);
  setters.setRecentProjects(data.recentProjects);
  setters.setOpenProjects(data.openProjects);
  setters.setProjectSessions(data.projectSessions);
  setters.setActiveSessions(data.activeSessions);
  setters.setBrowserProjects(data.browserProjects);
  setters.setBrowserSessions(data.browserSessions);
  setters.setComposerHarness(data.composerHarness);
  setters.setScopedSettings(data.scopedSettings);
  setters.setChatConversations(data.chatConversations);
  setters.setPaneLabels(data.paneLabels);
  setters.setAgentActivity(data.agentActivity);
  setters.setKeybindings(data.keybindings);
  setters.setKeybindingOverrides(data.keybindings);
  setters.setCommandPaletteSources(data.commandPaletteSources);
  if (data.theme) setters.setTheme(data.theme);
  if (data.notificationsEnabled) setters.setNotificationsEnabled(true);
  setters.setPaneTranscripts(data.paneTranscripts);
  setters.setWorktrees(data.worktrees);
};

const applyBootstrap = <TData extends WorkspaceBootstrapData & { sessionSnapshots: TSink }, TSink>(
  options: WorkspaceBootstrapControllerOptions<TData, TSink>,
  data: TData,
) => {
  applyBootstrapRefs(options, data);
  applyBootstrapState(options, data);
};

const initWorkspace = async <TData extends WorkspaceBootstrapData & { sessionSnapshots: TSink }, TSink>(
  options: WorkspaceBootstrapControllerOptions<TData, TSink>,
) => {
  const data = await options.loadBootstrap();
  applyBootstrap(options, data);
  if (data.lastFolder) await options.openWorkspace(data.lastFolder, data.launchProfile);
  else await options.pickWorkspace();
  options.sendResize();
};

export const createWorkspaceBootstrapController = <
  TData extends WorkspaceBootstrapData & { sessionSnapshots: TSink },
  TSink,
>(
  options: WorkspaceBootstrapControllerOptions<TData, TSink>,
) => ({
  applyBootstrap: (data: TData) => applyBootstrap(options, data),
  initWorkspace: () => initWorkspace(options),
});
