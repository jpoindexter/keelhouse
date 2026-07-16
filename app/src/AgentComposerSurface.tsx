import type { ClipboardEvent, KeyboardEvent, MouseEvent } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";

import type { AgentApprovalMode } from "./agentSessionHandle";
import type { ChatProvider } from "./chatConversation";
import { ComposerContextMetadata, type ComposerContextMetadataProps } from "./ComposerContextMetadata";
import { ComposerModelPicker } from "./ComposerModelPicker";
import { ComposerReasoningPicker } from "./ComposerReasoningPicker";
import { handleComposerMenuToggle } from "./composerPopover";
import type { ComposerAttachment, ComposerReasoningEffort } from "./composerHarness";
import type { FileTreeNode } from "./fileTreeTypes";
import { AppIcon } from "./icons";
import { shortcutTitle } from "./shortcuts";

export type AgentComposerSurfaceProps = {
  activeRun: boolean; approvalMode: AgentApprovalMode; attachments: ComposerAttachment[];
  configuredModels: Partial<Record<ChatProvider, string>>; draft: string; error: string | null;
  goal: string; hasHarness: boolean; hasHistory: boolean; historyCursorActive: boolean;
  mentionResults: FileTreeNode[]; model: string; notice: string | null; provider: ChatProvider | null;
  reasoningEffort: ComposerReasoningEffort; sending: boolean; metadata: ComposerContextMetadataProps;
  onApprovalChange: (mode: AgentApprovalMode) => void; onAttachMention: (file: FileTreeNode) => void;
  onClearGoal: () => void; onContextMenu: (event: MouseEvent<HTMLDivElement>) => void;
  onDismissNotice: () => void; onDraftChange: (draft: string) => void; onGoalChange: (goal: string) => void;
  onGoalCommit: () => void; onManageModels: () => void; onNextHistory: () => void;
  onOpenAddMenu: (event: MouseEvent<HTMLButtonElement>) => void; onPasteImage: () => void; onPreviousHistory: () => void;
  onReasoningChange: (effort: ComposerReasoningEffort) => void; onRemoveAttachment: (attachment: ComposerAttachment) => void;
  onReviewContext: () => void; onRuntimeChange: (provider: ChatProvider, model: string) => void;
  onStop: () => void; onSubmit: () => void;
};

const approvalLabel = (mode: AgentApprovalMode) => mode === "fullAccess" ? "Full access" : mode === "approveSafe" ? "Approve" : "Ask";

function PermissionMenu({ props }: { props: AgentComposerSurfaceProps }) {
  const options = [
    ["ask", "Ask for approval", "Confirm edits, commands, and network access."],
    ["approveSafe", "Approve safe actions", "Run workspace-scoped actions and ask for riskier access."],
    ["fullAccess", "Full access", "Allow unrestricted file and network access."],
  ] as const;
  return (
    <details className="agent-composer__menu agent-composer__menu--permission" onToggle={handleComposerMenuToggle}>
      <summary className={`agent-composer__control ${props.approvalMode === "fullAccess" ? "agent-composer__control--warning" : ""}`}><AppIcon name="shield" /><span>{approvalLabel(props.approvalMode)}</span><AppIcon name="chevronDown" /></summary>
      <div className="agent-composer__popover agent-composer__popover--permission" role="menu" aria-label="Composer permission mode">
        <div className="agent-composer__popover-title">Permission mode</div>
        {options.map(([value, label, description]) => <button className={`agent-composer__menu-option ${props.approvalMode === value ? "agent-composer__menu-option--selected" : ""}`} type="button" role="menuitemradio" aria-checked={props.approvalMode === value} key={value} onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); props.onApprovalChange(value); }}><AppIcon name={props.approvalMode === value ? "check" : "shield"} /><span><strong>{label}</strong><small>{description}</small></span></button>)}
      </div>
    </details>
  );
}

function GoalMenu({ props }: { props: AgentComposerSurfaceProps }) {
  return (
    <details className="agent-composer__menu agent-composer__menu--goal" onToggle={handleComposerMenuToggle}>
      <summary className={`agent-composer__control ${props.goal ? "agent-composer__control--active" : ""}`}><AppIcon name="target" /><span>Goal</span></summary>
      <div className="agent-composer__popover agent-composer__popover--goal">
        <label className="agent-composer__popover-field"><span>Goal for this chat</span><input aria-label="Composer goal" value={props.goal} maxLength={160} placeholder="Optional outcome to keep in context" disabled={!props.hasHarness} onChange={(event) => props.onGoalChange(event.currentTarget.value)} onBlur={props.onGoalCommit} /></label>
        {props.goal ? <button className="agent-composer__clear" type="button" onClick={props.onClearGoal}>Clear goal</button> : null}
      </div>
    </details>
  );
}

