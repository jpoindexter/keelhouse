import type { AgentApprovalMode } from "./agentSessionHandle";
import { normalizeBrowserPreviewUrl } from "./browserPreview";
import type { LaunchProfile } from "./launchProfiles";
import type { ScopedSettingKey, ScopedSettingsValues, SettingsScope } from "./scopedSettings";

type ScopedResetRowId = "agents.profile" | "agents.permission" | "browser.url";

type SettingsScopedWorkflow = {
  clearScopedSetting: (scope: Exclude<SettingsScope, "global">, key: ScopedSettingKey) => Promise<unknown>;
  readEffectiveBrowserUrl: () => string;
  resolveLaunchProfile: (profileId: string) => LaunchProfile | null;
  restoreBrowserPreview: () => void;
  setBrowserLocation: (url: string) => void;
  setComposerApprovalMode: (mode: AgentApprovalMode) => Promise<unknown>;
  switchLaunchProfile: (profile: LaunchProfile) => Promise<unknown>;
  updateScopedSetting: <K extends ScopedSettingKey>(
    scope: SettingsScope,
    key: K,
    value: ScopedSettingsValues[K],
  ) => Promise<unknown>;
};

const resetKeyForRow = (rowId: ScopedResetRowId): ScopedSettingKey => {
  if (rowId === "agents.profile") return "agentProfileId";
  if (rowId === "agents.permission") return "approvalMode";
  return "browserUrl";
};

export const createSettingsScopedActions = (workflow: SettingsScopedWorkflow) => ({
  onApprovalModeChange: async (scope: SettingsScope, mode: AgentApprovalMode) => {
    if (scope === "chat") await workflow.setComposerApprovalMode(mode);
    else await workflow.updateScopedSetting(scope, "approvalMode", mode);
  },
  onBrowserUrlCommit: async (scope: SettingsScope, url: string) => {
    const normalized = normalizeBrowserPreviewUrl(url);
    if (!normalized) return;
    await workflow.updateScopedSetting(scope, "browserUrl", normalized);
    workflow.setBrowserLocation(workflow.readEffectiveBrowserUrl());
  },
  onProfileChange: async (scope: SettingsScope, profileId: string) => {
    const profile = workflow.resolveLaunchProfile(profileId);
    if (!profile) return;
    if (scope === "global") await workflow.switchLaunchProfile(profile);
    else await workflow.updateScopedSetting(scope, "agentProfileId", profile.id);
  },
  onScopedSettingReset: async (rowId: ScopedResetRowId, scope: Exclude<SettingsScope, "global">) => {
    const key = resetKeyForRow(rowId);
    await workflow.clearScopedSetting(scope, key);
    if (key === "browserUrl") workflow.restoreBrowserPreview();
  },
});
