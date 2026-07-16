import { invoke } from "@tauri-apps/api/core";
import { confirm as confirmDialog } from "@tauri-apps/plugin-dialog";
import { requestPermission } from "@tauri-apps/plugin-notification";
import type {
  AiConnectionSettings, ConnectionTargetStatus, McpOAuthStart, McpOAuthStatus,
} from "./connectionSettings";
import { resolveScopedSetting } from "./scopedSettings";
import { createSettingsConnectionActionsController } from "./settingsConnectionActionsController";
import { createSettingsPreferenceActions } from "./settingsPreferenceActions";
import { createSettingsScopedActions } from "./settingsScopedActions";
import type { KeybindingOverrides } from "./shortcuts";
import type { createComposerSettingsActions } from "./composerSettingsActions";
import type { useConversationRuntime } from "./useConversationRuntime";
import type { useWorkspaceDomain } from "./useWorkspaceDomain";

type Ref<T> = { current: T };
type ConversationRuntime = ReturnType<typeof useConversationRuntime>;
type WorkspaceDomain = ReturnType<typeof useWorkspaceDomain>;
type Store = { clear: () => Promise<unknown>; save: () => Promise<unknown>; set: (key: string, value: unknown) => Promise<unknown> } | null;

type SettingsActionsInput = {
  aiConnectionSettingsRef: Ref<AiConnectionSettings>;
  browser: ConversationRuntime["browser"];
  chrome: { setAppTheme: Parameters<typeof createSettingsPreferenceActions>[0]["setTheme"]; setNotificationsEnabled: Parameters<typeof createSettingsPreferenceActions>[0]["setNotificationsEnabled"] };
  commandPaletteSources: Parameters<typeof createSettingsPreferenceActions>[0]["commandPaletteSources"];
  composerSettingsActions: { setApprovalMode: ReturnType<typeof createComposerSettingsActions>["setApprovalMode"] };
  composerWorkspace: WorkspaceDomain["composerWorkspace"];
  keybindingOverrides: KeybindingOverrides;
  mcpOAuth: {
    setSecretPresence: (update: (current: Record<string, boolean>) => Record<string, boolean>) => void;
    setStatuses: (update: (current: Record<string, McpOAuthStatus>) => Record<string, McpOAuthStatus>) => void;
  };
  persistence: WorkspaceDomain["persistence"];
  profiles: WorkspaceDomain["profiles"];
  resetDurableChats: () => Promise<unknown>;
  setActiveKeybindingOverrides: (next: KeybindingOverrides) => void;
  setAiConnectionSettings: (next: AiConnectionSettings) => void;
  setCommandPaletteSources: Parameters<typeof createSettingsPreferenceActions>[0]["setCommandPaletteSources"];
  setKeybindingOverrides: (next: KeybindingOverrides) => void;
  storeRef: Ref<Store>;
  workspacePath: string | null;
  workspacePathRef: Ref<string | null>;
};

const preferenceActionsFrom = (input: SettingsActionsInput) => createSettingsPreferenceActions({
  commandPaletteSources: input.commandPaletteSources,
  keybindingOverrides: input.keybindingOverrides,
  requestNotificationPermission: requestPermission,
  saveSetting: (key, value) => {
    void input.storeRef.current?.set(key, value);
    void input.storeRef.current?.save();
  },
  setCommandPaletteSources: input.setCommandPaletteSources,
  setKeybindingOverrides: (next) => { input.setActiveKeybindingOverrides(next); input.setKeybindingOverrides(next); },
  setNotificationsEnabled: input.chrome.setNotificationsEnabled,
  setTheme: input.chrome.setAppTheme,
});

const scopedActionsFrom = (input: SettingsActionsInput) => createSettingsScopedActions({
  clearScopedSetting: input.composerWorkspace.clearScopedSetting,
  readEffectiveBrowserUrl: () => resolveScopedSetting(
    input.composerWorkspace.scopedSettingsRef.current, "browserUrl", input.workspacePathRef.current,
    input.persistence.activeSessionForProject(input.workspacePathRef.current),
  ).value,
  resolveLaunchProfile: input.profiles.resolveProfile,
  restoreBrowserPreview: () => input.browser.restoreScopedUrl(
    input.workspacePathRef.current, input.persistence.activeSessionForProject(input.workspacePathRef.current),
  ),
  setBrowserLocation: input.browser.setLocation,
  setComposerApprovalMode: input.composerSettingsActions.setApprovalMode,
  switchLaunchProfile: input.profiles.switchLaunchProfile,
  updateScopedSetting: input.composerWorkspace.updateScopedSetting,
});

const connectionActionsFrom = (input: SettingsActionsInput) => createSettingsConnectionActionsController({
  applySettings: (next) => {
    input.aiConnectionSettingsRef.current = next;
    input.setAiConnectionSettings(next);
  },
  persistSettings: async (next) => {
    await input.storeRef.current?.set("aiConnectionSettings", next);
    await input.storeRef.current?.save();
  },
  clearSecretPresence: (keys) => input.mcpOAuth.setSecretPresence((current) => ({
    ...current, ...Object.fromEntries(keys.map((key) => [key, false])),
  })),
  clearStore: async () => {
    const store = input.storeRef.current;
    if (store) { await store.clear(); await store.save(); }
  },
  confirmReset: (message) => confirmDialog(message),
  deleteSecret: (key) => invoke("delete_connection_secret", { key }),
  disconnectOAuth: (payload) => invoke<McpOAuthStatus>("disconnect_mcp_oauth", payload),
  getSettings: () => input.aiConnectionSettingsRef.current,
  getWorkspacePath: () => input.workspacePath,
  probe: (payload) => invoke<ConnectionTargetStatus>("probe_mcp_server", payload),
  recordOAuthStatus: (id, status) => input.mcpOAuth.setStatuses((current) => ({ ...current, [id]: status })),
  reload: () => window.location.reload(),
  resetDurableChats: input.resetDurableChats,
  resetNativeState: () => invoke("reset_local_state"),
  startOAuth: (payload) => invoke<McpOAuthStart>("begin_mcp_oauth", payload),
});

export const buildSettingsActions = (input: SettingsActionsInput) => ({
  settingsConnectionActions: connectionActionsFrom(input),
  settingsPreferenceActions: preferenceActionsFrom(input),
  settingsScopedActions: scopedActionsFrom(input),
});
