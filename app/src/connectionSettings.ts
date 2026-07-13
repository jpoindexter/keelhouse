export const CONNECTION_PROVIDER_IDS = ["codex", "gemini", "claude"] as const;

export type ConnectionProviderId = (typeof CONNECTION_PROVIDER_IDS)[number];
export type McpTransport = "stdio" | "http";
export type McpAuthMode = "none" | "bearer" | "oauth";

export type McpServerConfig = {
  id: string;
  name: string;
  transport: McpTransport;
  target: string;
  args: string[];
  authMode: McpAuthMode;
  oauthIssuer: string;
  enabled: boolean;
};

export type EnvironmentVariableConfig = {
  id: string;
  name: string;
  value: string;
  secret: boolean;
};

export type ConnectionEnvironmentInput = {
  name: string;
  value?: string;
  secretKey?: string;
};

export type AiConnectionSettings = {
  providerModels: Record<ConnectionProviderId, string>;
  mcpServers: McpServerConfig[];
  environmentByProject: Record<string, EnvironmentVariableConfig[]>;
};

export type ConnectionSecretStatus = { key: string; present: boolean };
export type ConnectionTargetStatus = { ok: boolean; message: string };

export const DEFAULT_AI_CONNECTION_SETTINGS: AiConnectionSettings = {
  providerModels: { codex: "", gemini: "", claude: "" },
  mcpServers: [],
  environmentByProject: {},
};

const cleanId = (value: unknown) =>
  typeof value === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value) ? value : null;

const cleanText = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const normalizeMcpServer = (value: unknown): McpServerConfig | null => {
  if (typeof value !== "object" || value == null) return null;
  const server = value as Record<string, unknown>;
  const id = cleanId(server.id);
  const name = cleanText(server.name, 80);
  const transport = server.transport === "http" ? "http" : server.transport === "stdio" ? "stdio" : null;
  const authMode = server.authMode === "bearer" || server.authMode === "oauth" ? server.authMode : "none";
  if (!id || !name || !transport) return null;
  return {
    id,
    name,
    transport,
    target: cleanText(server.target, 1000),
    args: Array.isArray(server.args)
      ? server.args.filter((arg): arg is string => typeof arg === "string").map((arg) => arg.slice(0, 500)).slice(0, 40)
      : [],
    authMode,
    oauthIssuer: cleanText(server.oauthIssuer, 1000),
    enabled: server.enabled !== false,
  };
};

const normalizeEnvironmentVariable = (value: unknown): EnvironmentVariableConfig | null => {
  if (typeof value !== "object" || value == null) return null;
  const variable = value as Record<string, unknown>;
  const id = cleanId(variable.id);
  const name = cleanText(variable.name, 120).toUpperCase();
  if (!id || !/^[A-Z_][A-Z0-9_]*$/.test(name)) return null;
  const secret = variable.secret === true;
  return {
    id,
    name,
    value: secret ? "" : typeof variable.value === "string" ? variable.value.slice(0, 4000) : "",
    secret,
  };
};

export const normalizeAiConnectionSettings = (value: unknown): AiConnectionSettings => {
  if (typeof value !== "object" || value == null) return structuredClone(DEFAULT_AI_CONNECTION_SETTINGS);
  const candidate = value as Record<string, unknown>;
  const models = typeof candidate.providerModels === "object" && candidate.providerModels != null
    ? candidate.providerModels as Record<string, unknown>
    : {};
  const environmentByProject: Record<string, EnvironmentVariableConfig[]> = {};
  if (typeof candidate.environmentByProject === "object" && candidate.environmentByProject != null) {
    for (const [project, variables] of Object.entries(candidate.environmentByProject as Record<string, unknown>)) {
      if (!project || !Array.isArray(variables)) continue;
      const normalized = variables.map(normalizeEnvironmentVariable).filter((item): item is EnvironmentVariableConfig => item != null).slice(0, 100);
      if (normalized.length > 0) environmentByProject[project] = normalized;
    }
  }
  return {
    providerModels: Object.fromEntries(
      CONNECTION_PROVIDER_IDS.map((id) => [id, cleanText(models[id], 128)]),
    ) as Record<ConnectionProviderId, string>,
    mcpServers: Array.isArray(candidate.mcpServers)
      ? candidate.mcpServers.map(normalizeMcpServer).filter((item): item is McpServerConfig => item != null).slice(0, 40)
      : [],
    environmentByProject,
  };
};

export const providerSecretKey = (provider: ConnectionProviderId) => `provider:${provider}:api-key`;
export const mcpSecretKey = (serverId: string) => `mcp:${serverId}:bearer`;
export const environmentSecretKey = (variableId: string) => `environment:${variableId}`;

export const validateMcpServer = (server: McpServerConfig): string[] => {
  const errors: string[] = [];
  if (!server.name.trim()) errors.push("Name is required.");
  if (!server.target.trim()) errors.push(server.transport === "stdio" ? "Executable is required." : "Endpoint is required.");
  if (server.transport === "http" && !/^https?:\/\/[^\s/]+/i.test(server.target)) errors.push("Endpoint must start with http:// or https:// and include a host.");
  if (server.transport === "stdio" && /\s/.test(server.target.trim())) errors.push("Executable must not include arguments; use the Arguments field.");
  if (server.authMode === "oauth" && server.transport !== "http") errors.push("OAuth requires an HTTP transport.");
  if (server.authMode === "oauth" && !/^https?:\/\/[^\s/]+/i.test(server.oauthIssuer)) errors.push("OAuth issuer must be an http:// or https:// URL with a host.");
  return errors;
};

export const environmentVariablesForProject = (settings: AiConnectionSettings, project: string) =>
  settings.environmentByProject[project] ?? [];

export const connectionEnvironmentInputs = (
  settings: AiConnectionSettings,
  project: string,
): ConnectionEnvironmentInput[] => environmentVariablesForProject(settings, project).map((variable) =>
  variable.secret
    ? { name: variable.name, secretKey: environmentSecretKey(variable.id) }
    : { name: variable.name, value: variable.value }
);
