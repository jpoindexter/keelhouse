import type { AiConnectionSettings, McpAuthMode, McpTransport } from "./connectionSettings";
import { useMcpServerForm } from "./useMcpServerForm";

type McpServerFormProps = {
  settings: AiConnectionSettings;
  onChange: (settings: AiConnectionSettings) => void;
  onSaveSecret: (key: string, value: string) => Promise<void>;
  onError: (message: string) => void;
};

export function McpServerForm(props: McpServerFormProps) {
  const form = useMcpServerForm(props);
  const update = (values: Partial<typeof form.draft>) => form.setDraft({ ...form.draft, ...values });
  return <div className="connection-settings__form">
    <input aria-label="MCP server name" value={form.draft.name} onChange={(event) => update({ name: event.currentTarget.value })} placeholder="Server name" />
    <select aria-label="MCP transport" value={form.draft.transport} onChange={(event) => update({ transport: event.currentTarget.value as McpTransport })}><option value="stdio">stdio</option><option value="http">HTTP</option></select>
    <input aria-label="MCP target" value={form.draft.target} onChange={(event) => update({ target: event.currentTarget.value })} placeholder={form.draft.transport === "stdio" ? "Executable" : "https://host/mcp"} />
    {form.draft.transport === "stdio" ? <input aria-label="MCP arguments" value={form.draft.args} onChange={(event) => update({ args: event.currentTarget.value })} placeholder="Arguments" /> : null}
    <select aria-label="MCP authentication" value={form.draft.authMode} onChange={(event) => update({ authMode: event.currentTarget.value as McpAuthMode })}><option value="none">No auth</option><option value="bearer">Bearer token</option><option value="oauth">OAuth</option></select>
    {form.draft.authMode === "bearer" ? <input aria-label="MCP bearer token" type="password" autoComplete="off" value={form.draft.bearer} onChange={(event) => update({ bearer: event.currentTarget.value })} placeholder="Stored in Keychain" /> : null}
    {form.draft.authMode === "oauth" ? <>
      <input aria-label="MCP OAuth issuer" value={form.draft.oauthIssuer} onChange={(event) => update({ oauthIssuer: event.currentTarget.value })} placeholder="Authorization server override (optional)" />
      <input aria-label="MCP OAuth client ID" value={form.draft.oauthClientId} onChange={(event) => update({ oauthClientId: event.currentTarget.value })} placeholder="Client ID (optional with DCR)" />
      <input aria-label="MCP OAuth scopes" value={form.draft.oauthScopes} onChange={(event) => update({ oauthScopes: event.currentTarget.value })} placeholder="Scopes (space separated)" />
    </> : null}
    <button type="button" onClick={() => void form.add()}>Add server</button>
  </div>;
}
