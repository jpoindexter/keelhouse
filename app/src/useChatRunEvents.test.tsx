// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useChatRunEvents, type ChatRunSubscriber } from "./useChatRunEvents";

describe("useChatRunEvents", () => {
  it("forwards native envelopes and removes the listener", async () => {
    let emit: Parameters<ChatRunSubscriber>[0] = () => {};
    const remove = vi.fn();
    const subscribe: ChatRunSubscriber = vi.fn(async (handler) => {
      emit = handler;
      return remove;
    });
    const onEnvelope = vi.fn();
    const { unmount } = renderHook(() => useChatRunEvents(onEnvelope, subscribe));
    await waitFor(() => expect(subscribe).toHaveBeenCalledOnce());

    const envelope = {
      chatId: "chat-1", event: { type: "run-started" }, provider: "codex" as const,
      runId: "run-1", stream: "lifecycle" as const,
    };
    act(() => emit(envelope));

    expect(onEnvelope).toHaveBeenCalledWith(envelope);
    unmount();
    expect(remove).toHaveBeenCalledOnce();
  });
});
