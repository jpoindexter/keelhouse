import type { ChatConversation, ChatMessage } from "./chatConversation";
import { messageLabel } from "./chatThreadHelpers";
import { ChatMarkdown } from "./ChatMarkdown";
import { ChatToolMessage } from "./ChatToolMessage";
import { AppIcon } from "./icons";

type ChatMessageArticleProps = {
  message: ChatMessage; conversation: ChatConversation; providerLabel: string; continuation: boolean;
  focused: boolean; copied: boolean; retryPrompt: string;
  onCopy: (message: ChatMessage) => void; onRetry: (prompt: string) => void;
  onApprovalDecision?: (message: ChatMessage, decision: "accept" | "acceptForSession" | "decline") => void;
  onToggleBookmark?: (message: ChatMessage) => void; onForkMessage?: (message: ChatMessage) => void;
  onReviewFile?: (path: string) => void;
};

function MessageActions({ message, conversation, copied, onCopy, onForkMessage, onToggleBookmark }: Pick<ChatMessageArticleProps, "message" | "conversation" | "copied" | "onCopy" | "onForkMessage" | "onToggleBookmark">) {
  return <div className="chat-message__actions">
    <button type="button" aria-label={copied ? "Message copied" : "Copy message"} onClick={() => onCopy(message)}><AppIcon name={copied ? "check" : "copy"} /></button>
    <button type="button" aria-label="Fork chat from this message" title="Fork chat from this message" disabled={Boolean(conversation.activeRunId)} onClick={() => onForkMessage?.(message)}><AppIcon name="git" /></button>
    <button className={message.bookmarked ? "chat-message__bookmark chat-message__bookmark--active" : "chat-message__bookmark"} type="button" aria-label={message.bookmarked ? "Remove bookmark" : "Bookmark message"} aria-pressed={Boolean(message.bookmarked)} onClick={() => onToggleBookmark?.(message)}><AppIcon name="bookmark" /></button>
  </div>;
}

export function ChatMessageArticle(props: ChatMessageArticleProps) {
  const { message, continuation, focused } = props;
  const conversational = message.role === "user" || message.role === "assistant";
  return <article className={`chat-message chat-message--${message.role}${continuation ? " chat-message--continuation" : ""}${focused ? " chat-message--focused" : ""}`} data-message-id={message.id} tabIndex={focused ? 0 : -1}>
    {message.role !== "tool" && !continuation ? <header><strong>{messageLabel(message, props.providerLabel)}</strong>{message.status === "running" ? <span className="chat-message__running">Working</span> : null}</header> : null}
    {message.role === "tool" ? <ChatToolMessage message={message} copied={props.copied} onApprovalDecision={props.onApprovalDecision} onCopy={props.onCopy} onReviewFile={props.onReviewFile} />
      : message.role === "assistant" ? <ChatMarkdown text={message.text} />
        : <div className="chat-message__text">{message.text}</div>}
    {conversational ? <MessageActions {...props} /> : null}
    {message.role === "error" && props.conversation.runStatus === "error" && props.retryPrompt ? <button className="chat-message__retry" type="button" onClick={() => props.onRetry(props.retryPrompt)}><AppIcon name="reload" />Retry</button> : null}
  </article>;
}
