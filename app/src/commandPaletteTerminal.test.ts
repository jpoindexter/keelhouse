import { describe, expect, it, vi } from "vitest";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import {
  buildTerminalFindCommands,
  buildTerminalLifecycleCommands,
} from "./commandPaletteTerminal";

const pane: ManagedTerminalPane = {
  createdAt: 1,
  cwd: "/repo",
  exitCode: null,
  id: 7,
  label: "Dev",
  profile: { args: [], command: "/bin/zsh", id: "shell", label: "Shell", useLoginShell: false },
  slot: 0,
  state: "running",
};

const createInput = (activePane: ManagedTerminalPane | null = pane) => ({
  activePane,
  activePaneLabel: activePane ? "Dev" : null,
  canClose: Boolean(activePane),
  launchProfileChanging: false,
  onClear: vi.fn(),
  onClose: vi.fn(),
  onCreatePane: vi.fn(),
  onCreateWorktreePane: vi.fn(),
  onFind: vi.fn(),
  onKill: vi.fn(),
  onRemoveWorktree: vi.fn(),
  onRestart: vi.fn(),
  shortcut: vi.fn((id: string) => `shortcut:${id}`),
  terminalProfile: pane.profile,
  workspacePath: "/repo",
  worktrees: [{
    branch: "agent/dev",
    createdAt: 1,
    label: "Dev worktree",
    paneId: "7",
    path: "/tmp/dev",
    projectRoot: "/repo",
  }],
});

describe("terminal command palette builders", () => {
  it("routes find, create, and active-pane lifecycle commands", () => {
    const input = createInput();
    const commands = [
      ...buildTerminalFindCommands(input),
      ...buildTerminalLifecycleCommands(input),
    ];

    for (const id of [
      "terminal.find", "terminal.new-pane", "terminal.new-worktree-pane", "terminal.remove-worktree",
      "terminal.restart-pane", "terminal.kill-pane", "terminal.close-pane", "terminal.clear",
    ]) commands.find((command) => command.id === id)?.run();

    expect(input.onFind).toHaveBeenCalledOnce();
    expect(input.onCreatePane).toHaveBeenCalledWith(input.terminalProfile);
    expect(input.onCreateWorktreePane).toHaveBeenCalledWith(input.terminalProfile);
    expect(input.onRemoveWorktree).toHaveBeenCalledWith(7);
    expect(input.onRestart).toHaveBeenCalledWith(pane);
    expect(input.onKill).toHaveBeenCalledWith(pane);
    expect(input.onClose).toHaveBeenCalledOnce();
    expect(input.onClear).toHaveBeenCalledOnce();
  });

  it("disables pane-dependent commands when no pane is active", () => {
    const input = createInput(null);
    const commands = [
      ...buildTerminalFindCommands(input),
      ...buildTerminalLifecycleCommands(input),
    ];

    expect(commands.find((command) => command.id === "terminal.find")?.disabled).toBe(true);
    expect(commands.find((command) => command.id === "terminal.remove-worktree")?.disabled).toBe(true);
    expect(commands.find((command) => command.id === "terminal.restart-pane")?.disabled).toBe(true);
    expect(commands.find((command) => command.id === "terminal.kill-pane")?.disabled).toBe(true);
    expect(commands.find((command) => command.id === "terminal.close-pane")?.disabled).toBe(true);
    expect(commands.find((command) => command.id === "terminal.clear")?.disabled).toBe(true);
  });
});
