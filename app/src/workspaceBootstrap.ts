import { load, type Store } from "@tauri-apps/plugin-store";
import { normalizeAgentActivityEvents } from "./agentActivity";
import { DEFAULT_BROWSER_PREVIEW_URL, normalizeBrowserPreviewRecords } from "./browserPreview";
import { normalizeChatConversationRecords } from "./chatConversation";
import {
  loadDurableChatConversations,
  migrateLegacyChatConversations,
} from "./chatStore";
import { normalizeCommandPaletteSources } from "./commandPaletteSources";
import { normalizeComposerHarnessRecords } from "./composerHarness";
import { normalizeAiConnectionSettings } from "./connectionSettings";
import {
  defaultTerminalLaunchProfile,
  launchProfileById,
  normalizeCustomLaunchProfiles,
  normalizeLaunchProfile,
  normalizeTerminalLaunchProfile,
  type LaunchProfile,
} from "./launchProfiles";
import { normalizePaneTranscripts } from "./paneTranscripts";
import {
  defaultScopedSettings,
  migrateLegacyScopedSettings,
  normalizeScopedSettings,
} from "./scopedSettings";
import { normalizePaneLayoutsBySession, normalizeSessionEditorSnapshots } from "./sessionRestore";
import { normalizeKeybindingOverrides } from "./shortcuts";
import { normalizeTerminalPaneLabel } from "./terminalPane";
import { normalizeWorktrees } from "./worktrees";
import { migrateWorkspaceStore } from "./workspaceMigrations";
import {
  ensureProjectSessions,
  normalizeActiveFileByWorkspace,
  normalizeActiveSessionByProject,
  normalizeOpenProjects,
  normalizeProjectSessionsByProject,
  normalizeRecentProjects,
  openProjectsFromRecent,
} from "./workspaceState";

export type PaneLabelRecord = { slot: number; label: string; updatedAt: number };
export type PaneLabelsBySession = Record<string, PaneLabelRecord[]>;

export const normalizePaneLabelsBySession = (value: unknown): PaneLabelsBySession => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, rawRecords]) => {
        if (!Array.isArray(rawRecords)) return [key, []] as const;
        const records = rawRecords.flatMap((record): PaneLabelRecord[] => {
          if (!record || typeof record !== "object") return [];
          const data = record as { slot?: unknown; label?: unknown; updatedAt?: unknown };
          const slot = typeof data.slot === "number" && Number.isInteger(data.slot) && data.slot >= 0 ? data.slot : null;
          const label = normalizeTerminalPaneLabel(data.label);
          if (slot == null || !label) return [];
          return [{ slot, label, updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : 0 }];
        });
        return [key, records] as const;
      })
      .filter(([, records]) => records.length > 0),
  );
};

const loadMigratedStore = async (): Promise<Store> => {
  const store = await load("workspace.json", { autoSave: true, defaults: {} });
  const migration = migrateWorkspaceStore(Object.fromEntries(await store.entries()));
  if (!migration.migrated) return store;
  for (const [key, value] of Object.entries(migration.data)) await store.set(key, value);
  await store.save();
  return store;
};

const readProjectState = async (store: Store) => {
  const recentProjects = normalizeRecentProjects(await store.get<unknown>("recentFolders"));
  const savedOpenProjects = normalizeOpenProjects(await store.get<unknown>("openProjects"));
  const openProjects = savedOpenProjects.length > 0 ? savedOpenProjects : openProjectsFromRecent(recentProjects);
  const savedSessions = normalizeProjectSessionsByProject(await store.get<unknown>("projectSessions"));
  return {
    recentProjects,
    openProjects,
    projectSessions: openProjects.reduce(
      (sessions, project) => ensureProjectSessions(sessions, project.path, Date.now()),
      savedSessions,
    ),
    activeSessions: normalizeActiveSessionByProject(await store.get<unknown>("activeSessionByProject")),
    activeFiles: normalizeActiveFileByWorkspace(await store.get<unknown>("activeFileByWorkspace")),
  };
};

