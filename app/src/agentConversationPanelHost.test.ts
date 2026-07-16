import { describe, expect, it, vi } from "vitest";
import { agentConversationPanelPropsFrom } from "./agentConversationPanelHost";
import { defaultComposerHarnessState } from "./composerHarness";
import { emptyChatConversation } from "./chatConversation";

const createOptions = () =>
  ({
    activeAgentSession: { selectedAgentActivityLog: [] },
    activeChat: {
      activeChatConversation: { ...emptyChatConversation(0), activeRunId: null },
      activeComposerHarness: defaultComposerHarnessState("codex"),
      activeComposerHarnessKey: "/repo\nchat",
      activeComposerProvider: "codex",
    },
    aiConnectionSettings: { providerModels: {} },
    appMenuAssembly: { composerContextMenuItems: () => [], openComposerAddMenu: vi.fn() },
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
    setComposerNotice: vi.fn(),
    setSettingsOpen: vi.fn(),
    shellLayout: { agentSurfaceMode: "chat" },
    workspacePath: "/repo",
  }) as unknown as Parameters<typeof agentConversationPanelPropsFrom>[0];

describe("agentConversationPanelPropsFrom", () => {
  it("assembles chat, composer, and surface-mode props", () => {
    const props = agentConversationPanelPropsFrom(createOptions());

    expect(props.surfaceMode).toBe("chat");
    expect(props.chat.conversation.activeRunId).toBeNull();
    expect(props.composer.draft).toBe("hi");
    expect(props.composer.hasHarness).toBe(true);
    expect(props.composer.mentionResults).toEqual([]);
    expect(props.composer.metadata).toEqual({
      branch: "main",
      changedFiles: 3,
      provider: "codex",
      repositoryPath: "/repo",
      usage: undefined,
    });
  });

  it("routes composer and chat handlers to their controllers", () => {
    const options = createOptions();
    const props = agentConversationPanelPropsFrom(options);

    props.composer.onSubmit();
    expect(options.composerSurface.submitComposerDraft).toHaveBeenCalled();
    props.composer.onManageModels();
    expect(options.setSettingsOpen).toHaveBeenCalledWith(true);
    props.composer.onStop();
    expect(options.chatRunControls.stopActiveChatRun).toHaveBeenCalled();
  });
});
