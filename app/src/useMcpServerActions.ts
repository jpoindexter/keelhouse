import { useState } from "react";

import { mcpSecretKey, type AiConnectionSettings, type ConnectionTargetStatus, type McpOAuthStart, type McpOAuthStatus, type McpServerConfig } from "./connectionSettings";
import { connectionErrorText } from "./connectionSettingsPanelHelpers";

type McpActionParams = {
  settings: AiConnectionSettings;
  onChange: (settings: AiConnectionSettings) => void;
  onDeleteSecret: (key: string) => Promise<void>;
  onValidateTarget: (server: McpServerConfig) => Promise<ConnectionTargetStatus>;
  onBeginOAuth: (server: McpServerConfig) => Promise<McpOAuthStart>;
  onDisconnectOAuth: (server: McpServerConfig) => Promise<McpOAuthStatus>;
  onError: (message: string) => void;
};

export const useMcpServerActions = (params: McpActionParams) => {
  const [statuses, setStatuses] = useState<Record<string, ConnectionTargetStatus>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const run = async (server: McpServerConfig, action: () => Promise<ConnectionTargetStatus>) => {
    setPendingId(server.id);
    try {
      const status = await action();
      setStatuses((current) => ({ ...current, [server.id]: status }));
    } catch (error) {
      setStatuses((current) => ({ ...current, [server.id]: { ok: false, message: connectionErrorText(error) } }));
    } finally {
      setPendingId(null);
    }
  };
  const beginOAuth = (server: McpServerConfig) => run(server, async () => {
    const start = await params.onBeginOAuth(server);
    if (start.clientId !== server.oauthClientId) params.onChange({ ...params.settings, mcpServers: params.settings.mcpServers.map((candidate) => candidate.id === server.id ? { ...candidate, oauthClientId: start.clientId } : candidate) });
    return { ok: true, message: start.message };
  });
  const disconnect = (server: McpServerConfig) => run(server, async () => {
    const status = await params.onDisconnectOAuth(server);
    return { ok: true, message: status.message };
  });
  const validate = (server: McpServerConfig) => run(server, () => params.onValidateTarget(server));
  const remove = async (server: McpServerConfig) => {
    try {
      if (server.authMode === "bearer") await params.onDeleteSecret(mcpSecretKey(server.id));
      if (server.authMode === "oauth") await params.onDisconnectOAuth(server);
    } catch (error) {
      return params.onError(connectionErrorText(error));
    }
    params.onChange({ ...params.settings, mcpServers: params.settings.mcpServers.filter((item) => item.id !== server.id) });
  };
  return { beginOAuth, disconnect, pendingId, remove, statuses, validate };
};
