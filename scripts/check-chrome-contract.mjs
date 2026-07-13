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
const mainTsx = read("app/src/main.tsx");
const chatThreadSurface = read("app/src/ChatThreadSurface.tsx");
const chatConversation = read("app/src/chatConversation.ts");
const chatHarness = read("app/src-tauri/src/chat_harness.rs");
const toolDockMenu = read("app/src/ToolDockMenu.tsx");
const toolTrayTabs = read("app/src/ToolTrayTabs.tsx");
const workbenchLayout = read("app/src/workbenchLayout.ts");
const tauriBackend = read("app/src-tauri/src/lib.rs");
const editorQaFixture = read("docs/qa/editor-parity.html");
const demo = read("demo/keelhouse-chrome-demo.html");

const parseCssRules = (css) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
  selectors: match[1],
  declarations: match[2],
}));
const boxedToolbarClasses = [
  ".titlebar-action",
  ".drawer-collapse-button",
  ".rail-open-button",
  ".terminal-tab-action",
  ".terminal-new-pane",
  ".editor-command",
  ".editor-save",
  ".browser-button",
  ".agent-composer__button",
];
const findBoxedToolbarClasses = (css) => {
  const rules = parseCssRules(css);
  return boxedToolbarClasses.filter((selector) => rules.some((rule) =>
    rule.selectors.includes(selector)
      && /background:\s*var\(--control-bg\)|border:\s*1px solid var\(--control-border\)/.test(rule.declarations)
  ));
};

