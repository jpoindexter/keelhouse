import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SettingsModal } from "./SettingsModal";
import { defaultScopedSettings, scopedSettingView } from "./scopedSettings";

const noop = () => undefined;

const render = (overrides: Partial<Parameters<typeof SettingsModal>[0]> = {}) => {
  const scoped = defaultScopedSettings("codex", "http://localhost:5173");
  return renderToStaticMarkup(
    <SettingsModal
      approvalSetting={scopedSettingView(scoped, "approvalMode", "/repo", "chat-a")}
      browserSetting={scopedSettingView(scoped, "browserUrl", "/repo", "chat-a")}
      gitBranch="main"
      gitChangeCount={3}
      layout="right"
      profileSetting={scopedSettingView(scoped, "agentProfileId", "/repo", "chat-a")}
      profiles={[{ id: "codex", label: "Codex" }, { id: "shell", label: "Shell" }]}
      trayMode="editor"
      onApprovalModeChange={noop}
      onBrowserUrlCommit={noop}
      onClose={noop}
      onLayoutChange={noop}
      onProfileChange={noop}
      onScopedSettingReset={noop}
      onResetLayout={noop}
      onTrayModeChange={noop}
      {...overrides}
    />,
  );
};

describe("SettingsModal", () => {
  it("renders grouped real categories as a dedicated settings workspace", () => {
    const html = render();

    for (const label of ["Personal", "Workbench", "Integrations", "General", "Appearance", "Agents", "Layout", "Browser preview", "Git"]) {
      expect(html).toContain(label);
    }
    for (const dropped of ["Pets", "Usage", "Profile</span>", "MCP servers", "Worktrees"]) {
      expect(html).not.toContain(dropped);
    }
    expect(html.match(/settings-workspace__nav-row--active/g)).toHaveLength(1);
    expect(html).toContain("settings-workspace");
    expect(html).toContain("Back to app");
    expect(html).toContain("Background notifications");
    expect(html).toContain("settings-workspace__category-select");
    expect(html).not.toContain('aria-modal="true"');
  });

  it("shows real git health and search filters rows across categories", () => {
    const html = render({ initialQuery: "localhost" });
    expect(html).toContain("Preview URL");
    expect(html).not.toContain("Default agent");

    const gitHtml = render({ initialCategory: "git" });
    expect(gitHtml).toContain("⎇ main · 3 changes");

    const noRepo = render({ initialCategory: "git", gitBranch: null, gitChangeCount: null });
    expect(noRepo).toContain("No repository detected");
  });

  it("labels the real persistence scope and keeps agent controls together", () => {
    const agentHtml = render({ initialCategory: "agents", workspaceName: "agent cli", sessionTitle: "Settings pass" });
    expect(agentHtml).toContain("Default agent");
    expect(agentHtml).toContain("Permission mode");
    expect(agentHtml).toContain("Global default");
    expect(agentHtml).toContain("Inherited from Global");

    const projectHtml = render({ initialCategory: "git", workspaceName: "agent cli" });
    expect(projectHtml).toContain("Project · agent cli");
  });
});
