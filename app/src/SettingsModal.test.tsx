import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SettingsModal } from "./SettingsModal";

const noop = () => undefined;

const render = (overrides: Partial<Parameters<typeof SettingsModal>[0]> = {}) =>
  renderToStaticMarkup(
    <SettingsModal
      approvalMode="ask"
      browserUrl="http://localhost:5173"
      gitBranch="main"
      gitChangeCount={3}
      layout="right"
      profileId="codex"
      profiles={[{ id: "codex", label: "Codex" }, { id: "shell", label: "Shell" }]}
      trayMode="editor"
      onApprovalModeChange={noop}
      onBrowserUrlCommit={noop}
      onClose={noop}
      onLayoutChange={noop}
      onProfileChange={noop}
      onResetLayout={noop}
      onTrayModeChange={noop}
      {...overrides}
    />,
  );

describe("SettingsModal", () => {
  it("renders only the real categories with the active nav stripe", () => {
    const html = render();

    for (const label of ["General", "Layout", "Browser preview", "Git"]) {
      expect(html).toContain(label);
    }
    for (const dropped of ["Pets", "Usage", "Profile</span>", "MCP servers", "Worktrees"]) {
      expect(html).not.toContain(dropped);
    }
    expect(html.match(/settings-modal__nav-row--active/g)).toHaveLength(1);
    expect(html).toContain("Default agent");
    expect(html).toContain("Permission mode");
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
});
