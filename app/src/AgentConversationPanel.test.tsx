import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AgentConversationPanel, type AgentConversationPanelProps } from "./AgentConversationPanel";
import { emptyChatConversation } from "./chatConversationMutations";

const props = (overrides: Partial<AgentConversationPanelProps> = {}): AgentConversationPanelProps => ({
  chat: {
    conversation: emptyChatConversation(1),
    events: [],
    focusMessageId: null,
    hidden: false,
    onApprovalDecision: vi.fn(),
    onForkMessage: vi.fn(),
    onRetry: vi.fn(),
    onReviewFile: vi.fn(),
    onSuggestion: vi.fn(),
    onToggleBookmark: vi.fn(),
  },
  composer: {
    activeRun: false, approvalMode: "ask", attachments: [], configuredModels: {},
    draft: "", error: null, goal: "", hasHarness: true, hasHistory: false,
    historyCursorActive: false, mentionResults: [], metadata: {
      branch: "main", changedFiles: 0, provider: "codex", repositoryPath: "/repo", usage: undefined,
    }, model: "", notice: null,
    provider: "codex", reasoningEffort: "medium", sending: false,
    onApprovalChange: vi.fn(), onAttachMention: vi.fn(), onClearGoal: vi.fn(),
    onContextMenu: vi.fn(), onDismissNotice: vi.fn(), onDraftChange: vi.fn(),
    onGoalChange: vi.fn(), onGoalCommit: vi.fn(), onManageModels: vi.fn(),
    onNextHistory: vi.fn(), onOpenAddMenu: vi.fn(), onPasteImage: vi.fn(),
    onPreviousHistory: vi.fn(), onReasoningChange: vi.fn(),
    onRemoveAttachment: vi.fn(), onReviewContext: vi.fn(), onRuntimeChange: vi.fn(),
    onStop: vi.fn(), onSubmit: vi.fn(),
  },
  surfaceMode: "chat",
  ...overrides,
});

describe("AgentConversationPanel", () => {
  it("renders the chat surface and composer inside the terminal panel shell", () => {
    const html = renderToStaticMarkup(<AgentConversationPanel {...props()} />);

    expect(html).toContain("terminal-panel terminal-panel--chat");
    expect(html).toContain("agent-surface agent-surface--chat");
    expect(html).toContain("agent-composer");
  });

  it("carries the active surface mode onto the panel classes", () => {
    const html = renderToStaticMarkup(<AgentConversationPanel {...props({ surfaceMode: "terminal" })} />);

    expect(html).toContain("terminal-panel terminal-panel--terminal");
    expect(html).toContain("agent-surface agent-surface--terminal");
  });
});
