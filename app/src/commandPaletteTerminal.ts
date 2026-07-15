import type { LaunchProfile } from "./launchProfiles";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import type { SearchDialogCommand } from "./SearchCommandDialog";
import { worktreeForPaneId, type WorktreeRecord } from "./worktrees";

type TerminalCommandInput = {
  activePane: ManagedTerminalPane | null;
  activePaneLabel: string | null;
  canClose: boolean;
  launchProfileChanging: boolean;
  onClear: () => void;
  onClose: () => void;
  onCreatePane: (profile: LaunchProfile) => void;
  onCreateWorktreePane: (profile: LaunchProfile) => void;
  onFind: () => void;
  onKill: (pane: ManagedTerminalPane) => void;
  onRemoveWorktree: (paneId: number) => void;
  onRestart: (pane: ManagedTerminalPane) => void;
  shortcut: (id: string) => string;
  terminalProfile: LaunchProfile;
  workspacePath: string | null;
  worktrees: WorktreeRecord[];
};

const basename = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? path;

export const buildTerminalFindCommands = (input: TerminalCommandInput): SearchDialogCommand[] => [{
  id: "terminal.find",
  label: "Find in Terminal",
  detail: input.activePane ? "Search the selected pane's scrollback" : "Start a pane to search its output",
  icon: "search",
  disabled: !input.activePane,
  keywords: ["scrollback", "search", "output", "terminal"],
  run: input.onFind,
}];

const creationCommands = (input: TerminalCommandInput): SearchDialogCommand[] => [{
  id: "terminal.new-pane",
  label: `New ${input.terminalProfile.label} Pane`,
  detail: input.workspacePath ? basename(input.workspacePath) : "Open a folder before creating a pane",
  icon: "terminal",
  disabled: !input.workspacePath || input.launchProfileChanging,
  keywords: ["agent", "terminal", "claude", "codex"],
  run: () => input.onCreatePane(input.terminalProfile),
}, {
  id: "terminal.new-worktree-pane",
  label: "New Worktree Pane",
  detail: input.workspacePath ? `Disposable git worktree in ${basename(input.workspacePath)}` : "Open a folder before creating a worktree",
  icon: "terminal",
  disabled: !input.workspacePath || input.launchProfileChanging,
  keywords: ["worktree", "branch", "parallel", "agent", "terminal"],
  run: () => input.onCreateWorktreePane(input.terminalProfile),
}];

const worktreeCommands = (input: TerminalCommandInput): SearchDialogCommand[] => {
  const paneId = input.activePane ? String(input.activePane.id) : null;
  const worktree = worktreeForPaneId(input.worktrees, paneId);
  return [{
    id: "terminal.remove-worktree",
    label: "Remove Worktree",
    detail: input.activePane ? worktree?.branch ?? "Selected pane has no worktree" : "No pane selected",
    icon: "close",
    disabled: !input.activePane || !worktree,
    keywords: ["worktree", "branch", "cleanup", "delete"],
    run: () => { if (input.activePane) input.onRemoveWorktree(input.activePane.id); },
  }];
};

const processCommands = (input: TerminalCommandInput): SearchDialogCommand[] => {
  const detail = input.activePaneLabel ?? "No pane selected";
  return [{
    id: "terminal.restart-pane", label: "Restart Selected Process", detail, icon: "reload",
    disabled: !input.activePane || input.launchProfileChanging, keywords: ["agent", "terminal"],
    run: () => { if (input.activePane) input.onRestart(input.activePane); },
  }, {
    id: "terminal.kill-pane", label: "Kill Selected Process", detail, icon: "stop",
    disabled: !input.activePane || input.activePane.state === "exited", keywords: ["agent", "terminal", "stop"],
    run: () => { if (input.activePane) input.onKill(input.activePane); },
  }, {
    id: "terminal.close-pane", label: "Close Selected Pane", detail, icon: "close",
    disabled: !input.canClose, keywords: ["agent", "terminal"], run: input.onClose,
  }, {
    id: "terminal.clear", label: "Clear Terminal", detail, shortcut: input.shortcut("terminal.clear"),
    icon: "terminal", disabled: !input.activePane, keywords: ["agent", "screen"], run: input.onClear,
  }];
};

export const buildTerminalLifecycleCommands = (
  input: TerminalCommandInput,
): SearchDialogCommand[] => [
  ...creationCommands(input),
  ...worktreeCommands(input),
  ...processCommands(input),
];
