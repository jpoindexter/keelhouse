import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { agentActivityFilterLabel, agentActivityMetaLabel, agentActivityTimeLabel } from "./agentActivity";
import type { AgentActivityEvent } from "./agentActivity";
import type { ChatConversation, ChatMessage } from "./chatConversation";
import { ChatMarkdown } from "./ChatMarkdown";
import { agentActivityAccessibleLabel, agentActivityIconName, AppIcon } from "./icons";

type ChatThreadSurfaceProps = {
  conversation: ChatConversation;
  events: AgentActivityEvent[];
  hidden?: boolean;
  onSuggestion: (prompt: string) => void;
  onRetry: (prompt: string) => void;
  onApprovalDecision?: (message: ChatMessage, decision: "accept" | "acceptForSession" | "decline") => void;
  onToggleBookmark?: (message: ChatMessage) => void;
  focusMessageId?: string | null;
};

const SUGGESTIONS = [
  "Inspect this project and tell me what needs attention first.",
  "Run the relevant tests and fix the first real failure.",
  "Review the current Git changes before I commit.",
];

const messageLabel = (message: ChatMessage) => {
  if (message.role === "user") return "You";
  if (message.role === "assistant") return "Codex";
  return message.title ?? (message.role === "error" ? "Error" : "Activity");
};

const groupMessagesIntoTurns = (messages: ChatMessage[]) => {
  const turns: { id: string; messages: ChatMessage[] }[] = [];

  for (const message of messages) {
    if (message.role === "user" || turns.length === 0) {
      turns.push({ id: message.id, messages: [message] });
    } else {
      turns[turns.length - 1].messages.push(message);
    }
  }

  return turns;
};

export const isNearChatBottom = (
  scrollHeight: number,
  scrollTop: number,
  clientHeight: number,
  threshold = 56,
) => scrollHeight - scrollTop - clientHeight <= threshold;

