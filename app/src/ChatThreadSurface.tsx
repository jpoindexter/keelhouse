import { agentActivityFilterLabel, agentActivityMetaLabel, agentActivityTimeLabel } from "./agentActivity";
import type { AgentActivityEvent } from "./agentActivity";
import type { ChatConversation, ChatMessage } from "./chatConversation";
import { agentActivityAccessibleLabel, agentActivityIconName, AppIcon } from "./icons";

type ChatThreadSurfaceProps = {
  conversation: ChatConversation;
  events: AgentActivityEvent[];
  hidden?: boolean;
  onSuggestion: (prompt: string) => void;
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

export function ChatThreadSurface({ conversation, events, hidden = false, onSuggestion }: ChatThreadSurfaceProps) {
  const empty = conversation.messages.length === 0 && events.length === 0;
  return (
    <div className="agent-chat-surface" aria-hidden={hidden}>
      <div className="chat-thread" aria-label="Chat messages" aria-live="polite">
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
        {conversation.messages.map((message) => (
          <article className={`chat-message chat-message--${message.role}`} key={message.id}>
            <header>
              <strong>{messageLabel(message)}</strong>
              {message.status === "running" ? <span className="chat-message__running">Working</span> : null}
            </header>
            {message.role === "tool" ? (
              <details className="chat-tool" open={message.status === "running" || message.status === "error"}>
                <summary>{message.title ?? "Activity"}</summary>
                <pre>{message.text}</pre>
              </details>
            ) : <div className="chat-message__text">{message.text}</div>}
          </article>
        ))}
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
  );
}
