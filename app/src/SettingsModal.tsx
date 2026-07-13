import { useEffect, useRef, useState } from "react";

import { AppIcon } from "./icons";
import type { AgentApprovalMode } from "./agentSessionHandle";
import {
  formatAgentConnectionCapability,
  formatAgentConnectionHealth,
  type AgentConnectionsStatus,
} from "./agentConnections";
import { formatCliToolStatus, type SourceControlStatus } from "./sourceControl";
import { buildIssuesUrl, buildPipelinesUrl, buildPullRequestsUrl, buildRepoUrl, type RepoLocation } from "./sourceControlLinks";
import type { ToolTrayMode, WorkbenchLayoutMode } from "./workbenchLayout";
import type { ScopedSettingView, SettingsScope } from "./scopedSettings";
import type { LaunchProfile } from "./launchProfiles";
import { ConnectionSettingsPanel } from "./ConnectionSettingsPanel";
import {
  DEFAULT_AI_CONNECTION_SETTINGS,
  type AiConnectionSettings,
  type ConnectionTargetStatus,
  type McpOAuthStart,
  type McpOAuthStatus,
  type McpServerConfig,
} from "./connectionSettings";
import {
  COMMAND_PALETTE_SOURCE_OPTIONS,
  DEFAULT_COMMAND_PALETTE_SOURCES,
  type CommandPaletteSourceId,
  type CommandPaletteSourceSettings,
} from "./commandPaletteSources";
import {
  filterSettingsRows,
  IGNORED_FOLDERS,
  SETTINGS_CATEGORIES,
  SETTINGS_CATEGORY_GROUPS,
  SETTINGS_ROWS,
  settingsRowsForCategory,
  type SettingsCategoryId,
  type SettingsRowDef,
} from "./settingsModalData";
import {
  eventToCombo,
  findKeybindingConflicts,
  resolveShortcutKeys,
  SHORTCUTS,
  type KeybindingOverrides,
} from "./shortcuts";

type SettingsProfileOption = { id: string; label: string; disabled?: boolean };
type AgentHookStatus = { endpoint: string; configPath: string; running: boolean };

type SettingsModalProps = {
  approvalSetting: ScopedSettingView<AgentApprovalMode>;
  agentConnectionsStatus?: AgentConnectionsStatus | null;
  agentConnectionsRefreshing?: boolean;
  agentHookStatus?: AgentHookStatus | null;
  browserSetting: ScopedSettingView<string>;
  aiConnectionSettings?: AiConnectionSettings;
  connectionSecretPresence?: Record<string, boolean>;
  mcpOAuthStatuses?: Record<string, McpOAuthStatus>;
  commandPaletteSources?: CommandPaletteSourceSettings;
  customTerminalProfiles?: LaunchProfile[];
  gitBranch: string | null;
  gitChangeCount: number | null;
  initialCategory?: SettingsCategoryId;
  initialQuery?: string;
  keybindingOverrides?: KeybindingOverrides;
  layout: WorkbenchLayoutMode;
  notificationsEnabled?: boolean;
  sourceControlStatus?: SourceControlStatus | null;
  repoLocation?: RepoLocation | null;
  onOpenSourceControlLink?: (url: string) => void;
  theme?: "graphite" | "mono-ghost";
  profileSetting: ScopedSettingView<string>;
  profiles: SettingsProfileOption[];
  trayMode: ToolTrayMode;
  sessionTitle?: string;
  workspaceName?: string;
  workspacePath?: string;
  onApprovalModeChange: (scope: SettingsScope, mode: AgentApprovalMode) => void;
  onRefreshAgentConnections?: () => void;
  onBrowserUrlCommit: (scope: SettingsScope, url: string) => void;
  onAiConnectionSettingsChange?: (settings: AiConnectionSettings) => void;
  onDeleteConnectionSecret?: (key: string) => Promise<void>;
  onSaveConnectionSecret?: (key: string, value: string) => Promise<void>;
  onValidateConnectionTarget?: (server: McpServerConfig) => Promise<ConnectionTargetStatus>;
  onBeginMcpOAuth?: (server: McpServerConfig) => Promise<McpOAuthStart>;
  onDisconnectMcpOAuth?: (server: McpServerConfig) => Promise<McpOAuthStatus>;
  onCommandPaletteSourceChange?: (source: CommandPaletteSourceId, enabled: boolean) => void;
  onAddCustomTerminalProfile?: (label: string, command: string) => void;
  onClose: () => void;
  onKeybindingOverrideChange?: (id: string, keys: string[] | null) => void;
  onNotificationsChange?: (enabled: boolean) => void;
  onRemoveCustomTerminalProfile?: (profileId: string) => void;
  onResetLocalData?: () => void;
  onThemeChange?: (theme: "graphite" | "mono-ghost") => void;
  onLayoutChange: (layout: WorkbenchLayoutMode) => void;
  onProfileChange: (scope: SettingsScope, profileId: string) => void;
  onScopedSettingReset: (rowId: "agents.profile" | "agents.permission" | "browser.url", scope: Exclude<SettingsScope, "global">) => void;
  onResetLayout: () => void;
  onTrayModeChange: (mode: ToolTrayMode) => void;
};

