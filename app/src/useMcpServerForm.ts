import { useState } from "react";

import { mcpSecretKey, validateMcpServer, type AiConnectionSettings, type McpAuthMode, type McpServerConfig, type McpTransport } from "./connectionSettings";
import { connectionErrorText } from "./connectionSettingsPanelHelpers";

export type McpDraft = {
  name: string; transport: McpTransport; target: string; args: string;
  authMode: McpAuthMode; oauthIssuer: string; oauthClientId: string; oauthScopes: string; bearer: string;
};
const EMPTY_DRAFT: McpDraft = { name: "", transport: "stdio", target: "", args: "", authMode: "none", oauthIssuer: "", oauthClientId: "", oauthScopes: "", bearer: "" };

type McpFormParams = {
  settings: AiConnectionSettings;
  onChange: (settings: AiConnectionSettings) => void;
  onSaveSecret: (key: string, value: string) => Promise<void>;
  onError: (message: string) => void;
};

const serverFromDraft = (draft: McpDraft): McpServerConfig => ({
  id: crypto.randomUUID(), name: draft.name.trim(), transport: draft.transport, target: draft.target.trim(),
  args: draft.args.trim() ? draft.args.trim().split(/\s+/).slice(0, 40) : [], authMode: draft.authMode,
  oauthIssuer: draft.oauthIssuer.trim(), oauthClientId: draft.oauthClientId.trim(),
  oauthScopes: draft.oauthScopes.trim() ? draft.oauthScopes.trim().split(/\s+/).slice(0, 40) : [], enabled: true,
});

export const useMcpServerForm = (params: McpFormParams) => {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const add = async () => {
    const server = serverFromDraft(draft);
    const errors = validateMcpServer(server);
    if (draft.authMode === "bearer" && !draft.bearer) errors.push("Bearer token is required.");
    if (errors.length > 0) return params.onError(errors[0]);
    try {
      if (draft.authMode === "bearer") await params.onSaveSecret(mcpSecretKey(server.id), draft.bearer);
    } catch (error) {
      return params.onError(connectionErrorText(error));
    }
    params.onChange({ ...params.settings, mcpServers: [...params.settings.mcpServers, server] });
    setDraft(EMPTY_DRAFT);
    params.onError("");
  };
  return { add, draft, setDraft };
};
