import { describe, expect, it, vi } from "vitest";
import { buildSettingsActions } from "./settingsActionsHost";
import { defaultScopedSettings } from "./scopedSettings";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => null) }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ confirm: vi.fn(async () => true) }));
vi.mock("@tauri-apps/plugin-notification", () => ({ requestPermission: vi.fn(async () => "granted") }));

const ref = <T,>(current: T) => ({ current });

const createOptions = () =>
  ({
    aiConnectionSettingsRef: ref({}),
    browser: { restoreScopedUrl: vi.fn(), setLocation: vi.fn() },
    chrome: { setAppTheme: vi.fn(), setNotificationsEnabled: vi.fn() },
    commandPaletteSources: {},
    composerSettingsActions: { setApprovalMode: vi.fn() },
    composerWorkspace: {
      clearScopedSetting: vi.fn(), scopedSettingsRef: ref(defaultScopedSettings()), updateScopedSetting: vi.fn(),
    },
    keybindingOverrides: {},
    mcpOAuth: { setSecretPresence: vi.fn(), setStatuses: vi.fn() },
    persistence: { activeSessionForProject: () => null },
    profiles: { resolveProfile: vi.fn(), switchLaunchProfile: vi.fn() },
    resetDurableChats: vi.fn(),
    setActiveKeybindingOverrides: vi.fn(),
    setAiConnectionSettings: vi.fn(),
    setCommandPaletteSources: vi.fn(),
    setKeybindingOverrides: vi.fn(),
    storeRef: ref({ clear: vi.fn(), save: vi.fn(), set: vi.fn() }),
    workspacePath: "/repo",
    workspacePathRef: ref("/repo"),
  }) as unknown as Parameters<typeof buildSettingsActions>[0];

describe("buildSettingsActions", () => {
  it("builds the three settings action controllers", () => {
    const actions = buildSettingsActions(createOptions());

    expect(actions.settingsPreferenceActions).toBeTypeOf("object");
    expect(actions.settingsScopedActions).toBeTypeOf("object");
    expect(actions.settingsConnectionActions.saveSettings).toBeTypeOf("function");
  });

  it("fans keybinding overrides to both the active and persisted setters", () => {
    const options = createOptions();
    const actions = buildSettingsActions(options);

    actions.settingsPreferenceActions.onKeybindingOverrideChange("workspace.quick-open", ["Mod-p"]);
    expect(options.setActiveKeybindingOverrides).toHaveBeenCalled();
    expect(options.setKeybindingOverrides).toHaveBeenCalled();
  });
});
