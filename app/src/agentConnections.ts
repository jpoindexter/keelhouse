export type AgentConnectionStatus = {
  id: "codex" | "gemini" | "claude";
  label: string;
  installed: boolean;
  version: string | null;
  authenticated: boolean | null;
  structuredChat: boolean;
};

export type AgentConnectionsStatus = {
  providers: AgentConnectionStatus[];
};

const PROVIDER_IDS = new Set<AgentConnectionStatus["id"]>(["codex", "gemini", "claude"]);

const isAgentConnectionStatus = (value: unknown): value is AgentConnectionStatus => {
  if (typeof value !== "object" || value == null) return false;
  const status = value as Record<string, unknown>;
  return (
    typeof status.id === "string" &&
    PROVIDER_IDS.has(status.id as AgentConnectionStatus["id"]) &&
    typeof status.label === "string" &&
    typeof status.installed === "boolean" &&
    (status.version === null || typeof status.version === "string") &&
    (status.authenticated === null || typeof status.authenticated === "boolean") &&
    typeof status.structuredChat === "boolean"
  );
};

export const normalizeAgentConnectionsStatus = (value: unknown): AgentConnectionsStatus | null => {
  if (typeof value !== "object" || value == null) return null;
  const providers = (value as Record<string, unknown>).providers;
  if (!Array.isArray(providers) || providers.length !== 3 || !providers.every(isAgentConnectionStatus)) return null;
  return { providers };
};

export const formatAgentConnectionHealth = (status: AgentConnectionStatus): string => {
  if (!status.installed) return "Not installed";
  if (status.authenticated === false) return "Sign-in required";
  if (status.authenticated === true) return "Authenticated";
  return "Authentication checked when launched";
};

export const formatAgentConnectionCapability = (status: AgentConnectionStatus): string =>
  status.structuredChat ? "Structured chat" : "Raw terminal only";

export const structuredChatProviderId = (profileId: string): "codex" | "claude" | null =>
  profileId === "codex" || profileId === "claude" ? profileId : null;
