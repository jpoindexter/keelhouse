import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const appMenuAssembly = readFileSync(new URL("./appMenuAssembly.ts", import.meta.url), "utf8");
const agentComposerSurface = readFileSync(new URL("./AgentComposerSurface.tsx", import.meta.url), "utf8");
const browserComposerContextMenu = readFileSync(new URL("./browserComposerContextMenu.ts", import.meta.url), "utf8");
const editorContextMenus = readFileSync(new URL("./editorContextMenus.ts", import.meta.url), "utf8");
const projectThreadsDrawer = readFileSync(new URL("./ProjectThreadsDrawer.tsx", import.meta.url), "utf8");
const projectSessionContextMenu = readFileSync(new URL("./projectSessionContextMenu.ts", import.meta.url), "utf8");
const projectSessionDeletionController = readFileSync(new URL("./projectSessionDeletionController.ts", import.meta.url), "utf8");
const shellLayout = readFileSync(new URL("./useShellLayout.ts", import.meta.url), "utf8");
const terminalViewport = readFileSync(new URL("./TerminalViewport.tsx", import.meta.url), "utf8");
const terminalContextMenu = readFileSync(new URL("./terminalContextMenu.ts", import.meta.url), "utf8");
const workspaceContextMenus = readFileSync(new URL("./workspaceContextMenus.ts", import.meta.url), "utf8");

describe("production context-menu coverage", () => {
  it("registers unique commands for every promised surface", () => {
    const menuSources = `${app}\n${appMenuAssembly}\n${browserComposerContextMenu}\n${editorContextMenus}\n${projectSessionContextMenu}\n${terminalContextMenu}\n${workspaceContextMenus}`;
    const ids = Array.from(menuSources.matchAll(/(?:menuItem|sessionItem|terminalItem)\("([^"]+)"/g), (match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const prefix of ["workspace.", "project.", "session.", "file.", "tab.", "editor.", "git.", "diff.", "terminal.", "pane.", "utility.", "browser.", "composer."]) {
      expect(ids.some((id) => id.startsWith(prefix))).toBe(true);
    }
  });

  it("wires project, session, file, editor, Git, diff, browser, terminal, and composer surfaces", () => {
    for (const marker of [
      "projectRailContextMenuItems(project)",
      "projectSessionContextMenuItems(path, session)",
      "editorTabContextMenuItems(tab)",
      "editorContextMenuItems()",
      "buildGitFileContextMenuItems(file, workspaceContextMenuActions)",
      "diffContextMenuItems()",
      "browserContextMenuItems()",
      "terminalContextMenuItems()",
      "terminalPaneContextMenuItems(pane)",
      "utilityTrayTabContextMenuItems(mode)",
      "composerContextMenuItems()",
    ]) {
      expect(app).toContain(marker);
    }
    expect(appMenuAssembly).toContain("buildComposerAddMenuItems(composerMenuInput(options))");
    const contextMenuHost = readFileSync(new URL("./useContextMenuHost.tsx", import.meta.url), "utf8");
    expect(contextMenuHost).toContain("file-tree-context-menu");
    expect(projectThreadsDrawer).toContain("props.onProjectContextMenu(event, project)");
    expect(projectThreadsDrawer).toContain("onContextMenu(event, path, session)");
  });

  it("opens a Keelhouse add menu from the composer plus control", () => {
    expect(agentComposerSurface).toContain('aria-label="Add context or action"');
    expect(agentComposerSurface).toContain("onClick={props.onOpenAddMenu}");
    expect(app).toContain("onOpenAddMenu: openComposerAddMenu");
    expect(appMenuAssembly).toContain('querySelectorAll("details.agent-composer__menu[open]")');
    expect(browserComposerContextMenu).toContain('menuItem("composer.add.files", "Files and folders"');
    expect(browserComposerContextMenu).toContain('menuItem("composer.add.parallel", "Parallel child chats"');
  });

  it("routes browser URLs and composer stop through the correct product actions", () => {
    expect(app).not.toContain("openPath(browserUrl)");
    expect(browserComposerContextMenu).toContain('menuItem("browser.open-external", "Open Externally"');
    expect(browserComposerContextMenu).toContain('menuItem("composer.stop", "Stop Chat Run"');
  });

  it("allows active projects to close through the managed close lifecycle", () => {
    expect(app).toContain("closeProject: requestCloseProject");
    const projectMenu = workspaceContextMenus.slice(workspaceContextMenus.indexOf("buildProjectRailContextMenuItems"));
    expect(projectMenu).toContain('menuItem("project.close"');
    expect(projectMenu.slice(projectMenu.indexOf('"project.close"'))).not.toContain("disabled:");
    expect(app).toContain("createProjectSessionDeletionController");
    expect(projectSessionDeletionController).toContain("options.intentionallyTerminatedPaneIds.add(pane.id)");
  });

  it("keeps chat and raw-terminal launch defaults separate", () => {
    expect(shellLayout).toContain('useState<AgentSurfaceMode>("chat")');
    expect(app).toContain("createTerminalPane(defaultTerminalLaunchProfile())");
    expect(app).toContain('pickWorkspace({ openTerminal: true })');
    expect(terminalViewport).toContain("Open a folder to start a terminal");
    expect(app).toContain('set("terminalLaunchProfile", profile)');
    expect(app).not.toContain("createTerminalPane(launchProfileRef.current)");
  });

  it("keeps browser preview in the tool tray instead of duplicating it below chat", () => {
    expect(app).not.toContain('["browser", "browser", "Browser Preview"]');
    expect(app).not.toContain('className="utility-tray__browser"');
  });
});
