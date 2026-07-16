import type { AppSettingsHostProps, SettingsHostBundles } from "./appSettingsHost";
import { settingsAgentProfileOptions } from "./settingsModalData";
import { LAUNCH_PROFILES } from "./launchProfiles";

type Modal = AppSettingsHostProps["modal"];

type AppSettingsHostInput = {
  activeChat: {
    activeAgentProfileSetting: Modal["profileSetting"];
    activeApprovalSetting: Modal["approvalSetting"];
    activeBrowserSetting: Modal["browserSetting"];
  };
  agentHookStatus: Modal["agentHookStatus"];
  aiConnectionSettings: Modal["aiConnectionSettings"];
  chrome: { appTheme: Modal["theme"]; notificationsEnabled: boolean };
  commandPaletteSources: Modal["commandPaletteSources"];
  connectionActions: SettingsHostBundles["connectionActions"] & { saveSettings: SettingsHostBundles["handlers"]["saveConnectionSettings"] };
  utilityTrayControls: { openAgentConnection: SettingsHostBundles["handlers"]["openAgentConnection"] };
  gitStatusHook: { status: { branch: string | null; files: unknown[] } | null };
  keybindingOverrides: Modal["keybindingOverrides"];
  mcpOAuth: {
    deleteSecret: SettingsHostBundles["handlers"]["deleteConnectionSecret"];
    saveSecret: SettingsHostBundles["handlers"]["saveConnectionSecret"];
    secretPresence: Modal["connectionSecretPresence"];
    statuses: Modal["mcpOAuthStatuses"];
  };
  openUrl: (url: string) => Promise<unknown>;
  preferenceActions: SettingsHostBundles["preferenceActions"];
  profiles: SettingsHostBundles["profilesController"] & { customProfiles: Modal["customTerminalProfiles"] };
  scopedActions: SettingsHostBundles["scopedActions"];
  setSettingsOpen: (open: boolean) => void;
  settingsOpen: boolean;
  settingsRuntime: {
    agentConnectionsRefreshing: Modal["agentConnectionsRefreshing"];
    agentConnectionsStatus: Modal["agentConnectionsStatus"];
    refreshAgentConnections: SettingsHostBundles["handlers"]["refreshAgentConnections"];
    repoLocation: Modal["repoLocation"];
    sourceControlStatus: Modal["sourceControlStatus"];
  };
  shellLayout: {
    renderedWorkbenchLayout: Modal["layout"];
    resetInterface: SettingsHostBundles["handlers"]["resetLayout"];
    setToolTrayMode: SettingsHostBundles["handlers"]["setTrayMode"];
    setWorkbenchLayout: SettingsHostBundles["handlers"]["setLayout"];
    toolTrayMode: Modal["trayMode"];
  };
  surfaceLabels: { activeSessionTitle: string; activeWorkspaceName: string };
  workspacePath: string | null;
};

const settingsHandlersFrom = (input: AppSettingsHostInput): SettingsHostBundles["handlers"] => ({
  close: () => input.setSettingsOpen(false),
  deleteConnectionSecret: input.mcpOAuth.deleteSecret,
  openAgentConnection: input.utilityTrayControls.openAgentConnection,
  openSourceControlLink: (url) => input.openUrl(url).catch(() => {}),
  refreshAgentConnections: input.settingsRuntime.refreshAgentConnections,
  resetLayout: input.shellLayout.resetInterface,
  saveConnectionSecret: input.mcpOAuth.saveSecret,
  saveConnectionSettings: input.connectionActions.saveSettings,
  setLayout: input.shellLayout.setWorkbenchLayout,
  setTrayMode: input.shellLayout.setToolTrayMode,
});

const settingsModalFrom = (input: AppSettingsHostInput): Modal => ({
  agentConnectionsRefreshing: input.settingsRuntime.agentConnectionsRefreshing, agentConnectionsStatus: input.settingsRuntime.agentConnectionsStatus, agentHookStatus: input.agentHookStatus,
  aiConnectionSettings: input.aiConnectionSettings,
  approvalSetting: input.activeChat.activeApprovalSetting,
  browserSetting: input.activeChat.activeBrowserSetting,
  commandPaletteSources: input.commandPaletteSources, connectionSecretPresence: input.mcpOAuth.secretPresence,
  customTerminalProfiles: input.profiles.customProfiles,
  gitBranch: input.gitStatusHook.status?.branch ?? null,
  gitChangeCount: input.gitStatusHook.status ? input.gitStatusHook.status.files.length : null,
  keybindingOverrides: input.keybindingOverrides,
  layout: input.shellLayout.renderedWorkbenchLayout,
  mcpOAuthStatuses: input.mcpOAuth.statuses, notificationsEnabled: input.chrome.notificationsEnabled,
  profileSetting: input.activeChat.activeAgentProfileSetting,
  profiles: settingsAgentProfileOptions(LAUNCH_PROFILES),
  repoLocation: input.settingsRuntime.repoLocation,
  sessionTitle: input.surfaceLabels.activeSessionTitle,
  sourceControlStatus: input.settingsRuntime.sourceControlStatus,
  theme: input.chrome.appTheme,
  trayMode: input.shellLayout.toolTrayMode,
  workspaceName: input.surfaceLabels.activeWorkspaceName,
  workspacePath: input.workspacePath ?? "",
});

export const appSettingsHostPropsFrom = (input: AppSettingsHostInput): AppSettingsHostProps => ({
  open: input.settingsOpen,
  connectionActions: input.connectionActions,
  preferenceActions: input.preferenceActions,
  profilesController: input.profiles,
  scopedActions: input.scopedActions,
  handlers: settingsHandlersFrom(input),
  modal: settingsModalFrom(input),
});
