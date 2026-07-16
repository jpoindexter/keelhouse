import { describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import type { LaunchProfile } from "./launchProfiles";
import { createTerminalPaneCommands, createWorktreePersistence } from "./terminalPaneCommands";
import type { WorktreeRecord } from "./worktrees";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => ({ activePaneId: 4, paneId: 9 })) }));

const invokeMock = vi.mocked(invoke);
const profile: LaunchProfile = {
  id: "codex", label: "Codex", command: "codex", args: [], useLoginShell: false,
};

describe("createTerminalPaneCommands", () => {
  const commands = createTerminalPaneCommands({ environmentForRoot: (root) => [`env:${root}`] });

  it("creates panes with the environment resolved for the project root", async () => {
    expect(await commands.createPane("/repo", profile)).toBe(9);
    expect(invokeMock).toHaveBeenCalledWith("create_pane", {
      path: "/repo", profile, environment: ["env:/repo"],
    });

    expect(await commands.createWorktreePane("/tmp/task", profile, "/repo")).toBe(9);
    expect(invokeMock).toHaveBeenCalledWith("create_pane", {
      path: "/tmp/task", profile, environment: ["env:/repo"],
    });
  });

  it("closes and restarts panes through the pane ids", async () => {
    expect(await commands.closePane(2)).toBe(4);
    expect(invokeMock).toHaveBeenCalledWith("close_pane", { paneId: 2 });

    const pane = { id: 5, profile } as Parameters<typeof commands.restartPane>[1];
    expect(await commands.restartPane("/repo", pane)).toBe(9);
    expect(invokeMock).toHaveBeenCalledWith("restart_pane", {
      path: "/repo", paneId: 5, profile, environment: ["env:/repo"],
    });
  });

  it("sends the clear chord and worktree removal args", async () => {
    await commands.sendClearKey();
    expect(invokeMock).toHaveBeenCalledWith("send_key", {
      code: "KeyL", text: null, shift: false, alt: false, ctrl: true, sup: false,
    });

    const worktree: WorktreeRecord = {
      branch: "agent/task", createdAt: 1, label: "task", paneId: "7", path: "/tmp/task", projectRoot: "/repo",
    };
    await commands.removeWorktree("/repo", worktree);
    expect(invokeMock).toHaveBeenCalledWith("remove_project_worktree", {
      root: "/repo", worktreePath: "/tmp/task", branch: "agent/task",
    });
  });
});

describe("createWorktreePersistence", () => {
  it("persists worktree additions and removals through the store", () => {
    const record: WorktreeRecord = {
      branch: "agent/task", createdAt: 1, label: "task", paneId: "7", path: "/tmp/task", projectRoot: "/repo",
    };
    let worktrees: WorktreeRecord[] = [];
    const saved: WorktreeRecord[][] = [];
    const persistence = createWorktreePersistence({
      save: (next) => saved.push(next),
      setWorktrees: (update) => { worktrees = update(worktrees); },
    });

    persistence.persistWorktreeRecord(record);
    expect(worktrees).toEqual([record]);
    expect(saved).toEqual([[record]]);

    persistence.persistWorktreeRemoval("7");
    expect(worktrees).toEqual([]);
    expect(saved).toEqual([[record], []]);
  });
});
