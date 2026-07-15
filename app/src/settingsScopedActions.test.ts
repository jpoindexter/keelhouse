import { describe, expect, it, vi } from "vitest";
import type { LaunchProfile } from "./launchProfiles";
import { createSettingsScopedActions } from "./settingsScopedActions";

const codexProfile: LaunchProfile = {
  id: "codex",
  label: "Codex",
  command: "codex",
  args: [],
  useLoginShell: true,
};

const createWorkflow = () => {
  const clearScopedSetting = vi.fn().mockResolvedValue(true);
  const readEffectiveBrowserUrl = vi.fn(() => "http://project.test");
  const restoreBrowserPreview = vi.fn();
  const setBrowserLocation = vi.fn();
  const setComposerApprovalMode = vi.fn().mockResolvedValue(undefined);
  const switchLaunchProfile = vi.fn().mockResolvedValue(undefined);
  const updateScopedSetting = vi.fn().mockResolvedValue(true);
  const actions = createSettingsScopedActions({
    clearScopedSetting,
    readEffectiveBrowserUrl,
    resolveLaunchProfile: (id) => id === "codex" ? codexProfile : null,
    restoreBrowserPreview,
    setBrowserLocation,
    setComposerApprovalMode,
    switchLaunchProfile,
    updateScopedSetting,
  });
  return {
    actions,
    clearScopedSetting,
    readEffectiveBrowserUrl,
    restoreBrowserPreview,
    setBrowserLocation,
    setComposerApprovalMode,
    switchLaunchProfile,
    updateScopedSetting,
  };
};

describe("settings scoped actions", () => {
  it("routes approval changes between the active chat and persisted scopes", async () => {
    const workflow = createWorkflow();

    await workflow.actions.onApprovalModeChange("chat", "fullAccess");
    await workflow.actions.onApprovalModeChange("project", "approveSafe");

    expect(workflow.setComposerApprovalMode).toHaveBeenCalledWith("fullAccess");
    expect(workflow.updateScopedSetting).toHaveBeenCalledWith("project", "approvalMode", "approveSafe");
  });

  it("ignores invalid browser URLs and applies the effective URL after persistence", async () => {
    const workflow = createWorkflow();

    await workflow.actions.onBrowserUrlCommit("project", "not a url");
    expect(workflow.updateScopedSetting).not.toHaveBeenCalled();
    await workflow.actions.onBrowserUrlCommit("project", " example.com/path ");

    expect(workflow.updateScopedSetting).toHaveBeenCalledWith("project", "browserUrl", "http://example.com/path");
    expect(workflow.readEffectiveBrowserUrl).toHaveBeenCalledOnce();
    expect(workflow.setBrowserLocation).toHaveBeenCalledWith("http://project.test");
  });

  it("routes profiles by scope and ignores unresolved profiles", async () => {
    const workflow = createWorkflow();

    await workflow.actions.onProfileChange("global", "missing");
    await workflow.actions.onProfileChange("global", "codex");
    await workflow.actions.onProfileChange("chat", "codex");

    expect(workflow.switchLaunchProfile).toHaveBeenCalledWith(codexProfile);
    expect(workflow.updateScopedSetting).toHaveBeenCalledWith("chat", "agentProfileId", "codex");
  });

  it("maps reset rows and restores the browser only for browser URL resets", async () => {
    const workflow = createWorkflow();

    await workflow.actions.onScopedSettingReset("agents.profile", "project");
    await workflow.actions.onScopedSettingReset("agents.permission", "chat");
    await workflow.actions.onScopedSettingReset("browser.url", "project");

    expect(workflow.clearScopedSetting.mock.calls).toEqual([
      ["project", "agentProfileId"],
      ["chat", "approvalMode"],
      ["project", "browserUrl"],
    ]);
    expect(workflow.restoreBrowserPreview).toHaveBeenCalledOnce();
  });
});
