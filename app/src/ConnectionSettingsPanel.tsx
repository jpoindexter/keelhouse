import { useState } from "react";

import {
  CONNECTION_PROVIDER_IDS,
  environmentSecretKey,
  environmentVariablesForProject,
  mcpSecretKey,
  providerSecretKey,
  validateMcpServer,
  type AiConnectionSettings,
  type ConnectionProviderId,
  type ConnectionTargetStatus,
  type McpAuthMode,
  type McpServerConfig,
  type McpTransport,
} from "./connectionSettings";

const PROVIDER_LABELS: Record<ConnectionProviderId, string> = {
  codex: "Codex",
  gemini: "Gemini",
  claude: "Claude",
};

const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);

type ConnectionSettingsPanelProps = {
  settings: AiConnectionSettings;
  workspacePath: string;
  secretPresence: Record<string, boolean>;
  onChange: (settings: AiConnectionSettings) => void;
  onDeleteSecret: (key: string) => Promise<void>;
  onSaveSecret: (key: string, value: string) => Promise<void>;
  onValidateTarget: (server: McpServerConfig) => Promise<ConnectionTargetStatus>;
};

export function ConnectionSettingsPanel({
  settings,
  workspacePath,
  secretPresence,
  onChange,
  onDeleteSecret,
  onSaveSecret,
  onValidateTarget,
}: ConnectionSettingsPanelProps) {
  const [providerSecrets, setProviderSecrets] = useState<Partial<Record<ConnectionProviderId, string>>>({});
  const [environmentName, setEnvironmentName] = useState("");
  const [environmentValue, setEnvironmentValue] = useState("");
  const [environmentSecret, setEnvironmentSecret] = useState(false);
  const [mcpName, setMcpName] = useState("");
  const [mcpTransport, setMcpTransport] = useState<McpTransport>("stdio");
  const [mcpTarget, setMcpTarget] = useState("");
  const [mcpArgs, setMcpArgs] = useState("");
  const [mcpAuthMode, setMcpAuthMode] = useState<McpAuthMode>("none");
  const [mcpOauthIssuer, setMcpOauthIssuer] = useState("");
  const [mcpBearer, setMcpBearer] = useState("");
  const [formError, setFormError] = useState("");
  const [targetStatus, setTargetStatus] = useState<Record<string, ConnectionTargetStatus>>({});
  const environment = environmentVariablesForProject(settings, workspacePath);

  const updateModel = (provider: ConnectionProviderId, value: string) => {
    onChange({
      ...settings,
      providerModels: { ...settings.providerModels, [provider]: value.slice(0, 128) },
    });
  };

  const addEnvironment = async () => {
    const name = environmentName.trim().toUpperCase();
    if (!/^[A-Z_][A-Z0-9_]*$/.test(name)) {
      setFormError("Environment name must use letters, numbers, and underscores and cannot start with a number.");
      return;
    }
    if (environment.some((variable) => variable.name === name)) {
      setFormError(`${name} already exists for this project.`);
      return;
    }
    if (!environmentValue) {
      setFormError("Environment value is required.");
      return;
    }
    const id = crypto.randomUUID();
    try {
      if (environmentSecret) await onSaveSecret(environmentSecretKey(id), environmentValue);
    } catch (error) {
      setFormError(errorText(error));
      return;
    }
    onChange({
      ...settings,
      environmentByProject: {
        ...settings.environmentByProject,
        [workspacePath]: [
          ...environment,
          { id, name, value: environmentSecret ? "" : environmentValue, secret: environmentSecret },
        ],
      },
    });
    setEnvironmentName("");
    setEnvironmentValue("");
    setEnvironmentSecret(false);
    setFormError("");
  };

  const removeEnvironment = async (id: string, secret: boolean) => {
    try {
      if (secret) await onDeleteSecret(environmentSecretKey(id));
    } catch (error) {
      setFormError(errorText(error));
      return;
    }
    const next = environment.filter((variable) => variable.id !== id);
    onChange({
      ...settings,
      environmentByProject: { ...settings.environmentByProject, [workspacePath]: next },
    });
  };

  const addMcpServer = async () => {
    const next: McpServerConfig = {
      id: crypto.randomUUID(),
      name: mcpName.trim(),
      transport: mcpTransport,
      target: mcpTarget.trim(),
      args: mcpArgs.trim() ? mcpArgs.trim().split(/\s+/).slice(0, 40) : [],
      authMode: mcpAuthMode,
      oauthIssuer: mcpOauthIssuer.trim(),
      enabled: true,
    };
    const errors = validateMcpServer(next);
    if (mcpAuthMode === "bearer" && !mcpBearer) errors.push("Bearer token is required.");
    if (errors.length > 0) {
      setFormError(errors[0]);
      return;
    }
    try {
      if (mcpAuthMode === "bearer") await onSaveSecret(mcpSecretKey(next.id), mcpBearer);
    } catch (error) {
      setFormError(errorText(error));
      return;
    }
    onChange({ ...settings, mcpServers: [...settings.mcpServers, next] });
    setMcpName("");
    setMcpTarget("");
    setMcpArgs("");
    setMcpAuthMode("none");
    setMcpOauthIssuer("");
    setMcpBearer("");
    setFormError("");
  };

  const removeMcpServer = async (server: McpServerConfig) => {
    try {
      if (server.authMode === "bearer") await onDeleteSecret(mcpSecretKey(server.id));
    } catch (error) {
      setFormError(errorText(error));
      return;
    }
    onChange({ ...settings, mcpServers: settings.mcpServers.filter((candidate) => candidate.id !== server.id) });
  };

  return (
    <div className="connection-settings">
      <section aria-labelledby="connection-provider-heading">
        <h3 id="connection-provider-heading">Provider defaults</h3>
        <p>Models are stored locally. API keys are write-only in macOS Keychain.</p>
        {CONNECTION_PROVIDER_IDS.map((provider) => {
          const key = providerSecretKey(provider);
          return (
            <div className="connection-settings__provider" key={provider}>
              <strong>{PROVIDER_LABELS[provider]}</strong>
              <label><span>Default model</span><input aria-label={`${PROVIDER_LABELS[provider]} default model`} value={settings.providerModels[provider]} onChange={(event) => updateModel(provider, event.currentTarget.value)} placeholder="Provider default" /></label>
              <label><span>API key</span><input aria-label={`${PROVIDER_LABELS[provider]} API key`} type="password" autoComplete="off" value={providerSecrets[provider] ?? ""} onChange={(event) => setProviderSecrets((current) => ({ ...current, [provider]: event.currentTarget.value }))} placeholder={secretPresence[key] ? "Stored in Keychain" : "Not configured"} /></label>
              <div className="connection-settings__actions">
                <span>{secretPresence[key] ? "Keychain: configured" : "Keychain: empty"}</span>
                <button type="button" disabled={!providerSecrets[provider]} onClick={async () => {
                  try {
                    await onSaveSecret(key, providerSecrets[provider] ?? "");
                    setProviderSecrets((current) => ({ ...current, [provider]: "" }));
                    setFormError("");
                  } catch (error) {
                    setFormError(errorText(error));
                  }
                }}>Save key</button>
                <button type="button" disabled={!secretPresence[key]} onClick={async () => {
                  try {
                    await onDeleteSecret(key);
                    setFormError("");
                  } catch (error) {
                    setFormError(errorText(error));
                  }
                }}>Clear</button>
              </div>
            </div>
          );
        })}
      </section>

      <section aria-labelledby="connection-environment-heading">
        <h3 id="connection-environment-heading">Project environment</h3>
        <p>{workspacePath || "No project open"}. Secret values stay in Keychain and are never displayed again.</p>
        <div className="connection-settings__list">
          {environment.map((variable) => (
            <div className="connection-settings__list-row" key={variable.id}>
              <span><strong>{variable.name}</strong><small>{variable.secret ? (secretPresence[environmentSecretKey(variable.id)] ? "Secret · Keychain configured" : "Secret · missing") : variable.value}</small></span>
              <button type="button" onClick={() => removeEnvironment(variable.id, variable.secret)}>Remove</button>
            </div>
          ))}
        </div>
        <div className="connection-settings__form connection-settings__form--environment">
          <input aria-label="Environment variable name" value={environmentName} onChange={(event) => setEnvironmentName(event.currentTarget.value)} placeholder="VARIABLE_NAME" />
          <input aria-label="Environment variable value" type={environmentSecret ? "password" : "text"} value={environmentValue} onChange={(event) => setEnvironmentValue(event.currentTarget.value)} placeholder="Value" />
          <label className="connection-settings__check"><input type="checkbox" checked={environmentSecret} onChange={(event) => setEnvironmentSecret(event.currentTarget.checked)} /> Secret</label>
          <button type="button" disabled={!workspacePath} onClick={() => void addEnvironment()}>Add</button>
        </div>
      </section>

      <section aria-labelledby="connection-mcp-heading">
        <h3 id="connection-mcp-heading">MCP servers</h3>
        <p>Configure stdio or HTTP servers. Bearer tokens use Keychain; OAuth records the issuer for the authorization flow.</p>
        <div className="connection-settings__list">
          {settings.mcpServers.map((server) => (
            <div className="connection-settings__list-row" key={server.id}>
              <span><strong>{server.name}</strong><small>{server.transport} · {server.target} · {server.authMode}{targetStatus[server.id] ? ` · ${targetStatus[server.id].message}` : ""}</small></span>
              <label className="connection-settings__check"><input type="checkbox" checked={server.enabled} onChange={(event) => onChange({ ...settings, mcpServers: settings.mcpServers.map((candidate) => candidate.id === server.id ? { ...candidate, enabled: event.currentTarget.checked } : candidate) })} /> Enabled</label>
              <button type="button" onClick={async () => {
                const status = await onValidateTarget(server);
                setTargetStatus((current) => ({ ...current, [server.id]: status }));
              }}>Validate</button>
              <button type="button" onClick={() => void removeMcpServer(server)}>Remove</button>
            </div>
          ))}
        </div>
        <div className="connection-settings__form">
          <input aria-label="MCP server name" value={mcpName} onChange={(event) => setMcpName(event.currentTarget.value)} placeholder="Server name" />
          <select aria-label="MCP transport" value={mcpTransport} onChange={(event) => setMcpTransport(event.currentTarget.value as McpTransport)}><option value="stdio">stdio</option><option value="http">HTTP</option></select>
          <input aria-label="MCP target" value={mcpTarget} onChange={(event) => setMcpTarget(event.currentTarget.value)} placeholder={mcpTransport === "stdio" ? "Executable" : "https://host/mcp"} />
          {mcpTransport === "stdio" ? <input aria-label="MCP arguments" value={mcpArgs} onChange={(event) => setMcpArgs(event.currentTarget.value)} placeholder="Arguments" /> : null}
          <select aria-label="MCP authentication" value={mcpAuthMode} onChange={(event) => setMcpAuthMode(event.currentTarget.value as McpAuthMode)}><option value="none">No auth</option><option value="bearer">Bearer token</option><option value="oauth">OAuth</option></select>
          {mcpAuthMode === "bearer" ? <input aria-label="MCP bearer token" type="password" autoComplete="off" value={mcpBearer} onChange={(event) => setMcpBearer(event.currentTarget.value)} placeholder="Stored in Keychain" /> : null}
          {mcpAuthMode === "oauth" ? <input aria-label="MCP OAuth issuer" value={mcpOauthIssuer} onChange={(event) => setMcpOauthIssuer(event.currentTarget.value)} placeholder="https://issuer" /> : null}
          <button type="button" onClick={() => void addMcpServer()}>Add server</button>
        </div>
      </section>
      {formError ? <p className="connection-settings__error" role="alert">{formError}</p> : null}
    </div>
  );
}
