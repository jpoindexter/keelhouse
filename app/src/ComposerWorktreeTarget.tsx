import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { composerAddMenuPosition } from "./ComposerAddMenu";
import { AppIcon } from "./icons";
import type { WorktreeRecord } from "./worktrees";
import "./ComposerWorktreeTarget.css";

type Props = {
  activePaneId: number | null;
  onLocal: () => void;
  onNew: () => void;
  onSelect: (paneId: number) => void;
  worktrees: WorktreeRecord[];
};

const activeWorktree = (props: Props) => props.worktrees.find((item) => item.paneId === String(props.activePaneId));

export function ComposerWorktreeTarget(props: Props) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const current = activeWorktree(props);
  const rows = ["local", ...props.worktrees.map((item) => item.paneId), "new"];
  useEffect(() => {
    if (!open) return;
    setActiveIndex(current ? props.worktrees.indexOf(current) + 1 : 0); menuRef.current?.focus();
    const close = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node) && event.target !== triggerRef.current) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => { document.removeEventListener("pointerdown", close); triggerRef.current?.focus(); };
  }, [open]);
  const choose = (id: string) => {
    setOpen(false);
    if (id === "local") props.onLocal();
    else if (id === "new") props.onNew();
    else props.onSelect(Number(id));
  };
  const keyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => (index + (event.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length); }
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(rows[activeIndex]); }
  };
  const position = open && triggerRef.current ? composerAddMenuPosition(triggerRef.current.getBoundingClientRect(), { height: window.innerHeight, width: window.innerWidth }) : undefined;
  return <>
    <button ref={triggerRef} type="button" aria-haspopup="menu" aria-expanded={open} aria-label={`Choose execution target, ${current?.label ?? "Local"}`} onClick={() => setOpen((value) => !value)}>{current?.label ?? "Local"}</button>
    {open ? <div ref={menuRef} className="composer-worktree-target" role="menu" aria-label="Execution target" tabIndex={-1} style={position} onKeyDown={keyDown}>
      <button type="button" role="menuitemradio" aria-checked={!current} aria-label="Work locally" className={activeIndex === 0 ? "is-active" : ""} onClick={() => choose("local")}><AppIcon name={!current ? "check" : "terminal"} /><span><strong>Work locally</strong><small>Use the active project folder</small></span></button>
      {props.worktrees.map((item, index) => <button type="button" role="menuitemradio" aria-checked={item === current} aria-label={`${item.label}, ${item.branch}`} className={activeIndex === index + 1 ? "is-active" : ""} key={item.paneId} onClick={() => choose(item.paneId)}><AppIcon name={item === current ? "check" : "workspace"} /><span><strong>{item.label}</strong><small>{item.branch}</small></span></button>)}
      <button type="button" role="menuitem" aria-label="New worktree…" className={activeIndex === rows.length - 1 ? "is-active" : ""} onClick={() => choose("new")}><AppIcon name="plus" /><span><strong>New worktree…</strong><small>Create an isolated branch and terminal</small></span></button>
    </div> : null}
  </>;
}