export function SettingsModal({
  approvalSetting,
  agentConnectionsStatus = null,
  agentConnectionsRefreshing = false,
  agentHookStatus = null,
  browserSetting,
  aiConnectionSettings = DEFAULT_AI_CONNECTION_SETTINGS,
  connectionSecretPresence = {},
  mcpOAuthStatuses = {},
  commandPaletteSources = DEFAULT_COMMAND_PALETTE_SOURCES,
  customTerminalProfiles = [],
  gitBranch,
  gitChangeCount,
  initialCategory = "general",
  initialQuery = "",
  keybindingOverrides = {},
  layout,
  notificationsEnabled = false,
  sourceControlStatus = null,
  repoLocation = null,
  onOpenSourceControlLink,
  theme = "graphite",
  profileSetting,
  profiles,
  trayMode,
  sessionTitle = "Current chat",
  workspaceName = "Current project",
  workspacePath = "",
  onApprovalModeChange,
  onRefreshAgentConnections,
  onBrowserUrlCommit,
  onAiConnectionSettingsChange,
  onDeleteConnectionSecret,
  onSaveConnectionSecret,
  onValidateConnectionTarget,
  onBeginMcpOAuth,
  onDisconnectMcpOAuth,
  onCommandPaletteSourceChange,
  onAddCustomTerminalProfile,
  onClose,
  onKeybindingOverrideChange,
  onLayoutChange,
  onNotificationsChange,
  onRemoveCustomTerminalProfile,
  onResetLocalData,
  onThemeChange,
  onProfileChange,
  onScopedSettingReset,
  onResetLayout,
  onTrayModeChange,
}: SettingsModalProps) {
  const [category, setCategory] = useState<SettingsCategoryId>(initialCategory);
  const [query, setQuery] = useState(initialQuery);
  const [scopeByRow, setScopeByRow] = useState<Partial<Record<string, SettingsScope>>>({});
  const [browserDraft, setBrowserDraft] = useState(browserSetting.chat?.value ?? browserSetting.project?.value ?? browserSetting.global.value);
  const [capturingId, setCapturingId] = useState<string | null>(null);
  const [customProfileLabel, setCustomProfileLabel] = useState("");
  const [customProfileCommand, setCustomProfileCommand] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const conflicts = findKeybindingConflicts();

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const searching = query.trim().length > 0;
  const visibleRows = searching
    ? filterSettingsRows(SETTINGS_ROWS, query)
    : settingsRowsForCategory(SETTINGS_ROWS, category);

  const selectedScope = (row: SettingsRowDef): SettingsScope => scopeByRow[row.id] ?? row.scope;
  const resolutionAt = <T,>(view: ScopedSettingView<T>, scope: SettingsScope) => view[scope] ?? view.global;
  const browserResolution = resolutionAt(browserSetting, selectedScope(SETTINGS_ROWS.find((row) => row.id === "browser.url")!));

  useEffect(() => {
    setBrowserDraft(browserResolution.value);
  }, [browserResolution.value, scopeByRow["browser.url"]]);

  const commitBrowserUrl = () => {
    const next = browserDraft.trim();
    if (next && next !== browserResolution.value) onBrowserUrlCommit(selectedScope(SETTINGS_ROWS.find((row) => row.id === "browser.url")!), next);
  };

  const control = (row: SettingsRowDef) => {
    if (row.id === "agents.profile") {
      const scope = selectedScope(row);
      const profileId = resolutionAt(profileSetting, scope).value;
      return (
        <select
          className="settings-modal__select"
          aria-label="Default agent profile"
          value={profileId}
          onChange={(event) => onProfileChange(scope, event.currentTarget.value)}
        >
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id} disabled={profile.disabled}>{profile.label}</option>
          ))}
        </select>
      );
    }
    if (row.id === "agents.permission") {
      const scope = selectedScope(row);
      const approvalMode = resolutionAt(approvalSetting, scope).value;
      return (
        <select
          className="settings-modal__select"
          aria-label="Permission mode"
          value={approvalMode}
          onChange={(event) => onApprovalModeChange(scope, event.currentTarget.value as AgentApprovalMode)}
        >
          <option value="ask">Ask</option>
          <option value="approveSafe">Approve safe</option>
          <option value="fullAccess">Full access</option>
        </select>
      );
    }
    if (row.id === "agents.connections") {
      return (
        <div className="settings-workspace__provider-list" aria-label="Provider connection health">
          {agentConnectionsStatus?.providers.map((provider) => (
            <div className="settings-workspace__provider" key={provider.id}>
              <div>
                <strong>{provider.label}</strong>
                <small>{provider.version ?? "Version unavailable"}</small>
              </div>
              <span>{formatAgentConnectionHealth(provider)}</span>
              <span>{formatAgentConnectionCapability(provider)}</span>
            </div>
          )) ?? <span className="settings-modal__value">{agentConnectionsRefreshing ? "Checking providers…" : "Provider health unavailable"}</span>}
          <button
            className="settings-modal__action"
            type="button"
            disabled={agentConnectionsRefreshing}
            onClick={onRefreshAgentConnections}
          >
            {agentConnectionsRefreshing ? "Checking…" : "Refresh"}
          </button>
        </div>
      );
    }
    if (row.id === "agents.terminal-profiles") {
      const canAdd = customProfileLabel.trim().length > 0 && customProfileCommand.trim().length > 0;
      return (
        <div className="settings-workspace__terminal-profiles">
          {customTerminalProfiles.length > 0 ? (
            <div className="settings-workspace__profile-list" aria-label="Custom raw terminal profiles">
              {customTerminalProfiles.map((profile) => (
                <div className="settings-workspace__profile-row" key={profile.id}>
                  <span><strong>{profile.label}</strong><small>{profile.command}</small></span>
                  <button className="settings-modal__action settings-modal__action--danger" type="button" onClick={() => onRemoveCustomTerminalProfile?.(profile.id)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : <span className="settings-modal__value">No custom profiles</span>}
          <form
            className="settings-workspace__profile-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!canAdd) return;
              onAddCustomTerminalProfile?.(customProfileLabel.trim(), customProfileCommand.trim());
              setCustomProfileLabel("");
              setCustomProfileCommand("");
            }}
          >
            <label>
              <span>Name</span>
              <input className="settings-modal__input" aria-label="Custom terminal profile name" value={customProfileLabel} onChange={(event) => setCustomProfileLabel(event.currentTarget.value)} placeholder="Local agent" />
            </label>
            <label>
              <span>Command</span>
              <input className="settings-modal__input" aria-label="Custom terminal profile command" value={customProfileCommand} onChange={(event) => setCustomProfileCommand(event.currentTarget.value)} placeholder="agent-cli" />
            </label>
            <button className="settings-modal__action" type="submit" disabled={!canAdd}>Add profile</button>
          </form>
        </div>
      );
    }
    if (row.id === "agents.worktree-policy") {
      return (
        <div className="settings-workspace__policy" aria-label="Current worktree policy">
          <span><strong>Location</strong><small>.worktrees/&lt;slug&gt;</small></span>
          <span><strong>Branch</strong><small>worktree/&lt;slug&gt;</small></span>
          <span><strong>Cleanup</strong><small>Force-remove worktree, then delete branch through the app action gate</small></span>
        </div>
      );
    }
    if (row.id === "agents.hook-policy") {
      return (
        <div className="settings-workspace__policy" aria-label="Agent hook policy">
          <span><strong>Status</strong><small>{agentHookStatus?.running ? "Loopback MCP endpoint active" : "Agent hook unavailable"}</small></span>
          <span><strong>Endpoint</strong><small>{agentHookStatus?.endpoint ?? "Not running"}</small></span>
          <span><strong>Configuration</strong><small>{agentHookStatus?.configPath ?? "Unavailable"}</small></span>
          <span><strong>Safety</strong><small>Ephemeral bearer token · app-action approval · attributed results</small></span>
        </div>
      );
    }
    if (row.id === "agents.environment-policy") {
      return (
        <div className="settings-workspace__policy" aria-label="Environment policy">
          <span><strong>Current source</strong><small>Login shell PATH and process environment inherited by the project</small></span>
          <span><strong>Overrides</strong><small>Unavailable until AI-CONNECTIONS environment profiles</small></span>
          <span><strong>Secrets</strong><small>Credential values are never displayed in settings or process health</small></span>
        </div>
      );
    }
    if (row.id === "connections.manage") {
      return (
        <ConnectionSettingsPanel
          settings={aiConnectionSettings}
          workspacePath={workspacePath}
          secretPresence={connectionSecretPresence}
          onChange={(next) => onAiConnectionSettingsChange?.(next)}
          onDeleteSecret={onDeleteConnectionSecret ?? (async () => {})}
          onSaveSecret={onSaveConnectionSecret ?? (async () => {})}
          onValidateTarget={onValidateConnectionTarget ?? (async () => ({ ok: false, message: "Validation unavailable." }))}
          onBeginOAuth={onBeginMcpOAuth ?? (async () => { throw new Error("OAuth authorization unavailable."); })}
          onDisconnectOAuth={onDisconnectMcpOAuth ?? (async () => { throw new Error("OAuth disconnect unavailable."); })}
          oauthStatuses={mcpOAuthStatuses}
        />
      );
    }
    if (row.id === "shortcuts.palette-sources") {
      return (
        <div className="settings-workspace__source-list" role="group" aria-label="Command palette sources">
          {COMMAND_PALETTE_SOURCE_OPTIONS.map((source) => (
            <label className="settings-workspace__source-row" key={source.id}>
              <input
                type="checkbox"
                aria-label={`Toggle ${source.label} command palette source`}
                checked={commandPaletteSources[source.id]}
                onChange={(event) => onCommandPaletteSourceChange?.(source.id, event.currentTarget.checked)}
              />
              <span><strong>{source.label}</strong><small>{source.description}</small></span>
            </label>
          ))}
        </div>
      );
    }
    if (row.id === "layout.dock") {
      return (
        <select
          className="settings-modal__select"
          aria-label="Tool tray position"
          value={layout}
          onChange={(event) => onLayoutChange(event.currentTarget.value as WorkbenchLayoutMode)}
        >
          <option value="right">Right</option>
          <option value="left">Left</option>
          <option value="bottom">Bottom</option>
          <option value="hidden">Hidden</option>
        </select>
      );
    }
    if (row.id === "layout.tray") {
      return (
        <select
          className="settings-modal__select"
          aria-label="Tray surfaces"
          value={trayMode}
          onChange={(event) => onTrayModeChange(event.currentTarget.value as ToolTrayMode)}
        >
          <option value="files">Files</option>
          <option value="editor">Editor</option>
          <option value="browser">Browser</option>
          <option value="git">Git</option>
          <option value="split">Split</option>
        </select>
      );
    }
    if (row.id === "layout.reset") {
      return (
        <button className="settings-modal__action" type="button" onClick={onResetLayout}>
          Reset to demo default
        </button>
      );
    }
    if (row.id === "browser.url") {
      return (
        <input
          className="settings-modal__input"
          aria-label="Browser preview URL"
          value={browserDraft}
          onChange={(event) => setBrowserDraft(event.currentTarget.value)}
          onBlur={commitBrowserUrl}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitBrowserUrl();
            }
          }}
        />
      );
    }
    if (row.id === "git.health") {
      return (
        <span className="settings-modal__value">
          {gitBranch
            ? `⎇ ${gitBranch}${gitChangeCount != null ? ` · ${gitChangeCount} change${gitChangeCount === 1 ? "" : "s"}` : ""}`
            : "No repository detected"}
        </span>
      );
    }
    if (row.id === "git.source-control") {
      return (
        <span className="settings-modal__value">
          {sourceControlStatus
            ? `git: ${formatCliToolStatus(sourceControlStatus.git)} · gh: ${formatCliToolStatus(sourceControlStatus.gh)} · glab: ${formatCliToolStatus(sourceControlStatus.glab)}`
            : "Detecting…"}
        </span>
      );
    }
    if (row.id === "git.remote-links") {
      if (!repoLocation) {
        return <span className="settings-modal__value">No remote detected</span>;
      }
      const openLink = (url: string) => onOpenSourceControlLink?.(url);
      return (
        <span className="settings-modal__value">
          <button type="button" className="settings-modal__action" onClick={() => openLink(buildRepoUrl(repoLocation))}>
            Repo
          </button>
          <button type="button" className="settings-modal__action" onClick={() => openLink(buildPullRequestsUrl(repoLocation))}>
            {repoLocation.kind === "gitlab" ? "Merge requests" : "Pull requests"}
          </button>
          <button type="button" className="settings-modal__action" onClick={() => openLink(buildIssuesUrl(repoLocation))}>
            Issues
          </button>
          <button type="button" className="settings-modal__action" onClick={() => openLink(buildPipelinesUrl(repoLocation))}>
            {repoLocation.kind === "gitlab" ? "Pipelines" : "Actions"}
          </button>
        </span>
      );
    }
    if (row.id === "app.ignored") {
      return <span className="settings-modal__value">{IGNORED_FOLDERS.join("  ")}</span>;
    }
    if (row.id === "app.reset") {
      return (
        <button className="settings-modal__action settings-modal__action--danger" type="button" onClick={() => onResetLocalData?.()}>
          Reset…
        </button>
      );
    }
    if (row.id === "app.notifications") {
      return (
        <select
          className="settings-modal__select"
          aria-label="Background notifications"
          value={notificationsEnabled ? "on" : "off"}
          onChange={(event) => onNotificationsChange?.(event.currentTarget.value === "on")}
        >
          <option value="off">Off</option>
          <option value="on">On</option>
        </select>
      );
    }
    if (row.id === "app.theme") {
      return (
        <select
          className="settings-modal__select"
          aria-label="Color theme"
          value={theme}
          onChange={(event) => onThemeChange?.(event.currentTarget.value as "graphite" | "mono-ghost")}
        >
          <option value="graphite">Graphite · steel-cyan</option>
          <option value="mono-ghost">Mono ghost</option>
        </select>
      );
    }
    return null;
  };

  const shortcutTable = (
    <>
      {conflicts.length > 0 ? (
        <div className="settings-modal__conflict" role="alert">
          {conflicts
            .map((conflict) => `${conflict.keys} is bound to ${conflict.ids.join(" and ")}`)
            .join("; ")}
          . Rebind one of them.
        </div>
      ) : null}
      <table className="settings-modal__shortcuts">
        <thead>
          <tr>
            <th scope="col">Action</th>
            <th scope="col">Keys</th>
            <th scope="col">Scope</th>
            <th scope="col"><span className="settings-modal__sr">Edit</span></th>
          </tr>
        </thead>
        <tbody>
          {SHORTCUTS.filter((shortcut) => shortcut.status === "active" || shortcut.status === "native").map((shortcut) => {
            const overridden = Boolean(keybindingOverrides[shortcut.id]);
            const editable = shortcut.status === "active" && Boolean(onKeybindingOverrideChange);
            return (
              <tr key={shortcut.id}>
                <td>{shortcut.label}</td>
                <td>
                  {capturingId === shortcut.id ? (
                    <input
                      className="settings-modal__capture"
                      aria-label={`Press new keys for ${shortcut.label}`}
                      placeholder="Press keys…"
                      autoFocus
                      readOnly
                      onKeyDown={(event) => {
                        event.preventDefault();
                        if (event.key === "Escape") {
                          event.stopPropagation();
                          setCapturingId(null);
                          return;
                        }
                        const combo = eventToCombo(event);
                        if (!combo) return;
                        onKeybindingOverrideChange?.(shortcut.id, [combo]);
                        setCapturingId(null);
                      }}
                      onBlur={() => setCapturingId(null)}
                    />
                  ) : (
                    <>
                      {resolveShortcutKeys(shortcut.id).join(" / ")}
                      {overridden ? <span className="settings-modal__overridden"> (custom)</span> : null}
                    </>
                  )}
                </td>
                <td>{shortcut.scope}</td>
                <td>
                  {editable ? (
                    <span className="settings-modal__shortcut-actions">
                      <button className="settings-modal__action" type="button" onClick={() => setCapturingId(shortcut.id)}>
                        Rebind
                      </button>
                      {overridden ? (
                        <button
                          className="settings-modal__action"
                          type="button"
                          onClick={() => onKeybindingOverrideChange?.(shortcut.id, null)}
                        >
                          Reset
                        </button>
                      ) : null}
                    </span>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );

  const activeCategory = SETTINGS_CATEGORIES.find((entry) => entry.id === category) ?? SETTINGS_CATEGORIES[0];
  const scopedRowIds = new Set(["agents.profile", "agents.permission", "browser.url"]);
  const scopeLabel = (scope: SettingsRowDef["scope"]) => {
    if (scope === "project") return `Project · ${workspaceName}`;
    if (scope === "chat") return `Chat · ${sessionTitle}`;
    return "Global";
  };
  const scopedViewForRow = (row: SettingsRowDef): ScopedSettingView<unknown> | null => {
    if (row.id === "agents.profile") return profileSetting;
    if (row.id === "agents.permission") return approvalSetting;
    if (row.id === "browser.url") return browserSetting;
    return null;
  };
  const scopeEditor = (row: SettingsRowDef) => {
    const view = scopedViewForRow(row);
    if (!view) return <small className="settings-workspace__scope">{scopeLabel(row.scope)}</small>;
    const scope = selectedScope(row);
    const resolution = resolutionAt(view, scope);
    const sourceLabel = resolution.source === "global"
      ? "Global"
      : resolution.source === "project"
        ? `Project · ${workspaceName}`
        : `Chat · ${sessionTitle}`;
    const status = scope === "global"
      ? "Global default"
      : resolution.overridden
        ? `${scope === "project" ? "Project" : "Chat"} override`
        : `Inherited from ${sourceLabel}`;
    return (
      <div className="settings-workspace__scope-editor">
        <select
          className="settings-workspace__scope-select"
          aria-label={`${row.label} scope`}
          value={scope}
          onChange={(event) => {
            const nextScope = event.currentTarget.value as SettingsScope;
            setScopeByRow((current) => ({
              ...current,
              [row.id]: nextScope,
            }));
          }}
        >
          <option value="global">Global</option>
          <option value="project" disabled={!view.project}>Project</option>
          <option value="chat" disabled={!view.chat}>Chat</option>
        </select>
        <small className="settings-workspace__scope">{status}</small>
        {scope !== "global" && resolution.overridden ? (
          <button
            className="settings-workspace__scope-reset"
            type="button"
            onClick={() => onScopedSettingReset(
              row.id as "agents.profile" | "agents.permission" | "browser.url",
              scope,
            )}
          >
            Reset override
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <section
      className="settings-workspace"
      aria-label="Settings"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <header className="settings-workspace__header" data-tauri-drag-region>
        <button className="settings-workspace__back" type="button" onClick={onClose}>
          <AppIcon name="back" />
          <span>Back to app</span>
        </button>
        <strong className="settings-workspace__title">Settings</strong>
        <div className="settings-workspace__search-wrap">
          <AppIcon name="search" />
          <input
            ref={searchRef}
            className="settings-workspace__search"
            aria-label="Search settings"
            placeholder="Search settings…"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </div>
      </header>
      <div className="settings-workspace__body">
        <aside className="settings-workspace__sidebar">
          <label className="settings-workspace__mobile-label" htmlFor="settings-category">Category</label>
          <select
            id="settings-category"
            className="settings-workspace__category-select"
            value={category}
            onChange={(event) => {
              setQuery("");
              setCategory(event.currentTarget.value as SettingsCategoryId);
            }}
          >
            {SETTINGS_CATEGORIES.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
          </select>
          <nav className="settings-workspace__nav" aria-label="Settings categories">
            {SETTINGS_CATEGORY_GROUPS.map((group) => (
              <div className="settings-workspace__nav-group" key={group.id}>
                <div className="settings-workspace__nav-heading">{group.label}</div>
                {SETTINGS_CATEGORIES.filter((entry) => entry.groupId === group.id).map((entry) => (
                  <button
                    key={entry.id}
                    className={`settings-workspace__nav-row ${!searching && entry.id === category ? "settings-workspace__nav-row--active" : ""}`}
                    type="button"
                    aria-current={!searching && entry.id === category ? "page" : undefined}
                    onClick={() => {
                      setQuery("");
                      setCategory(entry.id);
                    }}
                  >
                    <AppIcon name={entry.icon} />
                    <span>{entry.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>
        </aside>
        <main className="settings-workspace__content">
          <header className="settings-workspace__content-header">
            {searching ? (
              <>
                <AppIcon name="search" />
                <div>
                  <h1>Search results</h1>
                  <p>{visibleRows.length} setting{visibleRows.length === 1 ? "" : "s"} match “{query.trim()}”.</p>
                </div>
              </>
            ) : (
              <>
                <AppIcon name={activeCategory.icon} />
                <div>
                  <h1>{activeCategory.label}</h1>
                  <p>{activeCategory.description}</p>
                </div>
              </>
            )}
          </header>
          <div className="settings-workspace__rows">
            {visibleRows.length === 0 ? (
              <div className="settings-modal__empty">No settings match “{query.trim()}”.</div>
            ) : (
              visibleRows.map((row) =>
                row.id === "shortcuts.reference" ? (
                  <div className="settings-modal__row settings-modal__row--block" key={row.id}>
                    <div className="settings-modal__copy">
                      <strong>{row.label}</strong>
                      <span>{row.hint}</span>
                      <small className="settings-workspace__scope">{scopeLabel(row.scope)}</small>
                    </div>
                    {shortcutTable}
                  </div>
                ) : (
                  <div className="settings-modal__row" key={row.id}>
                    <div className="settings-modal__copy">
                      <strong>{row.label}</strong>
                      <span>{row.hint}</span>
                    </div>
                    <div className="settings-workspace__row-control">
                      {control(row)}
                      {scopedRowIds.has(row.id) ? scopeEditor(row) : <small className="settings-workspace__scope">{scopeLabel(row.scope)}</small>}
                    </div>
                  </div>
                ),
              )
            )}
          </div>
        </main>
      </div>
    </section>
  );
}
