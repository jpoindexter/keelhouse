// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatThreadSurface, chatElapsedLabel, isNearChatBottom } from "./ChatThreadSurface";
import type { ChatConversation } from "./chatConversation";

const resizeCallbacks: ResizeObserverCallback[] = [];

class TestResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallbacks.push(callback);
  }

  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  resizeCallbacks.length = 0;
  vi.stubGlobal("ResizeObserver", TestResizeObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const conversation = (text: string, overrides: Partial<ChatConversation> = {}): ChatConversation => ({
  provider: "codex",
  messages: [
    { id: "user-1", role: "user", text: "Check the project", timestamp: 1000 },
    { id: "assistant-1", role: "assistant", text, timestamp: 3500, status: "complete" },
  ],
  updatedAt: 3500,
  revision: 1,
  runStatus: "complete",
  ...overrides,
});

describe("ChatThreadSurface behavior", () => {
  it("formats progressive Markdown updates in place", () => {
    const view = render(
      <ChatThreadSurface conversation={conversation("**work")} events={[]} onRetry={() => {}} onSuggestion={() => {}} />,
    );
    expect(screen.queryByText("working")).toBeNull();

    view.rerender(
      <ChatThreadSurface conversation={conversation("**working**")} events={[]} onRetry={() => {}} onSuggestion={() => {}} />,
    );

    expect(screen.getByText("working").tagName).toBe("STRONG");
  });

  it("stops following after manual scroll and offers Jump to latest", () => {
    const view = render(
      <ChatThreadSurface conversation={conversation("First response")} events={[]} onRetry={() => {}} onSuggestion={() => {}} />,
    );
    const log = screen.getByRole("log", { name: "Chat messages" });
    Object.defineProperties(log, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 200 },
      scrollTop: { configurable: true, writable: true, value: 200 },
      scrollTo: {
        configurable: true,
        value: ({ top }: ScrollToOptions) => {
          log.scrollTop = Number(top ?? 0);
        },
      },
    });
    fireEvent.wheel(log, { deltaY: -100 });
    fireEvent.scroll(log);
    expect(screen.getByRole("button", { name: "Jump to latest" })).not.toBeNull();

    view.rerender(
      <ChatThreadSurface conversation={conversation("First response, now longer")} events={[]} onRetry={() => {}} onSuggestion={() => {}} />,
    );
    expect(screen.getByRole("button", { name: "Jump to latest" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Jump to latest" }));
    expect(screen.queryByRole("button", { name: "Jump to latest" })).toBeNull();
    expect(log.scrollTop).toBe(1000);
  });

  it("keeps the latest message visible when the chat viewport resizes", () => {
    render(
      <ChatThreadSurface conversation={conversation("Latest response")} events={[]} onRetry={() => {}} onSuggestion={() => {}} />,
    );
    const log = screen.getByRole("log", { name: "Chat messages" });
    Object.defineProperties(log, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 200 },
      scrollTop: { configurable: true, writable: true, value: 500 },
    });

    resizeCallbacks.forEach((callback) => callback([], {} as ResizeObserver));

    expect(log.scrollTop).toBe(1000);
    expect(screen.queryByRole("button", { name: "Jump to latest" })).toBeNull();
  });

  it("does not yank a manually scrolled transcript on resize", () => {
    render(
      <ChatThreadSurface conversation={conversation("Latest response")} events={[]} onRetry={() => {}} onSuggestion={() => {}} />,
    );
    const log = screen.getByRole("log", { name: "Chat messages" });
    Object.defineProperties(log, {
      scrollHeight: { configurable: true, value: 1000 },
      clientHeight: { configurable: true, value: 200 },
      scrollTop: { configurable: true, writable: true, value: 200 },
    });
    fireEvent.wheel(log, { deltaY: -100 });
    fireEvent.scroll(log);

    resizeCallbacks.forEach((callback) => callback([], {} as ResizeObserver));

    expect(log.scrollTop).toBe(200);
    expect(screen.getByRole("button", { name: "Jump to latest" })).not.toBeNull();
  });

  it("keeps failed output and retries the prompt that owns the turn", () => {
    const onRetry = vi.fn();
    const failed = conversation("Partial answer", {
      runStatus: "error",
      messages: [
        { id: "user-1", role: "user", text: "Check the project", timestamp: 1000 },
        { id: "assistant-1", role: "assistant", text: "Partial answer", timestamp: 2000 },
        { id: "error-1", role: "error", text: "Provider disconnected", timestamp: 3000, status: "error" },
      ],
    });
    render(<ChatThreadSurface conversation={failed} events={[]} onRetry={onRetry} onSuggestion={() => {}} />);

    expect(screen.getByText("Partial answer")).not.toBeNull();
    expect(screen.getByText("Provider disconnected")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledWith("Check the project");
  });

  it("offers message-bounded chat forks only when the provider is idle", () => {
    const onForkMessage = vi.fn();
    const view = render(
      <ChatThreadSurface
        conversation={conversation("Ready")}
        events={[]}
        onForkMessage={onForkMessage}
        onRetry={() => {}}
        onSuggestion={() => {}}
      />,
    );
    const forkButtons = screen.getAllByRole("button", { name: "Fork chat from this message" });
    expect(forkButtons).toHaveLength(2);
    fireEvent.click(forkButtons[1]);
    expect(onForkMessage).toHaveBeenCalledWith(expect.objectContaining({ id: "assistant-1" }));

    view.rerender(
      <ChatThreadSurface
        conversation={conversation("Working", { activeRunId: "run-1", runStatus: "running" })}
        events={[]}
        onForkMessage={onForkMessage}
        onRetry={() => {}}
        onSuggestion={() => {}}
      />,
    );
    expect(screen.getAllByRole("button", { name: "Fork chat from this message" }).every((button) => button.hasAttribute("disabled"))).toBe(true);
  });

  it("keeps nonfatal provider diagnostics without offering a false retry", () => {
    const completedWithDiagnostic = conversation("Completed response", {
      messages: [
        { id: "user-1", role: "user", text: "Check the project", timestamp: 1000 },
        { id: "error-1", role: "error", text: "Provider warning", timestamp: 2000, status: "error" },
        { id: "assistant-1", role: "assistant", text: "Completed response", timestamp: 3000, status: "complete" },
      ],
    });
    render(<ChatThreadSurface conversation={completedWithDiagnostic} events={[]} onRetry={() => {}} onSuggestion={() => {}} />);

    expect(screen.getByText("Provider warning")).not.toBeNull();
    expect(screen.getByText("Completed response")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("exposes compact completed and expanded failed tool states", () => {
    const withTools = conversation("Done", {
      messages: [
        { id: "user-1", role: "user", text: "Run checks", timestamp: 1000 },
        { id: "tool-1", role: "tool", title: "Ran tests", text: "2 passed", timestamp: 2000, status: "complete" },
        { id: "tool-2", role: "tool", title: "Command failed", text: "exit 1", timestamp: 2500, status: "error" },
      ],
    });
    const { container } = render(<ChatThreadSurface conversation={withTools} events={[]} onRetry={() => {}} onSuggestion={() => {}} />);
    const details = container.querySelectorAll("details");

    expect(details[0].hasAttribute("open")).toBe(false);
    expect(details[1].hasAttribute("open")).toBe(true);
    expect(screen.getByText("2 passed")).not.toBeNull();
    expect(screen.getByText("exit 1")).not.toBeNull();
  });

  it("announces run state once without making token updates a live log", () => {
    const running = conversation("Partial", {
      activeRunId: "run-1",
      runStatus: "running",
      messages: [
        { id: "user-1", role: "user", text: "Run checks", timestamp: Date.now() - 1000 },
        { id: "status-1", role: "status", title: "Codex", text: "Working", timestamp: Date.now() - 900, status: "running" },
        { id: "assistant-1", role: "assistant", text: "Partial", timestamp: Date.now(), status: "running" },
      ],
    });
    render(<ChatThreadSurface conversation={running} events={[]} onRetry={() => {}} onSuggestion={() => {}} />);

    expect(screen.getByRole("log", { name: "Chat messages" }).getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText("Codex is working.").getAttribute("aria-live")).toBe("polite");
  });

  it("shows exact provider approval context and returns the selected decision", () => {
    const onApprovalDecision = vi.fn();
    const pending = conversation("", {
      activeRunId: "run-1",
      runStatus: "running",
      messages: [
        { id: "user-1", role: "user", text: "Push the branch", timestamp: 1000 },
        {
          id: "approval-1",
          role: "tool",
          title: "Command approval",
          text: "git push origin main\nWorking directory: /repo",
          timestamp: 2000,
          status: "running",
          approvalRequestId: 41,
          approvalMethod: "item/commandExecution/requestApproval",
        },
      ],
    });
    render(
      <ChatThreadSurface
        conversation={pending}
        events={[]}
        onApprovalDecision={onApprovalDecision}
        onRetry={() => {}}
        onSuggestion={() => {}}
      />,
    );

    expect(screen.getByText(/git push origin main/)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Allow once" }));
    expect(onApprovalDecision).toHaveBeenCalledWith(
      expect.objectContaining({ approvalRequestId: 41 }),
      "accept",
    );
  });
});

describe("chat thread helpers", () => {
  it("uses a stable bottom threshold and compact elapsed labels", () => {
    expect(isNearChatBottom(1000, 750, 200)).toBe(true);
    expect(isNearChatBottom(1000, 600, 200)).toBe(false);
    expect(chatElapsedLabel(0, 2500)).toBe("3s");
    expect(chatElapsedLabel(0, 65000)).toBe("1m 5s");
  });
});
