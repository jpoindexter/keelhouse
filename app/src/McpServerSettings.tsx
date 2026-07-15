import { mcpOauthTokenKey, type AiConnectionSettings, type ConnectionTargetStatus, type McpOAuthStart, type McpOAuthStatus, type McpServerConfig } from "./connectionSettings";
import { targetStatusText } from "./connectionSettingsPanelHelpers";
import { McpServerForm } from "./McpServerForm";
import { useMcpServerActions } from "./useMcpServerActions";

type McpServerSettingsProps = {
  settings: AiConnectionSettings; secretPresence: Record<string, boolean>;
  onChange: (settings: AiConnectionSettings) => void; onDeleteSecret: (key: string) => Promise<void>;
  onSaveSecret: (key: string, value: string) => Promise<void>;
  onValidateTarget: (server: McpServerConfig) => Promise<ConnectionTargetStatus>;
  onBeginOAuth: (server: McpServerConfig) => Promise<McpOAuthStart>;
  onDisconnectOAuth: (server: McpServerConfig) => Promise<McpOAuthStatus>;
  oauthStatuses: Record<string, McpOAuthStatus>; onError: (message: string) => void;
};

type ServerRowProps = McpServerSettingsProps & { server: McpServerConfig; actions: ReturnType<typeof useMcpServerActions> };

function McpServerRow({ server, settings, secretPresence, oauthStatuses, onChange, actions }: ServerRowProps) {
  const pending = actions.pendingId === server.id;
  const connected = secretPresence[mcpOauthTokenKey(server.id)] || oauthStatuses[server.id]?.state === "connected";
  return <div className="connection-settings__list-row">
    <span><strong>{server.name}</strong><small>{server.transport} · {server.target} · {server.authMode}{oauthStatuses[server.id] ? ` · ${oauthStatuses[server.id].message}` : ""}{targetStatusText(actions.statuses[server.id])}</small></span>
    <label className="connection-settings__check"><input type="checkbox" checked={server.enabled} onChange={(event) => onChange({ ...settings, mcpServers: settings.mcpServers.map((item) => item.id === server.id ? { ...item, enabled: event.currentTarget.checked } : item) })} /> Enabled</label>
    {server.authMode === "oauth" ? <button type="button" disabled={pending || oauthStatuses[server.id]?.state === "pending"} onClick={() => void actions.beginOAuth(server)}>{secretPresence[mcpOauthTokenKey(server.id)] ? "Reauthorize" : "Authorize"}</button> : null}
    {server.authMode === "oauth" && connected ? <button type="button" disabled={pending} onClick={() => void actions.disconnect(server)}>Disconnect</button> : null}
    <button type="button" disabled={pending} onClick={() => void actions.validate(server)}>{pending ? "Checking..." : "Check"}</button>
    <button type="button" onClick={() => void actions.remove(server)}>Remove</button>
  </div>;
}

export function McpServerSettings(props: McpServerSettingsProps) {
  const actions = useMcpServerActions(props);
  return <section aria-labelledby="connection-mcp-heading">
    <h3 id="connection-mcp-heading">MCP servers</h3>
    <p>Configure stdio or HTTP servers. Bearer tokens use Keychain; OAuth records the issuer for the authorization flow.</p>
    <div className="connection-settings__list">
      {props.settings.mcpServers.map((server) => <McpServerRow {...props} actions={actions} server={server} key={server.id} />)}
    </div>
    <McpServerForm settings={props.settings} onChange={props.onChange} onSaveSecret={props.onSaveSecret} onError={props.onError} />
  </section>;
}
