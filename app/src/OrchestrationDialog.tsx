import { useEffect, useMemo, useState } from "react";

import type { AgentApprovalMode } from "./agentSessionHandle";
import type { ChatProvider } from "./chatConversation";
import {
  MAX_ORCHESTRATION_CHILDREN,
  MIN_ORCHESTRATION_CHILDREN,
  buildOrchestrationPreview,
  newOrchestrationChild,
  type OrchestrationChildDraft,
} from "./chatOrchestration";
import { AppIcon } from "./icons";

type OrchestrationDialogProps = {
  open: boolean;
  projectPath: string;
  parentTitle: string;
  provider: ChatProvider;
  approvalMode: AgentApprovalMode;
  activeRunCount: number;
  launching: boolean;
  error: string | null;
  onClose: () => void;
  onLaunch: (children: OrchestrationChildDraft[]) => void;
};

export function OrchestrationDialog(props: OrchestrationDialogProps) {
  const [children, setChildren] = useState<OrchestrationChildDraft[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const preview = useMemo(() => buildOrchestrationPreview(children, props.activeRunCount), [children, props.activeRunCount]);

  useEffect(() => {
    if (!props.open) return;
    setChildren([
      newOrchestrationChild(0, props.provider, props.approvalMode),
      newOrchestrationChild(1, props.provider, props.approvalMode),
    ]);
    setReviewing(false);
  }, [props.approvalMode, props.open, props.provider]);

  useEffect(() => {
    if (!props.open || props.launching) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      props.onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [props.launching, props.onClose, props.open]);

  if (!props.open) return null;

  const updateChild = (id: string, patch: Partial<OrchestrationChildDraft>) => {
    setChildren((current) => current.map((child) => child.id === id ? { ...child, ...patch } : child));
    setReviewing(false);
  };

  return (
    <div className="orchestration-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !props.launching && props.onClose()}>
      <section className="orchestration-dialog" role="dialog" aria-modal="true" aria-labelledby="orchestration-title">
        <header className="orchestration-dialog__header">
          <div>
            <h2 id="orchestration-title">Parallel child chats</h2>
            <p>{props.parentTitle} · {props.projectPath}</p>
          </div>
          <button type="button" aria-label="Close parallel dispatch" title="Close" disabled={props.launching} onClick={props.onClose}>
            <AppIcon name="close" />
          </button>
        </header>

        {reviewing ? (
          <div className="orchestration-review">
            <div className="orchestration-review__summary">
              <strong>{children.length} child chats</strong>
              <span>{props.activeRunCount + children.length} of 8 concurrent slots</span>
              <span>{Math.ceil(preview.totalBudgetSeconds / 60)} total budget minutes</span>
            </div>
            {preview.children.map((child, index) => (
              <div className="orchestration-review__row" key={child.id}>
                <AppIcon name={child.worktreeMode === "isolated" ? "git" : "agent"} />
                <span><strong>{child.title || `Agent ${index + 1}`}</strong><small>{child.task}</small></span>
                <span>{child.provider} · {child.approvalMode} · {Math.ceil(child.budgetSeconds / 60)}m</span>
              </div>
            ))}
            {preview.warnings.map((warning) => <p className="orchestration-message orchestration-message--warning" key={warning}>{warning}</p>)}
            {preview.errors.map((error) => <p className="orchestration-message orchestration-message--error" key={error}>{error}</p>)}
          </div>
        ) : (
          <div className="orchestration-editor">
            {children.map((child, index) => (
              <fieldset className="orchestration-child" key={child.id}>
                <legend>Child {index + 1}</legend>
                <label className="orchestration-field orchestration-field--title">
                  <span>Name</span>
                  <input value={child.title} maxLength={80} onChange={(event) => updateChild(child.id, { title: event.currentTarget.value })} />
                </label>
                <label className="orchestration-field orchestration-field--task">
                  <span>Task</span>
                  <textarea value={child.task} rows={3} onChange={(event) => updateChild(child.id, { task: event.currentTarget.value })} />
                </label>
                <label className="orchestration-field orchestration-field--targets">
                  <span>Files</span>
                  <input value={child.targetFiles} placeholder="src/auth.ts, tests/auth.test.ts" onChange={(event) => updateChild(child.id, { targetFiles: event.currentTarget.value })} />
                </label>
                <label className="orchestration-field">
                  <span>Provider</span>
                  <select value={child.provider} onChange={(event) => updateChild(child.id, { provider: event.currentTarget.value as ChatProvider })}>
                    <option value="codex">Codex</option>
                    <option value="claude">Claude</option>
                  </select>
                </label>
                <label className="orchestration-field">
                  <span>Model</span>
                  <input value={child.model} placeholder="Provider default" maxLength={128} onChange={(event) => updateChild(child.id, { model: event.currentTarget.value })} />
                </label>
                <label className="orchestration-field">
                  <span>Permission</span>
                  <select value={child.approvalMode} onChange={(event) => updateChild(child.id, { approvalMode: event.currentTarget.value as AgentApprovalMode })}>
                    <option value="ask">Ask</option>
                    <option value="approveSafe">Approve safe</option>
                    <option value="fullAccess">Full access</option>
                  </select>
                </label>
                <label className="orchestration-field">
                  <span>Budget</span>
                  <select value={child.budgetSeconds} onChange={(event) => updateChild(child.id, { budgetSeconds: Number(event.currentTarget.value) })}>
                    <option value={300}>5 minutes</option>
                    <option value={900}>15 minutes</option>
                    <option value={1800}>30 minutes</option>
                    <option value={3600}>60 minutes</option>
                  </select>
                </label>
                <label className="orchestration-field">
                  <span>Workspace</span>
                  <select value={child.worktreeMode} onChange={(event) => updateChild(child.id, { worktreeMode: event.currentTarget.value as OrchestrationChildDraft["worktreeMode"] })}>
                    <option value="shared">Shared project</option>
                    <option value="isolated">New worktree</option>
                  </select>
                </label>
                <button className="orchestration-child__remove" type="button" aria-label={`Remove child ${index + 1}`} disabled={children.length <= MIN_ORCHESTRATION_CHILDREN} onClick={() => setChildren((current) => current.filter((item) => item.id !== child.id))}>
                  <AppIcon name="close" />
                </button>
              </fieldset>
            ))}
            <button className="orchestration-add" type="button" disabled={children.length >= MAX_ORCHESTRATION_CHILDREN} onClick={() => setChildren((current) => [...current, newOrchestrationChild(current.length, props.provider, props.approvalMode)])}>
              <AppIcon name="plus" />
              <span>Add child</span>
            </button>
          </div>
        )}

        {props.error ? <p className="orchestration-message orchestration-message--error">{props.error}</p> : null}
        <footer className="orchestration-dialog__footer">
          <button type="button" disabled={props.launching} onClick={reviewing ? () => setReviewing(false) : props.onClose}>{reviewing ? "Back" : "Cancel"}</button>
          {reviewing ? (
            <button className="orchestration-dialog__primary" type="button" disabled={props.launching || preview.errors.length > 0} onClick={() => props.onLaunch(preview.children)}>
              {props.launching ? "Launching…" : `Launch ${children.length}`}
            </button>
          ) : (
            <button className="orchestration-dialog__primary" type="button" disabled={preview.errors.length > 0} onClick={() => setReviewing(true)}>Review dispatch</button>
          )}
        </footer>
      </section>
    </div>
  );
}
