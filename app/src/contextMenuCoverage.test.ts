import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

describe("production context-menu coverage", () => {
  it("registers unique commands for every promised surface", () => {
    const ids = Array.from(app.matchAll(/menuItem\("([^"]+)"/g), (match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const prefix of ["workspace.", "project.", "session.", "file.", "tab.", "editor.", "git.", "diff.", "terminal.", "pane.", "utility.", "browser.", "composer."]) {
      expect(ids.some((id) => id.startsWith(prefix))).toBe(true);
    }
  });

  it("wires project, session, file, editor, Git, diff, browser, terminal, and composer surfaces", () => {
    for (const marker of [
      "projectRailContextMenuItems(project)",
      "projectSessionContextMenuItems(project.path, session)",
      "file-tree-context-menu",
      "editorTabContextMenuItems(tab)",
      "editorContextMenuItems()",
      "gitFileContextMenuItems(file)",
      "diffContextMenuItems()",
      "browserContextMenuItems()",
      "terminalContextMenuItems()",
      "terminalPaneContextMenuItems(pane)",
      "utilityTrayTabContextMenuItems(mode)",
      "composerContextMenuItems()",
    ]) {
      expect(app).toContain(marker);
    }
  });

  it("routes browser URLs and composer stop through the correct product actions", () => {
    expect(app).not.toContain("openPath(browserUrl)");
    expect(app).toContain('menuItem("browser.open-external", "Open Externally", () => openUrl(browserUrl)');
    expect(app).toContain('menuItem("composer.stop", "Stop Chat Run", () => stopActiveChatRun()');
  });

  it("allows active projects to close through the managed close lifecycle", () => {
    const menu = app.slice(app.indexOf("const projectRailContextMenuItems"), app.indexOf("const projectSessionContextMenuItems"));
    expect(menu).toContain("requestCloseProject(project)");
    expect(menu.slice(menu.indexOf('"project.close"'))).not.toContain("disabled:");
    expect(app).toContain("intentionallyTerminatedPaneIdsRef.current.add(pane.id)");
  });

  it("keeps chat and raw-terminal launch defaults separate", () => {
    expect(app).toContain('useState<AgentSurfaceMode>("chat")');
    expect(app).toContain("createTerminalPane(defaultTerminalLaunchProfile())");
    expect(app).toContain('set("terminalLaunchProfile", profile)');
    expect(app).not.toContain("createTerminalPane(launchProfileRef.current)");
  });

  it("keeps browser preview in the tool tray instead of duplicating it below chat", () => {
    expect(app).not.toContain('["browser", "browser", "Browser Preview"]');
    expect(app).not.toContain('className="utility-tray__browser"');
  });
});
