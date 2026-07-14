import type { InvokeArgs } from "@tauri-apps/api/core";
import { mockConvertFileSrc, mockIPC, mockWindows } from "@tauri-apps/api/mocks";

const QA_ROOT = "/Users/jason/Projects/keelhouse";
const QA_SESSION_ID = "qa-chrome-pass";
const QA_CHAT_ID = `${QA_ROOT}\n${QA_SESSION_ID}`;
const QA_NOW = Date.UTC(2026, 6, 14, 12, 0, 0);

const qaStore = new Map<string, unknown>([
  ["folder", QA_ROOT],
  ["recentFolders", [QA_ROOT]],
  ["openProjects", [{ path: QA_ROOT, status: "running" }]],
  ["projectSessions", {
    [QA_ROOT]: [
      { id: QA_SESSION_ID, title: "Chrome quality pass", status: "running", updatedAt: QA_NOW },
      { id: "qa-provider-recovery", title: "Provider recovery", status: "exited", updatedAt: QA_NOW - 3_600_000 },
      { id: "qa-narrow-layout", title: "Narrow layout QA", status: "exited", updatedAt: QA_NOW - 7_200_000 },
    ],
  }],
  ["activeSessionByProject", { [QA_ROOT]: QA_SESSION_ID }],
]);

export const browserQaFixture = {
  root: QA_ROOT,
  chatId: QA_CHAT_ID,
  files: [
    { id: `${QA_ROOT}/README.md`, name: "README.md", path: `${QA_ROOT}/README.md`, kind: "file" },
    { id: `${QA_ROOT}/PRD.md`, name: "PRD.md", path: `${QA_ROOT}/PRD.md`, kind: "file" },
    { id: `${QA_ROOT}/ROADMAP.md`, name: "ROADMAP.md", path: `${QA_ROOT}/ROADMAP.md`, kind: "file" },
    {
      id: `${QA_ROOT}/app`,
      name: "app",
      path: `${QA_ROOT}/app`,
      kind: "directory",
      children: [
        { id: `${QA_ROOT}/app/src`, name: "src", path: `${QA_ROOT}/app/src`, kind: "directory", children: [] },
      ],
    },
  ],
  conversation: {
    provider: "codex",
    messages: [
      {
        id: "qa-user",
        role: "user",
        text: "Keep the chrome compact when the window narrows.",
        timestamp: QA_NOW - 60_000,
      },
      {
        id: "qa-assistant",
        role: "assistant",
        text: "The tool tray now preserves icons, keeps the active label, and removes inactive labels before controls collide.",
        timestamp: QA_NOW,
      },
    ],
    updatedAt: QA_NOW,
    revision: 2,
    runStatus: "complete",
  },
} as const;

const payloadValue = <T>(payload: InvokeArgs | undefined, key: string): T | undefined =>
  payload && typeof payload === "object" ? (payload as Record<string, unknown>)[key] as T | undefined : undefined;

export const createBrowserQaIpcHandler = () => async (command: string, payload?: InvokeArgs): Promise<unknown> => {
  switch (command) {
    case "plugin:store|load":
      return 1;
    case "plugin:store|entries":
      return Array.from(qaStore.entries());
    case "plugin:store|get": {
      const key = payloadValue<string>(payload, "key") ?? "";
      return [qaStore.get(key), qaStore.has(key)];
    }
    case "plugin:store|set": {
      const key = payloadValue<string>(payload, "key");
      if (key) qaStore.set(key, payloadValue(payload, "value"));
      return null;
    }
    case "plugin:store|delete": {
      const key = payloadValue<string>(payload, "key");
      return key ? qaStore.delete(key) : false;
    }
    case "plugin:store|save":
    case "plugin:store|reload":
    case "plugin:store|clear":
    case "plugin:store|reset":
      return null;
    case "resolve_workspace":
      return { root: payloadValue<string>(payload, "path") ?? QA_ROOT };
    case "list_workspace_tree":
      return { root: QA_ROOT, nodes: browserQaFixture.files, truncated: false };
    case "load_chat_conversations":
      return { [QA_CHAT_ID]: browserQaFixture.conversation };
    case "migrate_chat_conversations":
      return { imported: 0, alreadyCompleted: true };
    case "git_status":
      return { isRepository: true, branch: "main", ahead: 0, behind: 0, staged: 0, unstaged: 0, untracked: 0, files: [] };
    case "git_remote_url":
      return "https://github.com/example/keelhouse.git";
    case "source_control_status":
      return {
        git: { installed: true, authenticated: null, account: null },
        gh: { installed: true, authenticated: true, account: "jason" },
        glab: { installed: false, authenticated: null, account: null },
      };
    case "agent_connections_status":
      return {
        providers: [
          { id: "codex", label: "Codex", installed: true, version: "qa", authenticated: true, structuredChat: true },
          { id: "gemini", label: "Gemini", installed: true, version: "qa", authenticated: false, structuredChat: false },
          { id: "claude", label: "Claude", installed: true, version: "qa", authenticated: false, structuredChat: true },
        ],
      };
    case "connection_secret_status":
      return { key: payloadValue<string>(payload, "key") ?? "", present: false };
    case "agent_hook_status":
      return { endpoint: "qa://agent-hook", configPath: "/tmp/keelhouse-qa-hook.json", running: true };
    case "take_agent_hook_requests":
      return [];
    case "begin_session":
      return false;
    default:
      return null;
  }
};

export const setupBrowserQa = () => {
  mockWindows("main");
  mockConvertFileSrc("macos");
  mockIPC(createBrowserQaIpcHandler(), { shouldMockEvents: true });
  document.documentElement.dataset.browserQa = "true";
};
