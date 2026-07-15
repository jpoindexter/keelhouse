import type { ConnectionTargetStatus } from "./connectionSettings";

export const connectionErrorText = (error: unknown) => error instanceof Error ? error.message : String(error);

export const targetStatusText = (status: ConnectionTargetStatus | undefined) => {
  if (!status) return "";
  const details = [
    status.protocolVersion ? `MCP ${status.protocolVersion}` : "",
    status.tools?.length ? status.tools.slice(0, 4).join(", ") : "",
  ].filter(Boolean);
  return ` · ${status.message}${details.length > 0 ? ` · ${details.join(" · ")}` : ""}`;
};
