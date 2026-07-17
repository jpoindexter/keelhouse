import { describe, expect, it, vi } from "vitest";
import { agentConversationPanelPropsFrom } from "./agentConversationPanelHost";
import { defaultComposerHarnessState } from "./composerHarness";
import { emptyChatConversation } from "./chatConversation";

const createOptions = () =>
  ({
    activeAgentSession: { activeTerminalPane: { id: 8 }, selectedAgentActivityLog: [] },
    activeChat: {
      activeSessionId: "chat",
      activeChatConversation: { ...emptyChatConversation(0), activeRunId: null },
      activeComposerHarness: defaultComposerHarnessState("codex"),
      activeComposerHarnessKey: "/repo\nchat",
      activeComposerProvider: "codex",
    },
    aiConnectionSettings: { providerModels: {} },
    appMenuAssembly: { composerAddMenuItems: () => [], composerContextMenuItems: () => [] },
    chatConversationActions: { forkFromMessage: vi.fn(), toggleBookmark: vi.fn() },
    chatRunControls: { resolveChatApproval: vi.fn(), stopActiveChatRun: vi.fn() },
    composerAttachments: {
      attachWorkspaceFile: vi.fn(), pasteImage: vi.fn(), removeAttachment: vi.fn(), reviewContext: vi.fn(),
    },
    composerError: null,
    composerHistoryNavigation: { showNext: vi.fn(), showPrevious: vi.fn() },
    composerLocal: { draft: "hi", history: [], historyIndex: null, setHistoryIndex: vi.fn(), setLocalState: vi.fn() },
    composerMentionQuery: null,
    composerMentionResults: [],
    composerNotice: null,
    composerSending: false,
    composerSettingsActions: {
      setApprovalMode: vi.fn(), setGoal: vi.fn(), setReasoningEffort: vi.fn(), setRuntime: vi.fn(),
    },
    composerSurface: { submitComposerDraft: vi.fn() },
    contextMenuHost: { openContextMenu: vi.fn() },
    editorSurface: { reviewRunCardFile: vi.fn() },
    focusedChatMessageId: null,
    gitStatusHook: {
      status: { branch: "main", staged: 1, unstaged: 2, untracked: 1, files: [{}, {}, {}] },
    },
    projectEntryActions: { chooseProject: vi.fn() },
    profiles: { terminalProfile: { id: "default", label: "Default" } },
    setComposerNotice: vi.fn(),
    openSettings: vi.fn(),
    setSettingsOpen: vi.fn(),
    shellLayout: { agentSurfaceMode: "chat" },
    terminal: { panesForSession: vi.fn(() => [{ id: 3 }, { id: 8 }]) },
    terminalSurface: { createTerminalPane: vi.fn(), createWorktreePane: vi.fn(), focusTerminalPane: vi.fn() },
    worktrees: [
      { paneId: "8", projectRoot: "/repo", path: "/wt/api", branch: "worktree/api", label: "API", createdAt: 1 },
      { paneId: "9", projectRoot: "/other", path: "/wt/other", branch: "worktree/other", label: "Other", createdAt: 1 },
    ],
    workspacePath: "/repo",
  }) as unknown as Parameters<typeof agentConversationPanelPropsFrom>[0];

describe("agentConversationPanelPropsFrom", () => {
  it("assembles chat, composer, and surface-mode props", () => {
    const options = createOptions();
    const props = agentConversationPanelPropsFrom(options);

    expect(props.surfaceMode).toBe("chat");
    expect(props.chat.conversation.activeRunId).toBeNull();
    expect(props.composer.draft).toBe("hi");
    expect(props.composer.hasHarness).toBe(true);
    expect(props.composer.mentionResults).toEqual([]);
    expect(props.composer.metadata).toMatchObject({
      branch: "main",
      changedFiles: 3,
      provider: "codex",
      repositoryPath: "/repo",
      usage: undefined,
      onProjectSelect: options.projectEntryActions.chooseProject,
      worktreeTarget: {
        activePaneId: 8,
        worktrees: [options.worktrees[0]],
      },
    });
  });

  it("routes composer and chat handlers to their controllers", () => {
    const options = createOptions();
    const props = agentConversationPanelPropsFrom(options);

    props.composer.onSubmit();
    expect(options.composerSurface.submitComposerDraft).toHaveBeenCalled();
    props.composer.onManageModels();
    expect(options.openSettings).toHaveBeenCalledWith("connections");
    props.composer.onStop();
    expect(options.chatRunControls.stopActiveChatRun).toHaveBeenCalled();
    props.composer.metadata.worktreeTarget?.onLocal();
    expect(options.terminalSurface.focusTerminalPane).toHaveBeenCalledWith(3);
    props.composer.metadata.worktreeTarget?.onSelect(8);
    expect(options.terminalSurface.focusTerminalPane).toHaveBeenCalledWith(8);
    props.composer.metadata.worktreeTarget?.onNew();
    expect(options.terminalSurface.createWorktreePane).toHaveBeenCalledWith(options.profiles.terminalProfile);
  });
});
