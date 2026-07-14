import { describe, expect, it } from "vitest";

import {
  formatAgentConnectionCapability,
  formatAgentConnectionHealth,
  normalizeAgentConnectionsStatus,
  structuredChatProviderId,
  type AgentConnectionStatus,
} from "./agentConnections";

const provider = (overrides: Partial<AgentConnectionStatus> = {}): AgentConnectionStatus => ({
  id: "codex",
  label: "Codex",
  installed: true,
  version: "codex-cli 0.141.0",
  authenticated: true,
  structuredChat: true,
  ...overrides,
});

describe("agent connection health", () => {
  it("distinguishes missing, signed-out, authenticated, and launch-checked providers", () => {
    expect(formatAgentConnectionHealth(provider({ installed: false, authenticated: null }))).toBe("Not installed");
    expect(formatAgentConnectionHealth(provider({ authenticated: false }))).toBe("Sign-in required");
    expect(formatAgentConnectionHealth(provider())).toBe("Authenticated");
    expect(formatAgentConnectionHealth(provider({ authenticated: null }))).toBe("Authentication checked when launched");
  });

  it("does not imply structured chat support for terminal-only providers", () => {
    expect(formatAgentConnectionCapability(provider())).toBe("Structured chat");
    expect(formatAgentConnectionCapability(provider({ id: "gemini", structuredChat: false }))).toBe("Raw terminal only");
    expect(structuredChatProviderId("codex")).toBe("codex");
    expect(structuredChatProviderId("gemini")).toBeNull();
    expect(structuredChatProviderId("claude")).toBe("claude");
    expect(structuredChatProviderId("shell")).toBeNull();
  });
});

describe("normalizeAgentConnectionsStatus", () => {
  const value = {
    providers: [
      provider(),
      provider({ id: "gemini", label: "Gemini", authenticated: null, structuredChat: false }),
      provider({ id: "claude", label: "Claude", structuredChat: false }),
    ],
  };

  it("accepts the complete provider response", () => {
    expect(normalizeAgentConnectionsStatus(value)).toEqual(value);
  });

  it("rejects missing, partial, and malformed responses", () => {
    expect(normalizeAgentConnectionsStatus(null)).toBeNull();
    expect(normalizeAgentConnectionsStatus({ providers: value.providers.slice(0, 2) })).toBeNull();
    expect(normalizeAgentConnectionsStatus({ providers: [...value.providers.slice(0, 2), { id: "claude" }] })).toBeNull();
  });
});
