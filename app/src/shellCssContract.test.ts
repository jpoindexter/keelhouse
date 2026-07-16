import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readCssSource } from "./readCssSource";

const css = readCssSource(new URL("./App.css", import.meta.url));
const transitions = readFileSync(new URL("./workbenchTransitions.css", import.meta.url), "utf8");

describe("responsive shell CSS contract", () => {
  it("keeps chat primary and the bottom tray available in every dock position", () => {
    const convergence = css.slice(css.indexOf("Chrome convergence:"));
    expect(convergence).toMatch(/\.workbench\.workbench--drawer-right\s*\{[^}]*grid-template-rows:\s*38px minmax\(0,\s*1fr\) 6px var\(--utility-tray-height, 42px\);[^}]*"utilitysplit utilitysplit utilitysplit"[^}]*"utility utility utility";/s);
    expect(convergence).toMatch(/\.workbench\.workbench--drawer-left\s*\{[^}]*grid-template-rows:\s*38px minmax\(0,\s*1fr\) 6px var\(--utility-tray-height, 42px\);[^}]*"utilitysplit utilitysplit utilitysplit"[^}]*"utility utility utility";/s);
    expect(convergence).toMatch(/\.workbench\.workbench--drawer-bottom\s*\{[^}]*grid-template-rows:[^}]*var\(--utility-tray-height, 42px\);[^}]*"utilitysplit"[^}]*"utility";/s);
    expect(transitions).toMatch(/\.workbench\.workbench--drawer-hidden\s*\{[^}]*grid-template-columns:\s*minmax\(420px,\s*1fr\) 1px 0;[^}]*grid-template-rows:\s*38px minmax\(0,\s*1fr\) 6px var\(--utility-tray-height, 42px\);[^}]*"utilitysplit utilitysplit utilitysplit"[^}]*"utility utility utility";/s);
    expect(transitions).toMatch(/\.app-shell--tools-hidden \.app-titlebar\s*\{[^}]*grid-template-columns:[^}]*176px;/s);
    expect(transitions).toMatch(/prefers-reduced-motion:\s*reduce[^}]*transition:\s*none;/s);
    expect(convergence).toMatch(/\.agent-surface--terminal \.agent-chat-surface\s*\{[^}]*display:\s*flex;/s);
    expect(convergence).toMatch(/\.agent-chat-surface\s*\{[^}]*height:\s*100%;/s);
    expect(convergence).toMatch(/\.chat-thread\s*\{[^}]*flex:\s*1 1 auto;[^}]*min-height:\s*0;/s);
  });

  it("removes the Threads column instead of leaving a clipped icon rail", () => {
    const convergence = css.slice(css.indexOf("Chrome convergence:"));
    expect(convergence).toMatch(/\.app-shell\.app-shell--side-drawer-collapsed\s*\{[^}]*grid-template-columns:\s*0 0 minmax\(0, 1fr\);/s);
    expect(convergence).toMatch(/\.app-shell--side-drawer-collapsed \.file-rail\s*\{[^}]*display:\s*none;/s);
    expect(convergence).toMatch(/\.app-shell--side-drawer-collapsed \.status-bar\s*\{[^}]*grid-template-columns:\s*0 minmax\(0, 1fr\) auto;/s);
  });

  it("uses hairline pane boundaries with wider invisible resize targets", () => {
    const convergence = css.slice(css.indexOf("Chrome convergence:"));
    expect(convergence).toContain("grid-template-columns: minmax(420px, 1fr) 1px var(--dock-width, 430px);");
    expect(convergence).toContain("grid-template-columns: var(--dock-width, 430px) 1px minmax(420px, 1fr);");
    expect(convergence).toMatch(/\.side-drawer-resizer\s*\{[^}]*width:\s*9px;[^}]*margin-left:\s*-4px;[^}]*border:\s*0;/s);
    expect(convergence).toMatch(/\.side-drawer-resizer::before\s*\{[^}]*inset:\s*0 4px;[^}]*background:\s*#2b2d36;/s);
    expect(convergence).toMatch(/\.workbench--drawer-right \.workbench-resizer--tray\.workbench-resizer--right\s*\{[^}]*width:\s*9px;[^}]*margin-left:\s*-4px;[^}]*border:\s*0;/s);
    expect(convergence).toMatch(/\.workbench--drawer-right \.workbench-resizer--tray\.workbench-resizer--right::before\s*\{[^}]*inset:\s*0 4px;[^}]*background:\s*#2b2d36;/s);
  });

  it("places the Context surface in every supported dock position", () => {
    expect(css).toMatch(/\.tool-tray-tabs\s*\{[^}]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\) 34px;/s);
    expect(css).toMatch(/\.workspace-context-dock\s*\{[^}]*grid-area:\s*context;/s);
    expect(css).toMatch(/\.workbench\.workbench--tools-context\.workbench--drawer-right\s*\{[^}]*"terminal rightsplit context"/s);
    expect(css).toMatch(/\.workbench\.workbench--tools-context\.workbench--drawer-left\s*\{[^}]*"context rightsplit terminal"/s);
    expect(css).toMatch(/\.workbench\.workbench--tools-context\.workbench--drawer-bottom\s*\{[^}]*"context"/s);
    expect(css).toMatch(/\.workbench--tools-context \.workspace-context-dock\s*\{[^}]*display:\s*flex;/s);
  });

  it("overlays Context without replacing chat at narrow widths", () => {
    const contextCss = css.slice(css.indexOf(".workspace-context-dock"));
    expect(contextCss).toMatch(/@media \(max-width:\s*1120px\)[^{]*\{[\s\S]*\.workbench\.workbench--tools-context\.workbench--drawer-right[\s\S]*grid-template-areas:[^}]*"terminal"[^}]*"utility";/s);
    expect(contextCss).toMatch(/@media \(max-width:\s*1120px\)[\s\S]*\.workbench--tools-context \.workspace-context-dock\s*\{[^}]*position:\s*absolute;[^}]*right:\s*0;[^}]*width:\s*min\(360px,\s*100%\);/s);
    expect(contextCss).toMatch(/\.workbench--tools-context\.workbench--drawer-right \.terminal-panel[^}]*display:\s*flex;/s);
  });

  it("floats the open Threads drawer above the 900px conversation", () => {
    expect(css).toMatch(/@media \(max-width:\s*900px\)[\s\S]*\.app-shell:not\(\.app-shell--side-drawer-collapsed\)\s*\{[^}]*grid-template-columns:\s*0 0 minmax\(0,\s*1fr\);/s);
    expect(css).toMatch(/@media \(max-width:\s*900px\)[\s\S]*\.app-shell:not\(\.app-shell--side-drawer-collapsed\) \.file-rail\s*\{[^}]*position:\s*absolute;[^}]*width:\s*min\(272px,\s*calc\(100% - 48px\)\);/s);
    expect(css).toMatch(/\.app-shell:not\(\.app-shell--side-drawer-collapsed\) \.file-rail\s*\{[^}]*grid-column:\s*1 \/ -1;[^}]*grid-row:\s*2;/s);
  });
});
