import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AgentComposerSurface, type AgentComposerSurfaceProps } from "./AgentComposerSurface";

const noop = vi.fn();
const props = (overrides: Partial<AgentComposerSurfaceProps> = {}): AgentComposerSurfaceProps => ({
  activeRun: false, addMenuItems: [], approvalMode: "ask", attachments: [], configuredModels: {}, draft: "", error: null,
  goal: "", hasHarness: true, hasHistory: false, historyCursorActive: false, mentionResults: [], model: "",
  metadata: { branch: null, changedFiles: 0, provider: null, repositoryPath: null, usage: undefined, onProjectSelect: noop },
  notice: null, provider: null, reasoningEffort: "default", sending: false, onApprovalChange: noop,
  onAttachMention: noop, onClearGoal: noop, onContextMenu: noop, onDismissNotice: noop, onDraftChange: noop,
  onGoalChange: noop, onGoalCommit: noop, onManageModels: noop, onNextHistory: noop,
  onPasteImage: noop, onPreviousHistory: noop, onReasoningChange: noop, onRemoveAttachment: noop,
  onReviewContext: noop, onRuntimeChange: noop, onStop: noop, onSubmit: noop, ...overrides,
});

describe("AgentComposerSurface", () => {
  it("renders chat controls and disables an empty send", () => {
    const html = renderToStaticMarkup(<AgentComposerSurface {...props()} />);
    expect(html).toContain("Add context or action");
    expect(html).toContain("Permission mode");
    expect(html).toContain("disabled");
  });

  it("renders goal, notice, and stop states", () => {
    const html = renderToStaticMarkup(<AgentComposerSurface {...props({ activeRun: true, goal: "Ship the app", notice: "Help text" })} />);
    expect(html).toContain("Ship the app");
    expect(html).toContain("Help text");
    expect(html).toContain("Stop current chat run");
  });
});
