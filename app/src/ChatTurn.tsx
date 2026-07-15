import type { ChatConversation, ChatMessage } from "./chatConversation";
import { chatElapsedLabel, retryPromptForTurn } from "./chatThreadHelpers";
import { ChatMessageArticle } from "./ChatMessageArticle";

type ChatTurnProps = {
  id: string; messages: ChatMessage[]; conversation: ChatConversation; providerLabel: string;
  elapsedNow: number; copiedMessageId: string | null; focusMessageId: string | null;
  onCopy: (message: ChatMessage) => void; onRetry: (prompt: string) => void;
  onApprovalDecision?: (message: ChatMessage, decision: "accept" | "acceptForSession" | "decline") => void;
  onToggleBookmark?: (message: ChatMessage) => void; onForkMessage?: (message: ChatMessage) => void;
  onReviewFile?: (path: string) => void;
};

const messagesWithContinuation = (messages: ChatMessage[]) => {
  let previous: "user" | "assistant" | null = null;
  return messages.map((message) => {
    const continuation = message.role === "assistant" && previous === "assistant";
    if (message.role === "user" || message.role === "assistant") previous = message.role;
    return { continuation, message };
  });
};

export function ChatTurn(props: ChatTurnProps) {
  const running = props.messages.some((message) => message.status === "running") && Boolean(props.conversation.activeRunId);
  const endedAt = running ? props.elapsedNow : props.messages[props.messages.length - 1]?.timestamp ?? props.messages[0].timestamp;
  const elapsed = chatElapsedLabel(props.messages[0].timestamp, endedAt);
  const retryPrompt = retryPromptForTurn(props.messages);
  return <section className="chat-turn" data-turn-id={props.id}>
    {messagesWithContinuation(props.messages).map(({ message, continuation }) => <ChatMessageArticle
      {...props}
      continuation={continuation}
      copied={props.copiedMessageId === message.id}
      focused={props.focusMessageId === message.id}
      key={message.id}
      message={message}
      retryPrompt={retryPrompt}
    />)}
    <footer className="chat-turn__elapsed">{running ? `Working ${elapsed}` : elapsed}</footer>
  </section>;
}
