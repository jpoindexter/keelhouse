# AI Connections

Keelhouse keeps connection metadata in the existing Tauri Store and secret values in macOS Keychain. The frontend can write, clear, and query the presence of a secret, but the Rust commands never return its value over IPC.

## Implemented Foundation

- Provider defaults for Codex, Gemini, and Claude, including a per-provider model name.
- Provider API keys stored under the Keychain service `com.jasonpoindexter.agent-cli.connections`.
- Project-scoped environment records. Non-secret values persist in local settings; secret values persist only in Keychain.
- MCP server records for stdio and HTTP transports with no auth, bearer auth, or an OAuth issuer.
- Target validation that resolves stdio executables through the login-shell `PATH` and rejects malformed HTTP endpoints.
- Full local reset removes all known connection secrets before clearing metadata.

Secret identifiers are namespaced as `provider:<provider>:api-key`, `mcp:<server-id>:bearer`, and `environment:<variable-id>`. Values are never written to `workspace.json`, rendered after save, logged, or placed in command arguments.

## Current Boundary

This slice configures and validates connection records. It does not yet inject stored secrets into provider or terminal processes, connect to MCP servers, perform MCP tool discovery, or execute an OAuth PKCE flow. Those behaviors remain required before `AI-CONNECTIONS` is complete.

## Verification

Run from `app/`:

```bash
npm test -- connectionSettings.test.ts ConnectionSettingsPanel.test.tsx
npm run qa:chrome-contract
npm run build
cd src-tauri && cargo test connection_secrets
```
