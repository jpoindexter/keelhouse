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
const editorQaFixture = read("docs/qa/editor-parity.html");
const demo = read("demo/keelhouse-chrome-demo.html");

const rejectedWarmAccent = /#e07a4f|#251b16|#d9a079|var\(--orange\)|orange accent|warm accent dominance/i;
const checkedText = [
  ["app/src/App.css", appCss],
  ["app/src/App.tsx", appTsx],
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
assert(appTsx.includes("agent-thread-event"), "App surface must render thread-style agent event cards");
assert(appTsx.includes("agent-activity-log__title\">Thread"), "Agent activity surface must label the center feed as Thread");
assert(appTsx.includes("drawerActiveTitle"), "App drawer header must be mode-aware, not a generic Drawer label");
assert(!appTsx.includes("<span>Drawer</span>"), "App drawer header must not render a generic Drawer label");
assert(appTsx.includes("Project threads"), "Projects drawer must present project sessions as threads");
assert(appTsx.includes("Agent thread and raw terminal"), "Agent surface must be labelled as a thread with raw terminal as escape hatch");
assert(appTsx.includes("<span className=\"terminal-kicker\">Thread</span>"), "Agent pane kicker must say Thread, not Agent terminal");
assert(appTsx.includes("TOOL_TRAY_MODE_STORAGE_KEY"), "Tool tray tab mode must persist locally");
assert(appTsx.includes("workbench--tools-${toolTrayMode}"), "Workbench must render the active tool tray mode class");
assert(appTsx.includes("toolTrayMode === \"split\" ? ("), "Editor/browser splitter must render only in split tray mode");
assert(appTsx.includes("tool-tray-switcher"), "App chrome must expose compact tool tray tabs");
assert(appTsx.includes("commandPaletteOpen"), "App chrome must expose a command palette state");
assert(appTsx.includes("shortcutKeys(\"chrome.command-palette\")"), "Command palette must show its shortcut label");
assert(appCss.includes(".command-palette"), "App CSS must style the command palette surface");
assert(appCss.includes(".command-palette__row--active"), "Command palette must have a visible active row state");
assert(editorQaFixture.includes("Project threads drawer"), "Editor QA fixture must reflect the project-thread drawer");
assert(!editorQaFixture.includes(">Drawer<"), "Editor QA fixture must not show a generic Drawer label");
assert(editorQaFixture.includes("Agent thread and raw terminal"), "Editor QA fixture must reflect the agent-thread surface label");
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
  "docs/qa/chrome-demo/first-open.png",
  "docs/qa/chrome-demo/create-menu.png",
  "docs/qa/chrome-demo/settings.png",
  "docs/qa/chrome-demo/palette.png",
  "docs/qa/chrome-demo/narrow.png",
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
