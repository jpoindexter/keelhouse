import type { ChatMessage } from "./chatConversation";
import { runCardIcon, toolStatusIcon, toolStatusLabel } from "./chatThreadHelpers";
import { AppIcon } from "./icons";
import { runCardFromChatMessage } from "./runCards";

type ChatToolMessageProps = {
  message: ChatMessage;
  copied: boolean;
  onApprovalDecision?: (message: ChatMessage, decision: "accept" | "acceptForSession" | "decline") => void;
  onCopy: (message: ChatMessage) => void;
  onReviewFile?: (path: string) => void;
};

export function ChatToolMessage({ message, copied, onApprovalDecision, onCopy, onReviewFile }: ChatToolMessageProps) {
  const runCard = runCardFromChatMessage(message);
  const expanded = message.status === "running" || message.status === "error" || ["plan", "file", "approval"].includes(runCard?.kind ?? "");
  return <details
    className={`chat-tool${runCard ? ` chat-tool--run-card chat-tool--${runCard.kind}` : ""}`}
    data-run-card-kind={runCard?.kind}
    data-run-card-provenance={runCard?.provenance}
    open={expanded}
  >
    <summary>
      <AppIcon name={runCard ? runCardIcon(runCard.kind) : toolStatusIcon(message)} />
      <span className="chat-tool__title">{message.title ?? "Activity"}</span>
      <span className="chat-tool__status">{toolStatusLabel(message)}</span>
      <AppIcon className="chat-tool__chevron" name="chevronRight" />
    </summary>
    <div className="chat-tool__body">
      <div className="chat-tool__actions">
        {runCard?.kind === "file" && runCard.targets[0] ? <button type="button" onClick={() => onReviewFile?.(runCard.targets[0])}><AppIcon name="git" /><span>Review</span></button> : null}
        <button type="button" aria-label={`Copy ${message.title ?? "activity"} output`} onClick={() => onCopy(message)}><AppIcon name={copied ? "check" : "copy"} /></button>
      </div>
      <pre>{message.text}</pre>
      {message.approvalRequestId != null && message.status === "running" ? <div className="chat-approval__actions" aria-label="Approval actions">
        <button type="button" onClick={() => onApprovalDecision?.(message, "decline")}>Deny</button>
        <button type="button" onClick={() => onApprovalDecision?.(message, "accept")}>Allow once</button>
        <button type="button" onClick={() => onApprovalDecision?.(message, "acceptForSession")}>Allow for session</button>
      </div> : null}
    </div>
  </details>;
}