export const chatElapsedLabel = (startedAt: number, endedAt: number) => {
  const seconds = Math.max(0, Math.round((endedAt - startedAt) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
};

const retryPromptForTurn = (messages: ChatMessage[]) =>
  messages.find((message) => message.role === "user")?.text ?? "";

const toolStatusLabel = (message: ChatMessage) => {
  if (message.status === "running") return "Running";
  if (message.status === "error") return "Failed";
  return "Done";
};

const toolStatusIcon = (message: ChatMessage) => {
  if (message.status === "running") return "loading" as const;
  if (message.status === "error") return "error" as const;
  return "check" as const;
};

function useElapsedNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

export function ChatThreadSurface({ conversation, events, hidden = false, onSuggestion, onRetry, onApprovalDecision, onToggleBookmark, focusMessageId = null }: ChatThreadSurfaceProps) {
  const threadRef = useRef<HTMLDivElement | null>(null);
  const autoFollowRef = useRef(true);
  const userScrollIntentRef = useRef(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const runningStatusIndex = conversation.messages.reduce(
    (latest, message, index) =>
      message.role === "status" && message.status === "running" ? index : latest,
    -1,
  );
  const hasProviderOutputAfterStatus = runningStatusIndex >= 0 && conversation.messages
    .slice(runningStatusIndex + 1)
    .some((message) => message.role === "assistant" || message.role === "tool" || message.role === "error");
  const visibleMessages = conversation.messages.filter((message) =>
    message.role !== "status"
      || (message.status === "running" && Boolean(conversation.activeRunId) && !hasProviderOutputAfterStatus)
  );
  const turns = groupMessagesIntoTurns(visibleMessages);
  const empty = visibleMessages.length === 0 && events.length === 0;
  const elapsedNow = useElapsedNow(Boolean(conversation.activeRunId));
  const messageUpdateToken = useMemo(() => {
    const latest = visibleMessages[visibleMessages.length - 1];
    return latest ? `${visibleMessages.length}:${latest.id}:${latest.timestamp}:${latest.status ?? ""}` : "empty";
  }, [visibleMessages]);
  const threadIdentity = visibleMessages[0]?.id ?? "empty";

  useEffect(() => {
    autoFollowRef.current = true;
    userScrollIntentRef.current = false;
  }, [threadIdentity]);

  useLayoutEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    if (autoFollowRef.current) {
      thread.scrollTop = thread.scrollHeight;
      setShowJumpToLatest(false);
    } else {
      setShowJumpToLatest(true);
    }
  }, [events.length, messageUpdateToken]);

  useLayoutEffect(() => {
    if (!focusMessageId) return;
    const target = Array.from(threadRef.current?.querySelectorAll<HTMLElement>("[data-message-id]") ?? [])
      .find((element) => element.dataset.messageId === focusMessageId);
    target?.scrollIntoView({ block: "center" });
    target?.focus({ preventScroll: true });
  }, [focusMessageId, threadIdentity]);

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

  const markUserScrollIntent = () => {
    userScrollIntentRef.current = true;
  };

  const jumpToLatest = () => {
    const thread = threadRef.current;
    if (!thread) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (typeof thread.scrollTo === "function") {
      thread.scrollTo({ top: thread.scrollHeight, behavior: reducedMotion ? "auto" : "smooth" });
    } else {
      thread.scrollTop = thread.scrollHeight;
    }
    autoFollowRef.current = true;
    userScrollIntentRef.current = false;
    setShowJumpToLatest(false);
  };

  const copyMessage = async (message: ChatMessage) => {
    await writeText(message.text);
    setCopiedMessageId(message.id);
    window.setTimeout(() => setCopiedMessageId((current) => current === message.id ? null : current), 1500);
  };

  return (
    <div className="agent-chat-surface" aria-hidden={hidden}>
      <div className="chat-response-announcer" aria-live="polite" aria-atomic="true">
        {conversation.activeRunId ? "Codex is working." : conversation.runStatus === "complete" ? "Codex response complete." : ""}
      </div>
      <div
        className="chat-thread"
        aria-label="Chat messages"
        aria-busy={Boolean(conversation.activeRunId)}
        onKeyDown={(event) => {
          if (["ArrowUp", "PageUp", "Home"].includes(event.key)) markUserScrollIntent();
        }}
        onScroll={handleScroll}
        onWheel={markUserScrollIntent}
        ref={threadRef}
        role="log"
        tabIndex={0}
      >
        <div className="chat-thread__content">
          {empty ? (
            <div className="chat-empty">
              <strong>Start a new Codex chat</strong>
              <div className="chat-empty__suggestions">
                {SUGGESTIONS.map((prompt) => (
                  <button key={prompt} type="button" onClick={() => onSuggestion(prompt)}>{prompt}</button>
                ))}
              </div>
            </div>
          ) : null}
          {turns.map((turn) => {
            let lastConversationalRole: "user" | "assistant" | null = null;
            const turnRunning = turn.messages.some((message) => message.status === "running") && Boolean(conversation.activeRunId);
            const turnEnd = turnRunning ? elapsedNow : turn.messages[turn.messages.length - 1]?.timestamp ?? turn.messages[0].timestamp;
            const elapsed = chatElapsedLabel(turn.messages[0].timestamp, turnEnd);
            const retryPrompt = retryPromptForTurn(turn.messages);
            return (
              <section className="chat-turn" data-turn-id={turn.id} key={turn.id}>
                {turn.messages.map((message) => {
                  const continuation = message.role === "assistant" && lastConversationalRole === "assistant";
                  if (message.role === "user" || message.role === "assistant") lastConversationalRole = message.role;
                  return (
                    <article
                      className={`chat-message chat-message--${message.role}${continuation ? " chat-message--continuation" : ""}${focusMessageId === message.id ? " chat-message--focused" : ""}`}
                      data-message-id={message.id}
                      key={message.id}
                      tabIndex={focusMessageId === message.id ? 0 : -1}
                    >
                      {message.role !== "tool" && !continuation ? (
                        <header>
                          <strong>{messageLabel(message)}</strong>
                          {message.status === "running" ? <span className="chat-message__running">Working</span> : null}
                        </header>
                      ) : null}
                      {message.role === "tool" ? (
                        <details className="chat-tool" open={message.status === "running" || message.status === "error"}>
                          <summary>
                            <AppIcon name={toolStatusIcon(message)} />
                            <span className="chat-tool__title">{message.title ?? "Activity"}</span>
                            <span className="chat-tool__status">{toolStatusLabel(message)}</span>
                            <AppIcon className="chat-tool__chevron" name="chevronRight" />
                          </summary>
                          <div className="chat-tool__body">
                            <button type="button" aria-label={`Copy ${message.title ?? "activity"} output`} onClick={() => void copyMessage(message)}>
                              <AppIcon name={copiedMessageId === message.id ? "check" : "copy"} />
                            </button>
                            <pre>{message.text}</pre>
                            {message.approvalRequestId != null && message.status === "running" ? (
                              <div className="chat-approval__actions" aria-label="Approval actions">
                                <button type="button" onClick={() => onApprovalDecision?.(message, "decline")}>Deny</button>
                                <button type="button" onClick={() => onApprovalDecision?.(message, "accept")}>Allow once</button>
                                <button type="button" onClick={() => onApprovalDecision?.(message, "acceptForSession")}>Allow for session</button>
                              </div>
                            ) : null}
                          </div>
                        </details>
                      ) : message.role === "assistant" ? (
                        <ChatMarkdown text={message.text} />
                      ) : (
                        <div className="chat-message__text">{message.text}</div>
                      )}
                      {message.role === "user" || message.role === "assistant" ? (
                        <div className="chat-message__actions">
                          <button type="button" aria-label={copiedMessageId === message.id ? "Message copied" : "Copy message"} onClick={() => void copyMessage(message)}>
                            <AppIcon name={copiedMessageId === message.id ? "check" : "copy"} />
                          </button>
                          <button
                            className={message.bookmarked ? "chat-message__bookmark chat-message__bookmark--active" : "chat-message__bookmark"}
                            type="button"
                            aria-label={message.bookmarked ? "Remove bookmark" : "Bookmark message"}
                            aria-pressed={Boolean(message.bookmarked)}
                            onClick={() => onToggleBookmark?.(message)}
                          >
                            <AppIcon name="bookmark" />
                          </button>
                        </div>
                      ) : null}
                      {message.role === "error" && conversation.runStatus === "error" && retryPrompt ? (
                        <button className="chat-message__retry" type="button" onClick={() => onRetry(retryPrompt)}>
                          <AppIcon name="reload" />
                          Retry
                        </button>
                      ) : null}
                    </article>
                  );
                })}
                <footer className="chat-turn__elapsed">{turnRunning ? `Working ${elapsed}` : elapsed}</footer>
              </section>
            );
          })}
          {events.length > 0 ? <section className="agent-activity-log" aria-label="App activity timeline">
            <div className="agent-activity-log__list">
              {events.map((event) => (
                <article className={`agent-thread-event agent-thread-event--${event.status}`} key={event.id}>
                  <div className="agent-thread-event__icon">
                    <AppIcon name={agentActivityIconName(event.status)} label={agentActivityAccessibleLabel(event.status, event.label)} />
                  </div>
                  <div className="agent-thread-event__body">
                    <div className="agent-thread-event__header">
                      <strong>{event.label}</strong>
                      <span>{agentActivityTimeLabel(event.timestamp)}</span>
                      <span>{agentActivityFilterLabel(event.kind)}</span>
                    </div>
                    {event.detail ? <div className="agent-thread-event__detail">{event.detail}</div> : null}
                    {agentActivityMetaLabel(event) ? <div className="agent-thread-event__meta">{agentActivityMetaLabel(event)}</div> : null}
                  </div>
                </article>
              ))}
            </div>
          </section> : null}
        </div>
      </div>
      {showJumpToLatest ? (
        <button className="chat-jump-latest" type="button" onClick={jumpToLatest}>
          <AppIcon name="chevronDown" />
          Jump to latest
        </button>
      ) : null}
    </div>
  );
}
