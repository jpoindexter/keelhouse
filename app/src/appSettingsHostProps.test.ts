import { describe, expect, it, vi } from "vitest";
import { appSettingsHostPropsFrom } from "./appSettingsHostProps";

const createOptions = () =>
  ({
    activeChat: { activeAgentProfileSetting: {}, activeApprovalSetting: {}, activeBrowserSetting: {} },
    agentHookStatus: null,
    aiConnectionSettings: {},
    chrome: { appTheme: null, notificationsEnabled: true },
    commandPaletteSources: {},
    connectionActions: {
      beginMcpOAuth: vi.fn(), disconnectMcpOAuth: vi.fn(), resetLocalData: vi.fn(),
      saveSettings: vi.fn(), validateConnectionTarget: vi.fn(),
    },
    gitStatusHook: { status: { branch: "main", files: [1, 2] } },
    keybindingOverrides: {},
    mcpOAuth: { deleteSecret: vi.fn(), saveSecret: vi.fn(), secretPresence: {}, statuses: {} },
    openUrl: vi.fn(async () => {}),
    preferenceActions: {},
    profiles: { addCustomProfile: vi.fn(), customProfiles: [], removeCustomProfile: vi.fn() },
    scopedActions: {},
    setSettingsOpen: vi.fn(),
    settingsOpen: true,
    settingsRuntime: {
      agentConnectionsRefreshing: false, agentConnectionsStatus: null, refreshAgentConnections: vi.fn(),
      repoLocation: null, sourceControlStatus: null,
    },
    shellLayout: {
      renderedWorkbenchLayout: "hidden", resetInterface: vi.fn(), setToolTrayMode: vi.fn(),
      setWorkbenchLayout: vi.fn(), toolTrayMode: "files",
    },
    surfaceLabels: { activeSessionTitle: "Chat", activeWorkspaceName: "repo" },
    utilityTrayControls: { openAgentConnection: vi.fn() },
    workspacePath: "/repo",
  }) as unknown as Parameters<typeof appSettingsHostPropsFrom>[0];

describe("appSettingsHostPropsFrom", () => {
  it("derives modal git and workspace summary props", () => {
    const props = appSettingsHostPropsFrom(createOptions());

    expect(props.open).toBe(true);
    expect(props.modal.gitBranch).toBe("main");
    expect(props.modal.gitChangeCount).toBe(2);
    expect(props.modal.workspacePath).toBe("/repo");
    expect(props.modal.sessionTitle).toBe("Chat");
  });

  it("routes settings handlers to their owning controllers", () => {
    const options = createOptions();
    const props = appSettingsHostPropsFrom(options);

    props.handlers.close();
    expect(options.setSettingsOpen).toHaveBeenCalledWith(false);
    props.handlers.openAgentConnection("codex");
    expect(options.utilityTrayControls.openAgentConnection).toHaveBeenCalledWith("codex");
  });
});
