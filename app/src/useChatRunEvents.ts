import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";

import type { ChatRunEnvelope } from "./chatConversation";

export type ChatRunSubscriber = (
  handler: (envelope: ChatRunEnvelope) => void,
) => Promise<() => void>;

const subscribeNative: ChatRunSubscriber = (handler) =>
  listen<ChatRunEnvelope>("chat-run-event", (event) => handler(event.payload));

export function useChatRunEvents(
  onEnvelope: (envelope: ChatRunEnvelope) => void,
  subscribe: ChatRunSubscriber = subscribeNative,
) {
  const handlerRef = useRef(onEnvelope);
  handlerRef.current = onEnvelope;
  useEffect(() => {
    let disposed = false;
    let removeListener: (() => void) | null = null;
    void subscribe((envelope) => handlerRef.current(envelope)).then((remove) => {
      if (disposed) remove();
      else removeListener = remove;
    });
    return () => {
      disposed = true;
      removeListener?.();
    };
  }, [subscribe]);
}
