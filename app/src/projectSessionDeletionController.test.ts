import { describe, expect, it, vi } from "vitest";
import { emptyChatConversation } from "./chatConversation";
import { defaultComposerHarnessState } from "./composerHarness";
import type { ManagedTerminalPane } from "./managedTerminalPane";
import { createProjectSessionDeletionController } from "./projectSessionDeletionController";

const ref = <T,>(current: T) => ({ current });
const session = (id: string) => ({ id, status: "exited" as const, title: id, updatedAt: 1 });
const profile = { id: "shell", label: "Shell", command: "/bin/zsh", args: [], useLoginShell: false };
const pane: ManagedTerminalPane = {
  createdAt: 1, cwd: "/repo", exitCode: null, id: 7, label: null,
  profile, slot: 0, state: "running",
};

const createOptions = () => {
  const key = "/repo\ntwo";
  return {
    activePanes: ref<Record<string, number>>({ [key]: pane.id }),
    activeSessionId: "two",
    activeSessions: ref({ "/repo": "two" }),
    browserSessions: ref({ [key]: "http://localhost:3000" }),
    closePane: vi.fn(async () => {}),
    composerHarness: ref({ [key]: defaultComposerHarnessState() }),
    confirmDelete: vi.fn(async () => true),
    conversations: ref({ [key]: emptyChatConversation(1) }),
    deleteHistory: vi.fn(async () => {}),
    getPanes: vi.fn(() => [pane]),
    intentionallyTerminatedPaneIds: new Set<number>(),
    persistBrowserSessions: vi.fn(async () => {}),
    persistComposerHarness: vi.fn(async () => {}),
    persistSessions: vi.fn(async () => {}),
    projectPanes: ref<Record<string, ManagedTerminalPane[]>>({ [key]: [pane] }),
    removePersistedRestore: vi.fn(),
    reopenActiveWorkspace: vi.fn(async () => {}),
    sessions: ref({ "/repo": [session("one"), session("two")] }),
    setBrowserSessions: vi.fn(),
    setConversations: vi.fn(),
    setError: vi.fn(),
    snapshots: ref<Record<number, unknown>>({ [pane.id]: { rows: 24 } }),
    workspacePath: ref<string | null>("/repo"),
  };
};

describe("createProjectSessionDeletionController", () => {
  it("closes panes, removes session records, persists, and reopens the active workspace", async () => {
    const options = createOptions();
    const controller = createProjectSessionDeletionController(options);

    await controller.deleteProjectSession("/repo", session("two"));

    expect(options.closePane).toHaveBeenCalledWith(7);
    expect(options.intentionallyTerminatedPaneIds).toContain(7);
    expect(options.snapshots.current[7]).toBeUndefined();
    expect(options.deleteHistory).toHaveBeenCalledWith("/repo\ntwo");
    expect(options.activePanes.current).toEqual({});
    expect(options.projectPanes.current).toEqual({});
    expect(options.setBrowserSessions).toHaveBeenCalledWith({});
    expect(options.setConversations).toHaveBeenCalledWith({});
    expect(options.persistBrowserSessions).toHaveBeenCalledWith({});
    expect(options.persistComposerHarness).toHaveBeenCalledWith({});
    expect(options.persistSessions).toHaveBeenCalledWith(
      { "/repo": [session("one")] }, { "/repo": "one" },
    );
    expect(options.reopenActiveWorkspace).toHaveBeenCalledOnce();
  });

  it("restores pane ownership and reports the workflow error when pane shutdown fails", async () => {
    const options = createOptions();
    options.closePane.mockRejectedValueOnce(new Error("pane busy"));
    const controller = createProjectSessionDeletionController(options);

    await controller.deleteProjectSession("/repo", session("two"));

    expect(options.intentionallyTerminatedPaneIds).not.toContain(7);
    expect(options.deleteHistory).not.toHaveBeenCalled();
    expect(options.setError).toHaveBeenCalledWith(
      "Could not close this chat's terminal panes: Error: pane busy",
    );
  });

  it("does nothing when the project has only one session", async () => {
    const options = createOptions();
    options.sessions.current = { "/repo": [session("two")] };
    const controller = createProjectSessionDeletionController(options);

    await controller.deleteProjectSession("/repo", session("two"));

    expect(options.confirmDelete).not.toHaveBeenCalled();
    expect(options.closePane).not.toHaveBeenCalled();
  });
});
