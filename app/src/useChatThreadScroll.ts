import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { isNearChatBottom } from "./chatThreadHelpers";

const scrollToLatest = (thread: HTMLDivElement) => {
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  if (typeof thread.scrollTo === "function") thread.scrollTo({ top: thread.scrollHeight, behavior: reducedMotion ? "auto" : "smooth" });
  else thread.scrollTop = thread.scrollHeight;
};

function useThreadFollowEffects(
  threadRef: React.RefObject<HTMLDivElement | null>,
  autoFollowRef: React.MutableRefObject<boolean>,
  userScrollIntentRef: React.MutableRefObject<boolean>,
  identity: string,
  updateToken: string,
  eventCount: number,
  focusMessageId: string | null,
  setShowJump: (show: boolean) => void,
) {
  useEffect(() => {
    autoFollowRef.current = true;
    userScrollIntentRef.current = false;
  }, [autoFollowRef, identity, userScrollIntentRef]);
  useLayoutEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    if (autoFollowRef.current) thread.scrollTop = thread.scrollHeight;
    setShowJump(!autoFollowRef.current);
  }, [autoFollowRef, eventCount, setShowJump, threadRef, updateToken]);
  useLayoutEffect(() => {
    const thread = threadRef.current;
    if (!thread || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (!autoFollowRef.current) return;
      thread.scrollTop = thread.scrollHeight;
      setShowJump(false);
    });
    observer.observe(thread);
    return () => observer.disconnect();
  }, [autoFollowRef, threadRef]);
  useLayoutEffect(() => {
    if (!focusMessageId) return;
    const target = Array.from(threadRef.current?.querySelectorAll<HTMLElement>("[data-message-id]") ?? [])
      .find((element) => element.dataset.messageId === focusMessageId);
    target?.scrollIntoView({ block: "center" });
    target?.focus({ preventScroll: true });
  }, [focusMessageId, identity, threadRef]);
}

export function useChatThreadScroll(identity: string, updateToken: string, eventCount: number, focusMessageId: string | null) {
  const threadRef = useRef<HTMLDivElement | null>(null);
  const autoFollowRef = useRef(true);
  const userScrollIntentRef = useRef(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  useThreadFollowEffects(threadRef, autoFollowRef, userScrollIntentRef, identity, updateToken, eventCount, focusMessageId, setShowJumpToLatest);
  const markUserScrollIntent = () => { userScrollIntentRef.current = true; };
  const handleScroll = () => {
    const thread = threadRef.current;
    if (!thread) return;
    const atBottom = isNearChatBottom(thread.scrollHeight, thread.scrollTop, thread.clientHeight);
    if (atBottom) {
      autoFollowRef.current = true;
      userScrollIntentRef.current = false;
      setShowJumpToLatest(false);
    } else if (userScrollIntentRef.current) {
      autoFollowRef.current = false;
      setShowJumpToLatest(true);
    }
  };
  const jumpToLatest = () => {
    if (!threadRef.current) return;
    scrollToLatest(threadRef.current);
    autoFollowRef.current = true;
    userScrollIntentRef.current = false;
    setShowJumpToLatest(false);
  };
  return { handleScroll, jumpToLatest, markUserScrollIntent, showJumpToLatest, threadRef };
}