const readAgentState = async (store: Store) => ({
  savedProfile: normalizeLaunchProfile(await store.get<unknown>("launchProfile")),
  customProfiles: normalizeCustomLaunchProfiles(await store.get<unknown>("customLaunchProfiles")),
  aiConnectionSettings: normalizeAiConnectionSettings(await store.get<unknown>("aiConnectionSettings")),
  terminalProfile: normalizeTerminalLaunchProfile(await store.get<unknown>("terminalLaunchProfile")),
});

const resolveStoredProfile = (id: string, customProfiles: LaunchProfile[]) =>
  customProfiles.find((profile) => profile.id === id) ?? launchProfileById(id);

const readScopedState = async (store: Store, agent: Awaited<ReturnType<typeof readAgentState>>) => {
  const browserProjects = normalizeBrowserPreviewRecords(await store.get<unknown>("browserPreviewByProject"));
  const browserSessions = normalizeBrowserPreviewRecords(await store.get<unknown>("browserPreviewBySession"));
  const composerHarness = normalizeComposerHarnessRecords(
    await store.get<unknown>("composerHarnessBySession"),
    agent.savedProfile.id,
  );
  const stored = await store.get<unknown>("scopedSettings");
  const scopedSettings = stored == null
    ? migrateLegacyScopedSettings({
        agentProfileId: agent.savedProfile.id,
        browserUrl: DEFAULT_BROWSER_PREVIEW_URL,
        browserProjects,
        browserChats: browserSessions,
        composerChats: composerHarness,
      })
    : normalizeScopedSettings(stored, defaultScopedSettings(agent.savedProfile.id, DEFAULT_BROWSER_PREVIEW_URL));
  if (stored == null || JSON.stringify(stored) !== JSON.stringify(scopedSettings)) {
    await store.set("scopedSettings", scopedSettings);
    await store.save();
  }
  return { browserProjects, browserSessions, composerHarness, scopedSettings };
};

const readChatState = async (store: Store) => {
  const legacy = normalizeChatConversationRecords(await store.get<unknown>("chatConversations"));
  await migrateLegacyChatConversations(legacy);
  const chatConversations = normalizeChatConversationRecords(await loadDurableChatConversations());
  if ((await store.get<unknown>("chatConversations")) !== null) {
    await store.delete("chatConversations");
    await store.save();
  }
  return chatConversations;
};

const readUiState = async (store: Store) => ({
  paneLabels: normalizePaneLabelsBySession(await store.get<unknown>("paneLabelsBySession")),
  sessionSnapshots: normalizeSessionEditorSnapshots(await store.get<unknown>("sessionEditorSnapshots")),
  paneLayouts: normalizePaneLayoutsBySession(await store.get<unknown>("paneLayoutsBySession")),
  agentActivity: normalizeAgentActivityEvents(await store.get<unknown>("agentActivityEvents")),
  keybindings: normalizeKeybindingOverrides(await store.get<unknown>("keybindingOverrides")),
  commandPaletteSources: normalizeCommandPaletteSources(await store.get<unknown>("commandPaletteSources")),
  theme: (await store.get<unknown>("appTheme")) === "mono-ghost" ? "mono-ghost" as const : null,
  notificationsEnabled: (await store.get<unknown>("notificationsEnabled")) === true,
  paneTranscripts: normalizePaneTranscripts(await store.get<unknown>("paneTranscripts")),
  worktrees: normalizeWorktrees(await store.get<unknown>("worktrees")),
});

export const loadWorkspaceBootstrap = async () => {
  const store = await loadMigratedStore();
  const agent = await readAgentState(store);
  const scoped = await readScopedState(store, agent);
  return {
    store,
    ...(await readProjectState(store)),
    ...agent,
    ...scoped,
    chatConversations: await readChatState(store),
    ...(await readUiState(store)),
    launchProfile: resolveStoredProfile(
      scoped.scopedSettings.global.agentProfileId,
      agent.customProfiles,
    ),
    lastFolder: await store.get<string>("folder"),
    fallbackTerminalProfile: defaultTerminalLaunchProfile(),
  };
};
