import { describe, expect, it, vi } from "vitest";
import { bottomUtilityTrayPropsFrom } from "./bottomUtilityTrayHost";

const ref = <T,>(current: T) => ({ current });
const pane = { id: 1 } as never;

const createOptions = () =>
  ({
    activeAgentSession: { activeTerminalPane: pane, selectedAgentActivityLog: [] },
    activeAgentSessionHandle: { close: vi.fn() },
    activeTerminalProfile: { label: "zsh" },
    appMenuAssembly: { terminalPaneContextMenuItems: () => [], utilityTrayTabContextMenuItems: () => [] },
    canvasRef: ref(null),
    contextMenuHost: { openContextMenu: vi.fn() },
    defaultTerminalLaunchProfile: () => ({ id: "zsh" }),
    imeInputRef: ref(null),
    paste: vi.fn(),
    pickWorkspace: vi.fn(),
    profiles: {
      allProfiles: [], changing: false, resolveProfile: vi.fn(() => ({ id: "zsh" })),
      switchTerminalProfile: vi.fn(), terminalProfile: { id: "zsh" },
    },
    renameTerminalPane: vi.fn(),
    shellLayout: {
      agentSurfaceMode: "terminal", beginUtilityTrayResize: vi.fn(), setAgentSurfaceMode: vi.fn(),
      utilityTrayMode: "terminal",
    },
    terminal: { activePaneId: 1, panes: [pane] },
    terminalContextMenuItems: () => [],
    terminalFind: {},
    terminalHostRef: ref(null),
    terminalSurface: {
      createTerminalPane: vi.fn(), focusTerminalPane: vi.fn(), restartTerminalPane: vi.fn(), terminateTerminalPane: vi.fn(),
    },
    utilityTrayControls: { openUtilityTray: vi.fn(), toggleUtilityTrayVisibility: vi.fn() },
    workspacePath: "/repo",
  }) as unknown as Parameters<typeof bottomUtilityTrayPropsFrom>[0];

describe("bottomUtilityTrayPropsFrom", () => {
  it("derives tray visibility and terminal state props", () => {
    const props = bottomUtilityTrayPropsFrom(createOptions());

    expect(props.open).toBe(true);
    expect(props.hasWorkspace).toBe(true);
    expect(props.canClose).toBe(true);
    expect(props.activePaneId).toBe(1);
    expect(props.activeProfileLabel).toBe("zsh");
  });

  it("routes tray actions to the terminal and tray controllers", () => {
    const options = createOptions();
    const props = bottomUtilityTrayPropsFrom(options);

    props.onStartShell();
    expect(options.terminalSurface.createTerminalPane).toHaveBeenCalled();
    props.onKill();
    expect(options.terminalSurface.terminateTerminalPane).toHaveBeenCalledWith(pane);
    props.onToggleVisibility();
    expect(options.utilityTrayControls.toggleUtilityTrayVisibility).toHaveBeenCalled();
  });
});