const rejectedWarmAccent = /#e07a4f|#251b16|#d9a079|var\(--orange\)|orange accent|warm accent dominance/i;
const checkedText = [
  ["app/src/App.css", appCss],
  ["app/src/App.tsx", appTsx],
  ["app/src/ChatThreadSurface.tsx", chatThreadSurface],
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
for (const selector of findBoxedToolbarClasses(appCss)) {
  assert(false, `${selector} must not use boxed default-control chrome`);
}
const mutationSentinel = findBoxedToolbarClasses(".titlebar-action { background: var(--control-bg); }");
assert(mutationSentinel.includes(".titlebar-action"), "Chrome gate mutation sentinel must detect reintroduced boxed toolbar chrome");
assert(appCss.includes('--font-ui: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;'), "App CSS must preserve the approved Inter UI stack and system fallbacks");
for (const weight of [400, 500, 600, 700, 800]) {
  assert(mainTsx.includes(`@fontsource/inter/latin-${weight}.css`), `App entrypoint must bundle the approved Inter Latin ${weight} weight`);
}
assert(/\.layout-switcher\s*\{[^}]*border: 0;[^}]*background: transparent;/s.test(appCss), "Layout switcher must not render an enclosing segmented-control box");
assert(/\.layout-switcher__button--active\s*\{[^}]*box-shadow: inset 0 -2px 0 var\(--color-accent-border\);/s.test(appCss), "Layout active state must use a flat underline accent");
assert(/\.terminal-pane-button--active\s*\{[^}]*box-shadow: inset 0 -2px 0 var\(--color-accent-border\);/s.test(appCss), "Pane active state must use a flat underline accent");
assert(/\.terminal-command,\s*\.terminal-mode\s*\{[^}]*display: none;/s.test(appCss), "Terminal toolbar must hide low-value command/mode text to avoid chrome crowding");
assert(/\.terminal-title\s*\{[^}]*display: none;/s.test(appCss), "Terminal toolbar must not duplicate the selected profile label");
assert(appCss.includes("container-type: inline-size;"), "Browser preview must use container-aware chrome behavior");
assert(/@container \(max-width: 280px\)\s*\{[\s\S]*?\.browser-button--go\s*\{[^}]*display: none;/s.test(appCss), "Narrow browser tray must hide the Open button to prevent toolbar overlap");
assert(appCss.includes(".agent-thread-event"), "App CSS must include thread-style agent event cards");
assert(/\.agent-composer__card\s*\{[^}]*border:\s*1px solid #343642;[^}]*border-radius:\s*12px;[^}]*background:\s*#1b1c23;/s.test(appCss), "Composer must preserve the approved elevated-card grammar");
assert(appCss.includes("--run-column-width: calc(100% - var(--run-column-pad));"), "Run and composer surfaces must share the centered column width token");
assert(/\.project-rail__heading\s*\{[^}]*font-size:\s*11px;[^}]*font-weight:\s*600;[^}]*text-transform:\s*uppercase;/s.test(appCss), "Project section labels must preserve the compact uppercase rhythm");
assert(chatThreadSurface.includes('className="chat-thread"'), "Chat surface must render a persistent message timeline");
assert(chatThreadSurface.includes('message.role === "user"'), "Chat surface must distinguish user messages from Codex responses");
assert(chatThreadSurface.includes("agent-thread-event"), "Chat surface must render provenance activity rows");
assert(!chatThreadSurface.includes("agent-activity-log__title\">Activity"), "Agent events must stay inline instead of becoming a separate Activity dashboard");
assert(chatConversation.includes("providerThreadId"), "Each chat must persist its own provider thread identity");
assert(chatConversation.includes("activeRunId"), "Each chat must own its active run independently");
assert(chatHarness.includes("codex exec --json"), "Structured Codex chat must use JSON events instead of terminal transcript scraping");
assert(chatHarness.includes("codex exec resume --json"), "Structured Codex chat must resume the selected chat's provider thread");
assert(appTsx.includes('route.kind === "chat"'), "Normal composer prompts must route to structured chat, not a pty paste path");
assert(appTsx.includes('invoke<ResolveWorkspaceResponse>("resolve_workspace"'), "Opening a chat must resolve its project without spawning a hidden terminal");
assert(tauriBackend.includes("fn resolve_workspace"), "The backend must expose a no-pty project open path for chat mode");
assert(!appTsx.includes('className="terminal-tray"'), "Agent chat and raw terminal must not be duplicated as a persistent bottom tray");
assert(appTsx.includes('title={agentSurfaceMode === "terminal" ? "Return to agent chat" : "Open raw terminal"}'), "Titlebar terminal icon must clearly switch between agent chat and the raw terminal");
assert(appTsx.includes('aria-label="Agent composer" hidden={agentSurfaceMode !== "chat"}'), "Raw terminal mode must hide the agent composer instead of stacking chat controls over the TUI");
assert(appTsx.includes("drawerActiveTitle"), "App drawer header must be mode-aware, not a generic Drawer label");
assert(!appTsx.includes("<span>Drawer</span>"), "App drawer header must not render a generic Drawer label");
assert(appTsx.includes("Project chats"), "Projects drawer must present independent chats under each project");
assert(appTsx.includes("Agent conversation with optional raw terminal"), "Agent surface must label raw terminal as an optional alternate view");
assert(!appTsx.includes('className="agent-surface-switcher"'), "The agent header must not duplicate the titlebar chat/terminal toggle");
assert(!editorQaFixture.includes("agent-surface-switcher"), "Editor QA fixture must not retain the removed chat/terminal switcher");
assert(!editorQaFixture.includes("agent-chat-terminal-hint"), "Editor QA fixture must not retain duplicate raw-terminal access");
assert(!editorQaFixture.includes("agent-activity-log__filter"), "Editor QA fixture must not retain the removed activity filter toolbar");
assert(!/project-row__state[^>]*>\s*<svg/.test(editorQaFixture), "Editor QA fixture project states must use the production status-dot markup");
assert(workbenchLayout.includes('DEFAULT_WORKBENCH_LAYOUT: WorkbenchLayoutMode = "right"'), "First open must show the demo layout: tray docked right (FIRST-OPEN-LAYOUT, supersedes hidden-first-open)");
assert(workbenchLayout.includes('DEFAULT_TOOL_TRAY_MODE: ToolTrayMode = "files"'), "First tool tray open must default to files");
assert(workbenchLayout.includes("DEFAULT_SIDE_DRAWER_WIDTH = 332"), "Approved desktop thread width must remain 332px");
assert(workbenchLayout.includes("trayPercent: 39"), "Approved desktop dock must open at the 430px-equivalent size");
assert(appCss.includes('grid-template-columns: var(--side-drawer-width) 6px minmax(420px, 1fr) 6px var(--dock-width, 430px);'), "Desktop shell must preserve the approved 332/6/center/6/430 geometry");
assert(/\.titlebar-workspace\s*\{[^}]*overflow:\s*hidden;[^}]*min-width:\s*0;[^}]*flex:\s*1 1 0;/s.test(appCss), "Workspace crumb must truncate before colliding with branch context");
assert(/\.titlebar-branch\s*\{[^}]*overflow:\s*hidden;[^}]*max-width:\s*30ch;[^}]*text-overflow:\s*ellipsis;/s.test(appCss), "Long branch names must ellipsize at the chrome contract limit");
assert(tauriBackend.includes('format!("@ {sha}")'), "Detached HEAD must show a useful short SHA in the titlebar");
assert(appCss.includes("grid-template-rows: 38px minmax(0, 1fr);"), "Workbench must use the full height without a duplicate terminal tray row");
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
assert(editorQaFixture.includes("Project chats drawer"), "Editor QA fixture must reflect the project-chat drawer");
assert(!editorQaFixture.includes(">Drawer<"), "Editor QA fixture must not show a generic Drawer label");
assert(editorQaFixture.includes("workbench--tools-editor"), "Editor QA fixture must include the current single-editor tray mode");
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
  "docs/qa/chrome-delta/demo-reference-1440.png",
  "docs/qa/chrome-delta/demo-reference-1024.png",
  "docs/qa/chrome-delta/demo-reference-900.png",
  "docs/qa/chrome-delta/density-populated-1440.png",
  "docs/qa/chrome-delta/density-populated-1024.png",
  "docs/qa/chrome-delta/density-populated-900.png",
  "docs/qa/editor-parity/context-menu.png",
  "docs/qa/editor-parity/chrome-states.png",
  "docs/qa/chrome-demo/palette.png",
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
