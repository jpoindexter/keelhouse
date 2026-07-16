import { invoke } from "@tauri-apps/api/core";
import type { LaunchProfile } from "./launchProfiles";
import { addWorktree, removeWorktreeByPaneId, type WorktreeRecord } from "./worktrees";

type OpenPaneResponse = { paneId: number };

type TerminalPaneCommandsOptions<TEnvironment> = {
  environmentForRoot: (root: string) => TEnvironment;
};

export const createTerminalPaneCommands = <TEnvironment,>(
  options: TerminalPaneCommandsOptions<TEnvironment>,
) => ({
  closePane: async (paneId: number) =>
    (await invoke<{ activePaneId: number | null }>("close_pane", { paneId })).activePaneId,
  createPane: async (root: string, profile: LaunchProfile) =>
    (await invoke<OpenPaneResponse>("create_pane", {
      path: root, profile, environment: options.environmentForRoot(root),
    })).paneId,
  createWorktree: (root: string, label: string) =>
    invoke<{ branch: string; path: string }>("create_project_worktree", { root, label }),
  createWorktreePane: async (path: string, profile: LaunchProfile, projectRoot: string) =>
    (await invoke<OpenPaneResponse>("create_pane", {
      path, profile, environment: options.environmentForRoot(projectRoot),
    })).paneId,
  focusPane: (paneId: number) => invoke("focus_pane", { paneId }),
  paste: (text: string) => invoke("paste", { text }),
  removeWorktree: (root: string, worktree: WorktreeRecord) =>
    invoke("remove_project_worktree", {
      root, worktreePath: worktree.path, branch: worktree.branch,
    }),
  restartPane: async (root: string, pane: { id: number; profile: LaunchProfile }) =>
    (await invoke<OpenPaneResponse>("restart_pane", {
      path: root, paneId: pane.id, profile: pane.profile,
      environment: options.environmentForRoot(root),
    })).paneId,
  sendClearKey: () => invoke("send_key", {
    code: "KeyL", text: null, shift: false, alt: false, ctrl: true, sup: false,
  }),
  terminatePane: (paneId: number) => invoke("terminate_pane", { paneId }),
});

type WorktreePersistenceOptions = {
  save: (next: WorktreeRecord[]) => void;
  setWorktrees: (update: (current: WorktreeRecord[]) => WorktreeRecord[]) => void;
};

export const createWorktreePersistence = (options: WorktreePersistenceOptions) => {
  const persist = (update: (current: WorktreeRecord[]) => WorktreeRecord[]) => {
    options.setWorktrees((current) => {
      const next = update(current);
      options.save(next);
      return next;
    });
  };
  return {
    persistWorktreeRecord: (record: WorktreeRecord) =>
      persist((current) => addWorktree(current, record)),
    persistWorktreeRemoval: (paneId: string) =>
      persist((current) => removeWorktreeByPaneId(current, paneId)),
  };
};
