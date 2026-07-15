#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const fail = [];

const assert = (condition, message) => {
  if (!condition) fail.push(message);
};

const appCss = `${read("app/src/App.css")}\n${read("app/src/composerModelPicker.css")}\n${read("app/src/responsive-shell.css")}\n${read("app/src/SearchCommandDialog.css")}`;
const appTsx = read("app/src/App.tsx");
const composerModelPicker = read("app/src/ComposerModelPicker.tsx");
const composerModelPopover = read("app/src/ComposerModelPopover.tsx");
const composerReasoningPicker = read("app/src/ComposerReasoningPicker.tsx");
const searchCommandDialog = read("app/src/SearchCommandDialog.tsx");
const quickOpenSurface = [
  appTsx,
  read("app/src/QuickOpenDialog.tsx"),
  read("app/src/useQuickOpen.ts"),
].join("\n");
const statusBar = read("app/src/StatusBar.tsx");
const mainTsx = read("app/src/main.tsx");
const browserQa = read("app/src/browserQa.ts");
const shellQaScript = read("scripts/capture-app-shell-qa.sh");
const chatThreadSurface = read("app/src/ChatThreadSurface.tsx");
const chatRenderer = [
  chatThreadSurface,
  read("app/src/ChatTurn.tsx"),
  read("app/src/ChatMessageArticle.tsx"),
  read("app/src/AgentActivityTimeline.tsx"),
].join("\n");
const chatConversation = [
  read("app/src/chatConversation.ts"),
  read("app/src/chatConversationTypes.ts"),
  read("app/src/chatConversationNormalization.ts"),
  read("app/src/chatRunEnvelopeReducer.ts"),
].join("\n");
const chatHarness = read("app/src-tauri/src/chat_harness.rs");
const claudeAdapter = read("app/src-tauri/src/claude_adapter.rs");
const agentHooks = read("app/src-tauri/src/agent_hooks.rs");
const toolDockMenu = read("app/src/ToolDockMenu.tsx");
const toolTrayTabs = read("app/src/ToolTrayTabs.tsx");
const icons = read("app/src/icons.tsx");
const settingsModal = read("app/src/SettingsModal.tsx");
const settingsWorkspace = [
  settingsModal,
  read("app/src/SettingsRowControl.tsx"),
  read("app/src/SettingsAgentControls.tsx"),
].join("\n");
const settingsModalData = read("app/src/settingsModalData.ts");
const commandPaletteSources = read("app/src/commandPaletteSources.ts");
const connectionSettings = read("app/src/connectionSettings.ts");
const connectionSettingsPanel = read("app/src/ConnectionSettingsPanel.tsx");
const connectionSecretControls = [
  connectionSettingsPanel,
  read("app/src/ConnectionProviderSettings.tsx"),
  read("app/src/ProjectEnvironmentSettings.tsx"),
  read("app/src/McpServerForm.tsx"),
].join("\n");
const sourceControlLinks = read("app/src/sourceControlLinks.ts");
const connectionSecrets = read("app/src-tauri/src/connection_secrets.rs");
const mcpProbe = read("app/src-tauri/src/mcp_probe.rs");
const mcpOAuth = read("app/src-tauri/src/mcp_oauth.rs");
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
assert(/\.terminal-command,\s*\.terminal-mode\s*\{[^}]*display: none;/s.test(appCss), "Terminal toolbar must hide low-value command/mode text to avoid chrome crowding");
assert(/\.terminal-title\s*\{[^}]*display: none;/s.test(appCss), "Terminal toolbar must not duplicate the selected profile label");
assert(appCss.includes("container-type: inline-size;"), "Browser preview must use container-aware chrome behavior");
assert(/@container \(max-width: 280px\)\s*\{[\s\S]*?\.browser-button--go\s*\{[^}]*display: none;/s.test(appCss), "Narrow browser tray must hide the Open button to prevent toolbar overlap");
assert(appCss.includes(".agent-thread-event"), "App CSS must include thread-style agent event cards");
assert(/Chrome convergence:[\s\S]*?\.agent-composer__card\s*\{[^}]*border-radius:\s*12px;[^}]*background:\s*#1b1c23;/s.test(appCss), "Composer must match the approved 12px demo surface grammar");
assert(appCss.includes("--run-column-width: min(56rem, calc(100% - var(--run-column-pad)));"), "Conversation and composer must share the populated-state reading axis");
assert(appCss.includes(".chat-thread__content"), "Chat output must use the same centered reading axis as the composer");
assert(/\.chat-message--user\s*\{[^}]*width:\s*min\(100%, 46rem\);[^}]*margin-left:\s*auto;[^}]*border:\s*0;[^}]*background:\s*#1a1b22;/s.test(appCss), "User prompts must use surface contrast without a decorative side rule");
assert(!/box-shadow:\s*inset\s+-?\d+px\s+0\s+0/.test(appCss), "App selections must use background contrast instead of decorative side highlights");
assert(!/border-left:\s*\d+px\s+solid\s+(?:#67c3d1|var\(--color-accent-border\))/.test(appCss), "App content must not restore cyan side highlights");
assert(appCss.includes("grid-template-rows: 36px minmax(0, 1fr) 24px;"), "Application chrome must preserve the approved 36px titlebar and 24px status strip");
assert(/\.project-rail__heading\s*\{[^}]*font-size:\s*11px;[^}]*font-weight:\s*600;[^}]*text-transform:\s*uppercase;/s.test(appCss), "Project section labels must preserve the compact uppercase rhythm");
assert(chatThreadSurface.includes('className="chat-thread"'), "Chat surface must render a persistent message timeline");
assert(chatRenderer.includes('className="chat-turn"'), "Chat surface must group each prompt with the provider output that follows it");
assert(chatRenderer.includes('message.role === "user"'), "Chat surface must distinguish user messages from Codex responses");
assert(chatRenderer.includes("agent-thread-event"), "Chat surface must render provenance activity rows");
assert(!chatRenderer.includes("agent-activity-log__title\">Activity"), "Agent events must stay inline instead of becoming a separate Activity dashboard");
assert(chatConversation.includes("providerThreadId"), "Each chat must persist its own provider thread identity");
assert(chatConversation.includes("activeRunId"), "Each chat must own its active run independently");
assert(chatHarness.includes("codex app-server --stdio"), "Structured Codex chat must use the provider-native app-server event stream");
assert(chatHarness.includes('(\"thread/resume\", 2)'), "Structured Codex chat must resume the selected chat's provider thread");
assert(chatConversation.includes('eventType === "item/agentMessage/delta"'), "Structured Codex chat must render provider-native response deltas");
assert(appTsx.includes('route.kind === "chat"'), "Normal composer prompts must route to structured chat, not a pty paste path");
assert(appTsx.includes('invoke<ResolveWorkspaceResponse>("resolve_workspace"'), "Opening a chat must resolve its project without spawning a hidden terminal");
assert(tauriBackend.includes("fn resolve_workspace"), "The backend must expose a no-pty project open path for chat mode");
assert(appTsx.includes('className={`utility-tray ${agentSurfaceMode === "terminal"'), "Raw terminal must live in the approved bottom utility tray");
assert(appTsx.includes('hidden={false}'), "Opening the bottom tray must keep the chat timeline visible");
assert(appTsx.includes('className="agent-composer" aria-label="Agent composer"'), "Opening the bottom tray must keep the chat composer visible");
assert(appTsx.includes('aria-label="Utility tray surfaces"'), "Bottom tray must expose Terminal, Processes, and Logs modes");
assert(appTsx.includes('aria-label={agentSurfaceMode === "terminal" ? "Collapse utility tray" : "Expand utility tray"}'), "Bottom tray chevron must describe its current open or closed action");
assert(appTsx.includes('const toggleUtilityTrayVisibility = () => {'), "Bottom tray chevron must have a layout-only visibility toggle");
assert(appTsx.includes('setAgentSurfaceMode((current) => current === "terminal" ? "chat" : "terminal");'), "Bottom tray chevron must toggle tray visibility without launching a process");
assert(appTsx.includes('onClick={toggleUtilityTrayVisibility}'), "Bottom tray chevron must use the layout-only visibility toggle");
assert(appTsx.includes('name={agentSurfaceMode === "terminal" ? "chevronDown" : "chevronUp"}'), "Bottom tray chevron direction must reflect tray state");
assert(!appTsx.includes('utilityTrayMode === "browser"'), "Browser must not be duplicated in the bottom utility tray");
assert(appTsx.includes("utilityTrayTabContextMenuItems"), "Bottom utility tabs must expose app-owned context menus");
assert(appTsx.includes("terminalPaneContextMenuItems"), "Terminal pane tabs must expose lifecycle context menus");
assert(/\.terminal-pane-button--active\s*\{[^}]*border-bottom-color:\s*var\(--color-accent-border\);[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/s.test(appCss), "Active terminal pane tabs must use a flat underline, not rounded capsule chrome");
assert(appTsx.includes('aria-label="Composer permission mode"'), "Composer must expose the real approval-mode menu");
assert(appTsx.includes('aria-label="Composer goal"'), "Composer must expose its persisted goal control");
assert(composerModelPopover.includes('aria-label="Search models"') && composerModelPopover.includes("Custom model ID"), "Composer must expose searchable provider models and custom model IDs");
assert(composerModelPicker.includes("onSelect={setComposerRuntime}") || appTsx.includes("onSelect={setComposerRuntime}"), "Composer model selection must persist through the runtime boundary");
assert(composerReasoningPicker.includes("OPTIONS.map") && composerReasoningPicker.includes('role="menuitemradio"'), "Composer must expose separate accessible reasoning effort choices");
assert(appTsx.includes('reasoningEffort: activeComposerHarness.reasoningEffort'), "Composer reasoning selection must reach the native chat request");
assert(chatHarness.includes('params["effort"] = json!(effort);'), "Native chat runs must apply the selected Codex reasoning effort");
assert(claudeAdapter.includes('args.extend(["--effort".into(), effort.into()]);'), "Native Claude chat runs must apply the selected reasoning effort");
assert(appTsx.includes("drawerActiveTitle"), "App drawer header must be mode-aware, not a generic Drawer label");
assert(!appTsx.includes("<span>Drawer</span>"), "App drawer header must not render a generic Drawer label");
assert(appTsx.includes("Project chats"), "Projects drawer must present independent chats under each project");
assert(appTsx.includes('aria-label="Agent conversation"'), "Center surface must remain the agent conversation");
assert(!appTsx.includes('className="agent-surface-switcher"'), "The agent header must not duplicate the titlebar chat/terminal toggle");
assert(!appTsx.includes('className="terminal-titlebar"'), "The conversation must not duplicate the active chat title below the native titlebar");
assert((appTsx.match(/<span>\{activeSessionTitle\}<\/span>/g) ?? []).length === 1, "The active chat title must render exactly once in application chrome");
assert(!editorQaFixture.includes("agent-surface-switcher"), "Editor QA fixture must not retain the removed chat/terminal switcher");
assert(!editorQaFixture.includes("agent-chat-terminal-hint"), "Editor QA fixture must not retain duplicate raw-terminal access");
assert(!editorQaFixture.includes("agent-activity-log__filter"), "Editor QA fixture must not retain the removed activity filter toolbar");
assert(!/project-row__state[^>]*>\s*<svg/.test(editorQaFixture), "Editor QA fixture project states must use the production status-dot markup");
assert(workbenchLayout.includes('DEFAULT_WORKBENCH_LAYOUT: WorkbenchLayoutMode = "right"'), "First open must show the demo layout: tray docked right (FIRST-OPEN-LAYOUT, supersedes hidden-first-open)");
assert(workbenchLayout.includes('DEFAULT_TOOL_TRAY_MODE: ToolTrayMode = "files"'), "First tool tray open must default to files");
assert(workbenchLayout.includes("DEFAULT_SIDE_DRAWER_WIDTH = 332"), "Approved desktop thread width must remain 332px");
assert(workbenchLayout.includes("trayPercent: 39"), "Approved desktop dock must open at the 430px-equivalent size");
assert(appCss.includes('grid-template-columns: var(--titlebar-leading-width, var(--side-drawer-width)) 1px minmax(420px, 1fr) 1px var(--dock-width, 430px);'), "Desktop titlebar must align to one-pixel pane boundaries");
assert(appCss.includes('.titlebar-leading-action') && appCss.includes('margin-left: auto;'), "Threads titlebar actions must align to the pane end after the traffic-light drag region");
assert(appCss.includes('.side-drawer-resizer::before') && appCss.includes('inset: 0 4px;'), "Wide splitter hit targets must draw their visible rule on the pane boundary");
assert(appCss.includes('grid-template-columns: minmax(420px, 1fr) 1px var(--dock-width, 430px);'), "Right tool tray must use a one-pixel visual divider");
assert(appCss.includes('grid-template-columns: var(--dock-width, 430px) 1px minmax(420px, 1fr);'), "Left tool tray must use a one-pixel visual divider");
assert(/\.titlebar-workspace\s*\{[^}]*overflow:\s*hidden;[^}]*min-width:\s*0;[^}]*flex:\s*1 1 0;/s.test(appCss), "Workspace crumb must truncate before colliding with branch context");
assert(/\.titlebar-branch\s*\{[^}]*overflow:\s*hidden;[^}]*max-width:\s*30ch;[^}]*text-overflow:\s*ellipsis;/s.test(appCss), "Long branch names must ellipsize at the chrome contract limit");
assert(/\.titlebar-search span\s*\{[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/s.test(appCss), "Titlebar search must stay on one line when adjacent panels are visible");
assert(tauriBackend.includes('format!("@ {sha}")'), "Detached HEAD must show a useful short SHA in the titlebar");
assert(appCss.includes("grid-template-rows: 38px minmax(0, 1fr) 6px var(--utility-tray-height, 42px);"), "Workbench must reserve the approved resizable bottom utility tray");
assert(appTsx.includes('aria-label="Reset interface"'), "Threads header must expose an always-visible interface reset");
assert(appTsx.includes("window.setTimeout(() => setCrashNotice(null), 12_000)"), "Crash recovery feedback must clear without permanently covering the workbench");
assert(appTsx.includes('aria-label="Toggle Threads"'), "Titlebar must expose the approved Threads toggle");
assert((appTsx.match(/aria-label="Toggle Threads"/g) ?? []).length === 1, "Threads must have one visible chrome toggle");
assert(!appTsx.includes('aria-label="Hide Threads"'), "Threads header must not duplicate the titlebar toggle");
assert(appTsx.includes('aria-label="Toggle Tools"'), "Titlebar must expose the approved tool tray toggle");
assert(!appTsx.includes('aria-label="Thread settings"'), "Titlebar must not duplicate the global settings action");
assert(appTsx.includes('aria-label="Open settings and more"'), "Titlebar must keep one global settings and more entry point");
assert(appTsx.includes('aria-label="Toggle Terminal tray"'), "Titlebar must expose the approved bottom terminal tray toggle");
assert(appTsx.includes('onClick={() => void toggleRawTerminal()}'), "Bottom terminal tray toggle must use the existing raw-terminal lifecycle path");
assert(icons.includes("panelBottom: PanelBottom"), "Bottom terminal tray toggle must use the standard PanelBottom icon");
assert(icons.includes("panelLeft: PanelLeft"), "Threads toggle must use the standard PanelLeft icon");
assert(icons.includes("panelRight: PanelRight"), "Tools toggle must use the standard PanelRight icon");
assert(icons.includes("newChat: SquarePen"), "New chat must use the standard compose icon");
assert(icons.includes("terminal: SquareTerminal"), "Terminal surfaces must use the standard terminal icon");
assert(icons.includes("processes: Activity"), "Processes must use the standard activity icon");
assert(icons.includes("agent: Bot"), "Agent activity must use the standard bot icon");
assert(!icons.includes("menu: List") && !icons.includes("layout: PanelsTopLeft"), "Shell toggles must not use ambiguous list or multi-panel glyphs");
assert(/title=\{`\$\{selected && current === tab\.mode \? "Hide" : "Show"\} \$\{tab\.label\} panel`\}/.test(toolTrayTabs), "Right dock must retain persistent tool panel toggles");
assert(appCss.includes("grid-template-columns: repeat(4, minmax(32px, 1fr)) 32px;"), "Narrow tool dock must reserve four stable icon tabs and a fixed close control");
assert(/@media \(max-width: 1120px\)[\s\S]*?\.tool-tray-tabs__tab span,[\s\S]*?\.titlebar-pill span\s*\{\s*display: none;/s.test(appCss), "Narrow chrome must hide dock and runtime labels before they collide");
assert(tauriBackend.includes('app.get_webview_window("main")'), "Main window must have an explicit startup recovery path");
assert(appCss.includes(".workbench.workbench--drawer-hidden .files-dock"), "Hidden tools must not leave an implicit narrow column");
assert(toolTrayTabs.includes("current === next ? null : next"), "Clicking the active dock tab must close that panel");
assert(toolTrayTabs.includes("new ResizeObserver"), "Tool tray labels must react to the rendered split-view width");
assert(toolTrayTabs.includes('if (width < 480) return "icons";'), "The narrowest tool tray must collapse to icon-only controls before labels collide");
assert(toolTrayTabs.includes('if (width < 720) return "compact";'), "Medium tool trays must keep only the active label before the full tab strip can collide");
assert(appTsx.includes("workbench--tools-${toolTrayMode}"), "Workbench must render the active tool tray mode class");
assert(appTsx.includes("toolTrayMode === \"split\" ? ("), "Editor/browser splitter must render only in split tray mode");
assert(toolDockMenu.includes("Hide tools"), "Tool dock menu must expose a direct way to return to the agent-only layout");
assert(toolDockMenu.includes('aria-label="Tools and dock position"'), "Tool dock controls must use one compact, labelled menu");
assert(appTsx.includes("commandPaletteOpen"), "App chrome must expose a command palette state");
assert(appTsx.includes("shortcutKeys(\"chrome.command-palette\")"), "Command palette must show its shortcut label");
assert(appTsx.includes('<div className="titlebar-identity"') && appTsx.includes('title="New chat"') && appTsx.includes('title="Search tasks or run a command"') && appTsx.includes('title="Reset interface"'), "Thread actions must share the native titlebar lane with the traffic lights");
assert(!appTsx.includes('className="drawer-collapse-button"'), "The Threads section header must not duplicate titlebar actions");
assert(appTsx.includes("filterCommandPaletteCommands(commandPaletteCommands, commandPaletteQuery, commandPaletteSources)"), "Command palette source settings must filter live results");
assert(appTsx.includes('source: "chats"') && appTsx.includes('source: "files"') && appTsx.includes('source: "tabs"') && appTsx.includes('source: "worktrees"'), "Command palette must include real chat, file, tab, and worktree sources");
assert(commandPaletteSources.includes('COMMAND_PALETTE_SOURCE_IDS = ["chats", "commands", "files", "tabs", "worktrees"]'), "Command palette sources must use the persisted typed source contract");
assert(searchCommandDialog.includes('placeholder="Search tasks or run a command"'), "Search must use the centered task and command palette");
assert(searchCommandDialog.includes('label="Tasks"') && searchCommandDialog.includes('label="Actions"'), "Centered search must separate tasks from actions");
assert(appTsx.includes('command.source === "chats").slice(0, 6)') && appTsx.includes('command.source !== "chats").slice(0, 6)'), "Centered search must keep both tasks and actions visible before a query");
assert(!appTsx.includes('sideDrawerMode === "search"'), "Search must not render as a duplicate side drawer");
assert(!appCss.includes(".search-scope-tabs"), "Removed search drawer tabs must not leave capsule styling behind");
assert(settingsWorkspace.includes("onCommandPaletteSourceChange") && settingsWorkspace.includes("Toggle ${source.label} command palette source"), "Settings must expose functional command-palette source controls");
assert(settingsModalData.includes('id: "agents.worktree-policy"') && settingsModalData.includes('id: "agents.hook-policy"') && settingsModalData.includes('id: "agents.environment-policy"'), "Settings must expose truthful worktree, lifecycle-hook, and environment policy rows");
assert(settingsWorkspace.includes("Unavailable until AI-CONNECTIONS environment profiles") && settingsWorkspace.includes("Credential values are never displayed"), "Environment settings must state the current inheritance and secret-display boundary without presenting an unavailable control");
assert(settingsModalData.includes('id: "connections.manage"') && settingsModalData.includes('label: "Connections"'), "Settings must expose the dedicated AI and MCP Connections workspace");
assert(connectionSettings.includes("environmentByProject") && connectionSettings.includes("mcpServers") && connectionSettings.includes("providerModels"), "Connection settings must use typed provider, environment, and MCP records");
assert(connectionSecretControls.includes('type="password"') && connectionSecretControls.includes("onSaveSecret"), "Connection secret controls must use the Keychain callback boundary");
assert(connectionSettings.includes("connectionEnvironmentInputs") && appTsx.includes("environment: connectionEnvironmentInputs(aiConnectionSettingsRef.current"), "All new chat and terminal runs must carry project environment references without renderer-side secret values");
assert(connectionSecrets.includes("resolve_connection_environment") && connectionSecrets.includes('provider:codex:api-key') && connectionSecrets.includes('OPENAI_API_KEY'), "Rust must resolve project and provider credentials only at the process boundary");
assert(mcpProbe.includes('"initialize"') && mcpProbe.includes('"tools/list"') && mcpProbe.includes("spawn_blocking") && mcpProbe.includes("read_connection_secret"), "MCP health must execute a bounded backend protocol probe with Keychain auth");
assert(connectionSecrets.includes('KEYCHAIN_SERVICE') && connectionSecrets.includes('keyring::Entry::new') && connectionSecrets.includes('.set_password(value)') && !connectionSecrets.includes('Command::new("/usr/bin/security")'), "Connection secrets must use the native Keychain API without putting values in process arguments");
assert(mcpOAuth.includes('code_challenge_method", "S256"') && mcpOAuth.includes('("resource", prepared.resource.clone())') && mcpOAuth.includes('write_connection_secret(&token_key(server_id)') && mcpOAuth.includes('refresh_tokens_request') && mcpOAuth.includes('revoke_tokens'), "MCP OAuth must preserve PKCE, resource binding, Keychain token storage, refresh, and revocation");
assert(agentHooks.includes('TcpListener::bind("127.0.0.1:0")') && agentHooks.includes('format!("Bearer {token}")') && agentHooks.includes('fs::Permissions::from_mode(0o600)'), "Agent hooks must stay loopback-only with a private ephemeral bearer configuration");
assert(agentHooks.includes('"list_projects"') && agentHooks.includes('"get_workspace_state"') && agentHooks.includes('"focus_pane"') && agentHooks.includes('"open_file"') && agentHooks.includes('"create_shell"') && agentHooks.includes('"report_status"'), "Agent-hook MCP must expose the documented minimal tool catalog");
assert(appTsx.includes('invoke<AgentHookRequest[]>("take_agent_hook_requests")') && appTsx.includes('focusTerminalPane(paneId, "agent")') && appTsx.includes('createTerminalPane(defaultTerminalLaunchProfile(), "agent")') && appTsx.includes('"agent",\n          );'), "Agent-hook actions must enter the renderer through the attributed app-action path");
assert(statusBar.includes('className="status-bar__item status-bar__item--button"') && appTsx.includes("sourceRepoStatusLabel(repoLocation)"), "Active source-host status must be visible outside Settings");
assert(sourceControlLinks.includes('isGitLabLocation(location) ? `${repoBaseUrl(location)}/-/merge_requests`') && sourceControlLinks.includes('isGitLabLocation(location) ? `${repoBaseUrl(location)}/-/pipelines`'), "Self-hosted non-GitHub remotes must use GitLab merge-request and pipeline routes");
assert(appTsx.includes('storeRef.current?.set("aiConnectionSettings", next)') && !appTsx.includes('storeRef.current?.set("connectionSecret'), "Tauri Store may persist non-secret connection metadata but never secret values");
assert(appTsx.includes("aiConnectionSettings.providerModels[provider].trim()"), "Provider model defaults must reach structured chat runs");
assert(appTsx.includes('invoke("delete_connection_secret", { key })'), "Full local reset must remove known Keychain connection secrets before clearing metadata");
assert(/\.settings-workspace__policy small\s*\{[^}]*overflow-wrap:\s*anywhere;[^}]*white-space:\s*normal;/s.test(appCss), "Policy values must wrap instead of truncating important safety text");
assert(appCss.includes(".command-palette"), "App CSS must style the command palette surface");
assert(appCss.includes(".command-palette__row--active"), "Command palette must have a visible active row state");
assert(
  quickOpenSurface.includes('aria-label="Quick open files"')
    && quickOpenSurface.includes('shortcutKeys("workspace.quick-open")')
    && quickOpenSurface.includes("openDialog"),
  "App chrome must expose a Cmd+P quick-open surface",
);
assert(editorQaFixture.includes("Project threads drawer"), "Editor QA fixture must reflect the approved project-thread drawer");
assert(editorQaFixture.includes("<span>Threads</span>"), "Editor QA fixture must use the approved Threads drawer title");
assert(!editorQaFixture.includes("Project sessions"), "Editor QA fixture must not present workspace sessions as the chat product noun");
assert(editorQaFixture.includes('class="chat-thread"'), "Editor QA fixture must render the structured chat timeline");
assert(editorQaFixture.includes("chat-message--user") && editorQaFixture.includes("chat-message--assistant"), "Editor QA fixture must show populated user and assistant chat messages");
assert(editorQaFixture.includes("agent-composer__menu--permission") && editorQaFixture.includes("agent-composer__menu--runtime"), "Editor QA fixture must show the functional composer control grammar");
assert(!editorQaFixture.includes('class="agent-activity"'), "Editor QA fixture must not restore the superseded separate activity strip");
assert(!editorQaFixture.includes(">Drawer<"), "Editor QA fixture must not show a generic Drawer label");
assert(editorQaFixture.includes("workbench--tools-editor"), "Editor QA fixture must include the current single-editor tray mode");
assert(editorQaFixture.includes("tool-tray-switcher"), "Editor QA fixture must render tool tray tabs");
assert(/\.workbench--tools-editor \.browser-preview,\s*\.workbench--tools-browser \.editor-area\s*\{[^}]*display: none;/s.test(appCss), "Single tool tray modes must hide the unused editor/browser tray");
assert(/\.tool-tray-switcher__button--active\s*\{[^}]*box-shadow: inset 0 -2px 0 var\(--color-accent-border\);/s.test(appCss), "Tool tray active state must use a flat underline accent");
assert(appCss.includes("container-name: tool-tabs;"), "Tool tray tabs must own a container for narrow-dock behavior");
assert(/@container tool-tabs \(max-width: 720px\)\s*\{[\s\S]*?\.tool-tray-tabs__tab span\s*\{[^}]*display: none;[\s\S]*?\.tool-tray-tabs__tab--active span\s*\{[^}]*display: block;/s.test(appCss), "Medium tool trays must collapse inactive labels before tabs overlap");
assert(/@container tool-tabs \(max-width: 480px\)\s*\{[\s\S]*?\.tool-tray-tabs__tab--active span\s*\{[^}]*display: none;/s.test(appCss), "Minimum-width tool trays must collapse every label");
assert(mainTsx.includes('new URLSearchParams(window.location.search).get("qa") === "1"'), "App entrypoint must expose the explicit browser-QA bootstrap");
assert(browserQa.includes('mockIPC(createBrowserQaIpcHandler(), { shouldMockEvents: true })'), "Browser QA must use the official Tauri mock boundary");
assert(shellQaScript.includes('"http://localhost:$port/?qa=1"'), "App-shell capture must request the deterministic browser-QA fixture");
assert(!shellQaScript.includes("--channel chrome"), "App-shell capture must use bundled headless Chromium instead of GUI-only Chrome");
assert(/@media \(max-width: 920px\)\s*\{[\s\S]*?\.settings-workspace__mobile-label,\s*\.settings-workspace__category-select\s*\{[^}]*display: block;/s.test(appCss), "Settings compact navigation must activate within the native 900px minimum width");
assert(demo.includes("--accent: #67c3d1;"), "Accepted chrome demo must use steel-cyan #67c3d1");
assert(demo.includes("--accent-strong: #9bd9e3;"), "Accepted chrome demo must use steel-cyan strong #9bd9e3");
assert(demo.includes("--accent-soft: #162c33;"), "Accepted chrome demo must use steel-cyan soft #162c33");
assert(/\.thread-row\.active\s*\{[^}]*background:\s*#252732;[^}]*color:\s*var\(--ink\);/s.test(demo), "Accepted demo active thread row must use quiet background contrast");
assert(!/box-shadow:\s*inset\s+-?\d+px\s+0\s+0/.test(demo), "Accepted demo must not restore decorative side highlights");
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
  "docs/qa/editor-parity/composer-permission.png",
  "docs/qa/editor-parity/composer-goal.png",
  "docs/qa/editor-parity/composer-runtime.png",
  "docs/qa/chrome-demo/palette.png",
  "docs/qa/chrome-v2/native-desktop.png",
  "docs/qa/chrome-v2/native-900.png",
  "docs/qa/chrome-v2/native-composer-permission.png",
  "docs/qa/chrome-v2/native-composer-runtime.png",
];

const pngDimensions = (absolute) => {
  const data = fs.readFileSync(absolute);
  const signature = "89504e470d0a1a0a";
  if (data.length < 24 || data.subarray(0, 8).toString("hex") !== signature) return null;
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
};

const exactScreenshotDimensions = new Map([
  ["docs/qa/app-shell/first-open-1440.png", { width: 1440, height: 900 }],
  ["docs/qa/app-shell/first-open-1024.png", { width: 1024, height: 640 }],
  ["docs/qa/app-shell/first-open-900.png", { width: 900, height: 640 }],
]);

for (const file of requiredScreenshots) {
  const absolute = path.join(root, file);
  assert(fs.existsSync(absolute), `Missing chrome QA screenshot ${file}`);
  if (fs.existsSync(absolute)) {
    assert(fs.statSync(absolute).size > 1024, `Chrome QA screenshot ${file} looks empty`);
    const dimensions = pngDimensions(absolute);
    assert(dimensions != null, `Chrome QA screenshot ${file} must be a real PNG`);
    const expected = exactScreenshotDimensions.get(file);
    if (dimensions && expected) {
      assert(
        dimensions.width === expected.width && dimensions.height === expected.height,
        `Chrome QA screenshot ${file} must be ${expected.width}x${expected.height}, got ${dimensions.width}x${dimensions.height}`,
      );
    }
  }
}

const nativeDesktop = pngDimensions(path.join(root, "docs/qa/chrome-v2/native-desktop.png"));
const nativeNarrow = pngDimensions(path.join(root, "docs/qa/chrome-v2/native-900.png"));
assert(nativeDesktop && nativeDesktop.width >= 1200 && nativeDesktop.height >= 700, "Packaged desktop chrome proof must be at least 1200x700");
assert(nativeNarrow && nativeNarrow.width >= 900 && nativeNarrow.width <= 930, "Packaged narrow chrome proof must be captured at the 900px minimum window");
assert(nativeNarrow && nativeNarrow.height >= 640 && nativeNarrow.height <= 670, "Packaged narrow chrome proof must be captured near the 640px minimum height");

if (fail.length > 0) {
  console.error("Chrome contract check failed:");
  for (const message of fail) console.error(`- ${message}`);
  process.exit(1);
}

console.log("chrome contract ok");
