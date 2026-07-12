#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const fail = [];

const assert = (condition, message) => {
  if (!condition) fail.push(message);
};

const appCss = read("app/src/App.css");
const appTsx = read("app/src/App.tsx");
const agentRunSurface = read("app/src/AgentRunSurface.tsx");
const toolDockMenu = read("app/src/ToolDockMenu.tsx");
const toolTrayTabs = read("app/src/ToolTrayTabs.tsx");
const workbenchLayout = read("app/src/workbenchLayout.ts");
const tauriBackend = read("app/src-tauri/src/lib.rs");
const editorQaFixture = read("docs/qa/editor-parity.html");
const demo = read("demo/keelhouse-chrome-demo.html");

const rejectedWarmAccent = /#e07a4f|#251b16|#d9a079|var\(--orange\)|orange accent|warm accent dominance/i;
const checkedText = [
  ["app/src/App.css", appCss],
  ["app/src/App.tsx", appTsx],
  ["app/src/AgentRunSurface.tsx", agentRunSurface],
  ["app/src/ToolDockMenu.tsx", toolDockMenu],
  ["demo/keelhouse-chrome-demo.html", demo],
];

for (const [file, text] of checkedText) {
  assert(!rejectedWarmAccent.test(text), `${file} contains rejected warm/orange accent tokens`);
  assert(!/You ·|Keelhouse ·|msg-icon/.test(text), `${file} contains rejected chat avatar/identity markers`);
}

