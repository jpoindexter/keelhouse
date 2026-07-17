import { useEffect, useRef, type FormEvent } from "react";

import "./ProjectCreationDialog.css";

export type WorktreeLabelDialogProps = {
  open: boolean;
  value: string;
  onCancel: () => void;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
};

export function WorktreeLabelDialog(props: WorktreeLabelDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!props.open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRef.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      props.onCancel();
    };
    window.addEventListener("keydown", keydown);
    return () => {
      window.removeEventListener("keydown", keydown);
      returnFocusRef.current?.focus();
    };
  }, [props.open, props.onCancel]);
  if (!props.open) return null;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const label = props.value.trim();
    if (label) props.onSubmit(label);
  };
  return <div className="project-create-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && props.onCancel()}>
    <form className="project-create" role="dialog" aria-modal="true" aria-labelledby="worktree-label-title" onSubmit={submit}>
      <header><div><h2 id="worktree-label-title">Create a worktree</h2><p>Choose a short label for the new branch and working directory.</p></div></header>
      <div className="project-create__fields">
        <label className="project-create__field"><span>Worktree label</span><input ref={inputRef} autoComplete="off" maxLength={80} value={props.value} onChange={(event) => props.onChange(event.currentTarget.value)} /></label>
      </div>
      <footer className="project-create__actions">
        <button type="button" onClick={props.onCancel}>Cancel</button>
        <button className="project-create__primary" type="submit" disabled={!props.value.trim()}>Create worktree</button>
      </footer>
    </form>
  </div>;
}
