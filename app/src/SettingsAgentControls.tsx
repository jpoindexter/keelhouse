import { useState } from "react";

import { formatAgentConnectionCapability, formatAgentConnectionHealth } from "./agentConnections";
import type { AgentApprovalMode } from "./agentSessionHandle";
import { AppIcon } from "./icons";
import type { SettingsScope } from "./scopedSettings";
import type { SettingsRowDef } from "./settingsModalData";
import type { SettingsModalProps } from "./settingsModalTypes";
import { resolutionAt } from "./useSettingsWorkspaceState";

type AgentControlProps = { row: SettingsRowDef; props: SettingsModalProps; scope: SettingsScope };

function ProviderProfileControl({ props, scope }: Omit<AgentControlProps, "row">) {
  const profileId = resolutionAt(props.profileSetting, scope).value;
  return <select className="settings-modal__select" aria-label="Default agent profile" value={profileId} onChange={(event) => props.onProfileChange(scope, event.currentTarget.value)}>
    {props.profiles.map((profile) => <option key={profile.id} value={profile.id} disabled={profile.disabled}>{profile.label}</option>)}
  </select>;
}

function ApprovalControl({ props, scope }: Omit<AgentControlProps, "row">) {
  const mode = resolutionAt(props.approvalSetting, scope).value;
  return <select className="settings-modal__select" aria-label="Permission mode" value={mode} onChange={(event) => props.onApprovalModeChange(scope, event.currentTarget.value as AgentApprovalMode)}>
    <option value="ask">Ask</option><option value="approveSafe">Approve safe</option><option value="fullAccess">Full access</option>
  </select>;
}

function ProviderConnectionsControl({ props }: { props: SettingsModalProps }) {
  return <div className="settings-workspace__provider-list" aria-label="Provider connection health">
    {props.agentConnectionsStatus?.providers.map((provider) => <div className="settings-workspace__provider" key={provider.id}>
      <div><strong>{provider.label}</strong><small>{provider.version ?? "Version unavailable"}</small></div>
      <div className="settings-workspace__provider-status"><span>{formatAgentConnectionHealth(provider)}</span><small>{formatAgentConnectionCapability(provider)}</small></div>
      <button className="settings-workspace__provider-action" type="button" disabled={!provider.installed || !props.workspacePath || !props.onOpenAgentConnection} aria-label={`Open ${provider.label} CLI for setup`} title={!provider.installed ? `${provider.label} is not installed` : !props.workspacePath ? "Open a project first" : `Open ${provider.label} CLI`} onClick={() => props.onOpenAgentConnection?.(provider.id)}><AppIcon name="terminal" /><span>Open CLI</span></button>
    </div>) ?? <span className="settings-modal__value">{props.agentConnectionsRefreshing ? "Checking providers…" : "Provider health unavailable"}</span>}
    <button className="settings-modal__action" type="button" disabled={props.agentConnectionsRefreshing} onClick={props.onRefreshAgentConnections}>{props.agentConnectionsRefreshing ? "Checking…" : "Refresh"}</button>
  </div>;
}

function TerminalProfilesControl({ props }: { props: SettingsModalProps }) {
  const [label, setLabel] = useState("");
  const [command, setCommand] = useState("");
  const profiles = props.customTerminalProfiles ?? [];
  const canAdd = Boolean(label.trim() && command.trim());
  return <div className="settings-workspace__terminal-profiles">
    {profiles.length > 0 ? <div className="settings-workspace__profile-list" aria-label="Custom raw terminal profiles">
      {profiles.map((profile) => <div className="settings-workspace__profile-row" key={profile.id}><span><strong>{profile.label}</strong><small>{profile.command}</small></span><button className="settings-modal__action settings-modal__action--danger" type="button" onClick={() => props.onRemoveCustomTerminalProfile?.(profile.id)}>Remove</button></div>)}
    </div> : <span className="settings-modal__value">No custom profiles</span>}
    <form className="settings-workspace__profile-form" onSubmit={(event) => {
      event.preventDefault();
      if (!canAdd) return;
      props.onAddCustomTerminalProfile?.(label.trim(), command.trim());
      setLabel(""); setCommand("");
    }}>
      <label><span>Name</span><input className="settings-modal__input" aria-label="Custom terminal profile name" value={label} onChange={(event) => setLabel(event.currentTarget.value)} placeholder="Local agent" /></label>
      <label><span>Command</span><input className="settings-modal__input" aria-label="Custom terminal profile command" value={command} onChange={(event) => setCommand(event.currentTarget.value)} placeholder="agent-cli" /></label>
      <button className="settings-modal__action" type="submit" disabled={!canAdd}>Add profile</button>
    </form>
  </div>;
}

const PolicyControl = ({ label, rows }: { label: string; rows: [string, string][] }) => <div className="settings-workspace__policy" aria-label={label}>
  {rows.map(([title, detail]) => <span key={title}><strong>{title}</strong><small>{detail}</small></span>)}
</div>;

export function SettingsAgentControl({ row, props, scope }: AgentControlProps) {
  if (row.id === "agents.profile") return <ProviderProfileControl props={props} scope={scope} />;
  if (row.id === "agents.permission") return <ApprovalControl props={props} scope={scope} />;
  if (row.id === "agents.connections") return <ProviderConnectionsControl props={props} />;
  if (row.id === "agents.terminal-profiles") return <TerminalProfilesControl props={props} />;
  if (row.id === "agents.worktree-policy") return <PolicyControl label="Current worktree policy" rows={[["Location", ".worktrees/<slug>"], ["Branch", "worktree/<slug>"], ["Cleanup", "Force-remove worktree, then delete branch through the app action gate"]]} />;
  if (row.id === "agents.hook-policy") return <PolicyControl label="Agent hook policy" rows={[["Status", props.agentHookStatus?.running ? "Loopback MCP endpoint active" : "Agent hook unavailable"], ["Endpoint", props.agentHookStatus?.endpoint ?? "Not running"], ["Configuration", props.agentHookStatus?.configPath ?? "Unavailable"], ["Safety", "Ephemeral bearer token · app-action approval · attributed results"]]} />;
  if (row.id === "agents.environment-policy") return <PolicyControl label="Environment policy" rows={[["Current source", "Login shell PATH and process environment inherited by the project"], ["Overrides", "Unavailable until AI-CONNECTIONS environment profiles"], ["Secrets", "Credential values are never displayed in settings or process health"]]} />;
  return null;
}