assert(appCss.includes("--steel-cyan-500: #67c3d1;"), "App CSS must define steel-cyan primary accent #67c3d1");
assert(appCss.includes("--steel-cyan-400: #9bd9e3;"), "App CSS must define steel-cyan strong accent #9bd9e3");
assert(appCss.includes("--steel-cyan-900: #162c33;"), "App CSS must define steel-cyan muted surface #162c33");
assert(appCss.includes("--color-accent-border: var(--blue-500);"), "App accent border must flow through the semantic accent token");
assert(appCss.includes("--toolbar-control-bg-hover: rgba(255, 255, 255, 0.055);"), "App CSS must define flat toolbar hover chrome");
assert(appCss.includes("--toolbar-control-active-bg: rgba(103, 195, 209, 0.1);"), "App CSS must define flat steel-cyan toolbar active chrome");
assert(/\.agent-surface-switcher\s*\{[^}]*border: 0;[^}]*background: transparent;/s.test(appCss), "Agent surface switcher must not render an enclosing segmented-control box");
assert(/\.layout-switcher\s*\{[^}]*border: 0;[^}]*background: transparent;/s.test(appCss), "Layout switcher must not render an enclosing segmented-control box");
assert(/\.agent-surface-switcher__button--active\s*\{[^}]*box-shadow: inset 0 -2px 0 var\(--color-accent-border\);/s.test(appCss), "Agent surface active state must use a flat underline accent");
assert(/\.layout-switcher__button--active\s*\{[^}]*box-shadow: inset 0 -2px 0 var\(--color-accent-border\);/s.test(appCss), "Layout active state must use a flat underline accent");
assert(/\.terminal-pane-button--active\s*\{[^}]*box-shadow: inset 0 -2px 0 var\(--color-accent-border\);/s.test(appCss), "Pane active state must use a flat underline accent");
assert(/\.terminal-command,\s*\.terminal-mode\s*\{[^}]*display: none;/s.test(appCss), "Terminal toolbar must hide low-value command/mode text to avoid chrome crowding");
assert(/\.terminal-title\s*\{[^}]*display: none;/s.test(appCss), "Terminal toolbar must not duplicate the selected profile label");
assert(appCss.includes("container-type: inline-size;"), "Browser preview must use container-aware chrome behavior");
assert(/@container \(max-width: 280px\)\s*\{[\s\S]*?\.browser-button--go\s*\{[^}]*display: none;/s.test(appCss), "Narrow browser tray must hide the Open button to prevent toolbar overlap");
assert(appCss.includes(".agent-thread-event"), "App CSS must include thread-style agent event cards");
assert(agentRunSurface.includes("agent-thread-event"), "Agent run surface must render provenance activity rows");
assert(!agentRunSurface.includes("agent-activity-log__title\">Activity"), "Agent events must stay inline instead of becoming a separate Activity dashboard");
assert(appTsx.includes('className="terminal-tray"'), "App must expose the raw terminal as a dedicated bottom tray");
assert(appTsx.includes("drawerActiveTitle"), "App drawer header must be mode-aware, not a generic Drawer label");
assert(!appTsx.includes("<span>Drawer</span>"), "App drawer header must not render a generic Drawer label");
assert(appTsx.includes("Project threads"), "Projects drawer must present project sessions as threads");
assert(appTsx.includes("Agent run and raw terminal"), "Agent surface must be labelled as a run with raw terminal as escape hatch");
assert(appTsx.includes("<span>Run</span>"), "Agent surface switcher must name the primary surface Run");
assert(workbenchLayout.includes('DEFAULT_WORKBENCH_LAYOUT: WorkbenchLayoutMode = "right"'), "First open must show the demo layout: tray docked right (FIRST-OPEN-LAYOUT, supersedes hidden-first-open)");
assert(workbenchLayout.includes('DEFAULT_TOOL_TRAY_MODE: ToolTrayMode = "files"'), "First tool tray open must default to files");
assert(workbenchLayout.includes("DEFAULT_SIDE_DRAWER_WIDTH = 332"), "Approved desktop thread width must remain 332px");
assert(workbenchLayout.includes("trayPercent: 39"), "Approved desktop dock must open at the 430px-equivalent size");
assert(appCss.includes('grid-template-columns: var(--side-drawer-width) 6px minmax(420px, 1fr) 6px var(--dock-width, 430px);'), "Desktop shell must preserve the approved 332/6/center/6/430 geometry");
assert(appCss.includes("grid-template-rows: 38px minmax(0, 1fr) 6px 42px;"), "Workbench must preserve the approved thread/dock/splitter/terminal row geometry");
assert(appTsx.includes('aria-label="Reset interface"'), "Threads header must expose an always-visible interface reset");
assert(appTsx.includes('aria-label="Toggle Files"'), "Titlebar must expose persistent panel toggles");
assert(tauriBackend.includes('app.get_webview_window("main")'), "Main window must have an explicit startup recovery path");
assert(appCss.includes(".workbench.workbench--drawer-hidden .files-dock"), "Hidden tools must not leave an implicit narrow column");
assert(toolTrayTabs.includes("current === next ? null : next"), "Clicking the active dock tab must close that panel");
assert(appTsx.includes("workbench--tools-${toolTrayMode}"), "Workbench must render the active tool tray mode class");
assert(appTsx.includes("toolTrayMode === \"split\" ? ("), "Editor/browser splitter must render only in split tray mode");
assert(toolDockMenu.includes("Hide tools"), "Tool dock menu must expose a direct way to return to the agent-only layout");
assert(toolDockMenu.includes('aria-label="Tools and dock position"'), "Tool dock controls must use one compact, labelled menu");
assert(appTsx.includes("commandPaletteOpen"), "App chrome must expose a command palette state");
assert(appTsx.includes("shortcutKeys(\"chrome.command-palette\")"), "Command palette must show its shortcut label");
assert(appCss.includes(".command-palette"), "App CSS must style the command palette surface");
assert(appCss.includes(".command-palette__row--active"), "Command palette must have a visible active row state");
assert(appTsx.includes("quickOpenOpen"), "App chrome must expose a Cmd+P quick-open surface");
assert(appTsx.includes("search_workspace_text"), "Search drawer must call the workspace text search command");
assert(appTsx.includes("search-scope-tabs"), "Search drawer must expose Files/Text scopes");
assert(editorQaFixture.includes("Project threads drawer"), "Editor QA fixture must reflect the project-thread drawer");
assert(!editorQaFixture.includes(">Drawer<"), "Editor QA fixture must not show a generic Drawer label");
assert(editorQaFixture.includes("workbench--tools-split"), "Editor QA fixture must include split tool tray mode");
assert(editorQaFixture.includes("tool-tray-switcher"), "Editor QA fixture must render tool tray tabs");
assert(/\.workbench--tools-editor \.browser-preview,\s*\.workbench--tools-browser \.editor-area\s*\{[^}]*display: none;/s.test(appCss), "Single tool tray modes must hide the unused editor/browser tray");
assert(/\.tool-tray-switcher__button--active\s*\{[^}]*box-shadow: inset 0 -2px 0 var\(--color-accent-border\);/s.test(appCss), "Tool tray active state must use a flat underline accent");
assert(demo.includes("--accent: #67c3d1;"), "Accepted chrome demo must use steel-cyan #67c3d1");
assert(demo.includes("--accent-strong: #9bd9e3;"), "Accepted chrome demo must use steel-cyan strong #9bd9e3");
assert(demo.includes("--accent-soft: #162c33;"), "Accepted chrome demo must use steel-cyan soft #162c33");
assert(/\.thread-row\.active\s*\{[^}]*box-shadow: inset 3px 0 0 var\(--accent\);/s.test(demo), "Accepted demo active thread row must use flat left accent rule");
assert(!/\.thread-row\.active\s*\{[^}]*border-radius/s.test(demo), "Accepted demo active thread row must stay flat, not rounded");

const requiredScreenshots = [
  "docs/qa/app-shell/first-open-1440.png",
  "docs/qa/app-shell/first-open-1024.png",
  "docs/qa/app-shell/first-open-900.png",
];

for (const file of requiredScreenshots) {
  const absolute = path.join(root, file);
  assert(fs.existsSync(absolute), `Missing chrome QA screenshot ${file}`);
  if (fs.existsSync(absolute)) {
    assert(fs.statSync(absolute).size > 1024, `Chrome QA screenshot ${file} looks empty`);
  }
}

if (fail.length > 0) {
  console.error("Chrome contract check failed:");
  for (const message of fail) console.error(`- ${message}`);
  process.exit(1);
}

console.log("chrome contract ok");