function Attachments({ props }: { props: AgentComposerSurfaceProps }) {
  return (
    <div className="agent-composer__attachments" aria-label="Composer context">
      <button className="agent-composer__attachment-button" type="button" aria-label="Add context or action" title="Add context or action" disabled={!props.hasHarness} onClick={props.onOpenAddMenu}><AppIcon name="plus" /></button>
      <PermissionMenu props={props} /><GoalMenu props={props} />
      <div className="agent-composer__attachment-list">
        {props.attachments.map((attachment) => <span className="agent-composer__attachment" key={attachment.id} title={attachment.target}>{attachment.kind === "image" ? <img src={convertFileSrc(attachment.target)} alt="" /> : null}<span>{attachment.label}</span><button type="button" aria-label={`Remove attachment ${attachment.label}`} onClick={() => props.onRemoveAttachment(attachment)}><AppIcon name="close" /></button></span>)}
      </div>
      {props.attachments.length > 0 || props.goal ? <button className="agent-composer__control" type="button" onClick={props.onReviewContext}><AppIcon name="search" /><span>Review context</span></button> : null}
    </div>
  );
}

function RuntimeActions({ props }: { props: AgentComposerSurfaceProps }) {
  const disabled = !props.hasHarness || props.activeRun;
  return (
    <div className="agent-composer__actions">
      {props.provider ? <><ComposerReasoningPicker value={props.reasoningEffort} disabled={disabled} onSelect={props.onReasoningChange} /><ComposerModelPicker provider={props.provider} model={props.model} configuredModels={props.configuredModels} disabled={disabled} onManageModels={props.onManageModels} onSelect={props.onRuntimeChange} /></> : null}
      {props.activeRun ? <button className="agent-composer__send agent-composer__send--stop" type="button" aria-label="Stop current chat run" title="Stop current chat run" onClick={props.onStop}><AppIcon name="stop" /></button> : <button className="agent-composer__send" type="button" aria-label={props.sending ? "Sending" : "Send"} title={shortcutTitle("composer.send", "Send")} disabled={props.sending || !props.draft.trim()} onClick={props.onSubmit}><AppIcon name={props.sending ? "loading" : "send"} /></button>}
    </div>
  );
}

function MentionResults({ props }: { props: AgentComposerSurfaceProps }) {
  if (props.mentionResults.length === 0) return null;
  return <div className="agent-composer__mentions" role="listbox" aria-label="Attach workspace file">{props.mentionResults.map((file) => <button key={file.path} type="button" role="option" onClick={() => props.onAttachMention(file)}><AppIcon name="file" /><span>{file.name}</span><small>{file.path}</small></button>)}</div>;
}

export function AgentComposerSurface(props: AgentComposerSurfaceProps) {
  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if ([...event.clipboardData.types].some((type) => type.startsWith("image/"))) { event.preventDefault(); props.onPasteImage(); }
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); props.onSubmit(); }
    else if (event.key === "Escape") event.currentTarget.blur();
    else if (event.key === "ArrowUp" && !props.draft && props.hasHistory) { event.preventDefault(); props.onPreviousHistory(); }
    else if (event.key === "ArrowDown" && props.historyCursorActive) { event.preventDefault(); props.onNextHistory(); }
  };
  return (
    <div className="agent-composer" aria-label="Agent composer" onContextMenu={props.onContextMenu}>
      <div className="agent-composer__card">
        <textarea className="agent-composer__input" aria-label="Agent composer draft" value={props.draft} rows={2} placeholder="Ask Keelhouse to run agents, open files, inspect git, or use the browser..." disabled={props.sending} onChange={(event) => props.onDraftChange(event.currentTarget.value)} onPaste={handlePaste} onKeyDown={handleKeyDown} />
        <MentionResults props={props} />
        <div className="agent-composer__bar"><Attachments props={props} /><RuntimeActions props={props} /></div>
      </div>
      <ComposerContextMetadata {...props.metadata} />
      {props.error ? <div className="agent-composer__error">{props.error}</div> : null}
      {props.notice ? <div className="agent-composer__notice" role="status"><pre>{props.notice}</pre><button className="agent-composer__button" type="button" aria-label="Dismiss app command help" onClick={props.onDismissNotice}><AppIcon name="close" /></button></div> : null}
    </div>
  );
}
