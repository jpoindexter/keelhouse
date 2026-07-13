import { describe, expect, it } from "vitest";

import {
  DEFAULT_AI_CONNECTION_SETTINGS,
  connectionEnvironmentInputs,
  environmentSecretKey,
  normalizeAiConnectionSettings,
  providerSecretKey,
  validateMcpServer,
  type McpServerConfig,
} from "./connectionSettings";

const server = (overrides: Partial<McpServerConfig> = {}): McpServerConfig => ({
  id: "local-docs",
  name: "Local docs",
  transport: "stdio",
  target: "docs-mcp",
  args: ["--stdio"],
  authMode: "none",
  oauthIssuer: "",
  enabled: true,
  ...overrides,
});

describe("AI connection settings", () => {
  it("normalizes non-secret config and strips persisted secret values", () => {
    expect(normalizeAiConnectionSettings({
      providerModels: { codex: "gpt-5", gemini: 42 },
      mcpServers: [server(), { name: "missing id" }],
      environmentByProject: {
        "/repo": [
          { id: "public", name: "node_env", value: "test", secret: false },
          { id: "secret", name: "api_token", value: "must-not-persist", secret: true },
        ],
      },
    })).toEqual({
      providerModels: { codex: "gpt-5", gemini: "", claude: "" },
      mcpServers: [server()],
      environmentByProject: {
        "/repo": [
          { id: "public", name: "NODE_ENV", value: "test", secret: false },
          { id: "secret", name: "API_TOKEN", value: "", secret: true },
        ],
      },
    });
  });

  it("returns independent defaults for malformed values", () => {
    const first = normalizeAiConnectionSettings(null);
    first.providerModels.codex = "changed";
    expect(normalizeAiConnectionSettings(null)).toEqual(DEFAULT_AI_CONNECTION_SETTINGS);
  });

  it("explains invalid MCP transport and OAuth combinations", () => {
    expect(validateMcpServer(server())).toEqual([]);
    expect(validateMcpServer(server({ target: "docs-mcp --stdio" }))).toContain("Executable must not include arguments; use the Arguments field.");
    expect(validateMcpServer(server({ authMode: "oauth", oauthIssuer: "https://auth.example.test" }))).toContain("OAuth requires an HTTP transport.");
    expect(validateMcpServer(server({ transport: "http", target: "mcp.example.test" }))).toContain("Endpoint must start with http:// or https:// and include a host.");
  });

  it("uses opaque identifiers for Keychain accounts", () => {
    expect(providerSecretKey("gemini")).toBe("provider:gemini:api-key");
    expect(environmentSecretKey("secret-1")).toBe("environment:secret-1");
  });

  it("builds launch inputs without materializing secret values", () => {
    const settings = normalizeAiConnectionSettings({
      environmentByProject: {
        "/repo": [
          { id: "public", name: "NODE_ENV", value: "test", secret: false },
          { id: "secret", name: "API_TOKEN", value: "must-not-survive", secret: true },
        ],
      },
    });
    const inputs = connectionEnvironmentInputs(settings, "/repo");
    expect(inputs).toEqual([
      { name: "NODE_ENV", value: "test" },
      { name: "API_TOKEN", secretKey: "environment:secret" },
    ]);
    expect(JSON.stringify(inputs)).not.toContain("must-not-survive");
  });
});
