import { useMemo } from "react";

import type { AgentActivityEvent } from "./agentActivity";
import { AgentActivityTimeline } from "./AgentActivityTimeline";
import { chatProviderLabel, type ChatConversation, type ChatMessage } from "./chatConversation";
import { CHAT_SUGGESTIONS, groupMessagesIntoTurns } from "./chatThreadHelpers";
import { ChatTurn } from "./ChatTurn";
import { AppIcon } from "./icons";
import { useChatThreadScroll } from "./useChatThreadScroll";
import { useElapsedNow } from "./useElapsedNow";
import { useMessageCopy } from "./useMessageCopy";

export { chatElapsedLabel, isNearChatBottom } from "./chatThreadHelpers";

export type ChatThreadSurfaceProps = {
  conversation: ChatConversation;
  events: AgentActivityEvent[];
  hidden?: boolean;
  onSuggestion: (prompt: string) => void;
  onRetry: (prompt: string) => void;
  onApprovalDecision?: (message: ChatMessage, decision: "accept" | "acceptForSession" | "decline") => void;
  onToggleBookmark?: (message: ChatMessage) => void;
  onForkMessage?: (message: ChatMessage) => void;
  onReviewFile?: (path: string) => void;
  focusMessageId?: string | null;
};

const visibleConversationMessages = (conversation: ChatConversation) => {
  const runningStatusIndex = conversation.messages.reduce((latest, message, index) =>
    message.role === "status" && message.status === "running" ? index : latest, -1);
  const providerOutputFollows = runningStatusIndex >= 0 && conversation.messages.slice(runningStatusIndex + 1)
    .some((message) => ["assistant", "tool", "error"].includes(message.role));
  return conversation.messages.filter((message) => message.role !== "status"
    || (message.status === "running" && Boolean(conversation.activeRunId) && !providerOutputFollows));
};

export function ChatThreadSurface(props: ChatThreadSurfaceProps) {
  const { conversation, events, focusMessageId = null } = props;
  const visibleMessages = visibleConversationMessages(conversation);
  const turns = groupMessagesIntoTurns(visibleMessages);
  const providerLabel = chatProviderLabel(conversation.provider);
  const elapsedNow = useElapsedNow(Boolean(conversation.activeRunId));
  const messageUpdateToken = useMemo(() => {
    const latest = visibleMessages[visibleMessages.length - 1];
    return latest ? `${visibleMessages.length}:${latest.id}:${latest.timestamp}:${latest.status ?? ""}` : "empty";
  }, [visibleMessages]);
  const threadIdentity = visibleMessages[0]?.id ?? "empty";
  const scroll = useChatThreadScroll(threadIdentity, messageUpdateToken, events.length, focusMessageId);
  const copy = useMessageCopy();
  return <div className="agent-chat-surface" aria-hidden={props.hidden ?? false}>
    <div className="chat-response-announcer" aria-live="polite" aria-atomic="true">{conversation.activeRunId ? `${providerLabel} is working.` : conversation.runStatus === "complete" ? `${providerLabel} response complete.` : ""}</div>
    <div className="chat-thread" aria-label="Chat messages" aria-busy={Boolean(conversation.activeRunId)} onKeyDown={(event) => { if (["ArrowUp", "PageUp", "Home"].includes(event.key)) scroll.markUserScrollIntent(); }} onScroll={scroll.handleScroll} onWheel={scroll.markUserScrollIntent} ref={scroll.threadRef} role="log" tabIndex={0}>
      <div className="chat-thread__content">
        {visibleMessages.length === 0 && events.length === 0 ? <div className="chat-empty"><strong>Start a new {providerLabel} chat</strong><div className="chat-empty__suggestions">{CHAT_SUGGESTIONS.map((prompt) => <button key={prompt} type="button" onClick={() => props.onSuggestion(prompt)}>{prompt}</button>)}</div></div> : null}
        {turns.map((turn) => <ChatTurn {...props} conversation={conversation} copiedMessageId={copy.copiedMessageId} elapsedNow={elapsedNow} focusMessageId={focusMessageId} id={turn.id} key={turn.id} messages={turn.messages} onCopy={(message) => void copy.copyMessage(message)} providerLabel={providerLabel} />)}
        <AgentActivityTimeline events={events} onReviewFile={props.onReviewFile} />
      </div>
    </div>
    {scroll.showJumpToLatest ? <button className="chat-jump-latest" type="button" onClick={scroll.jumpToLatest}><AppIcon name="chevronDown" />Jump to latest</button> : null}
  </div>;
}
