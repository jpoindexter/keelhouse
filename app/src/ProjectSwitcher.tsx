import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { AppIcon } from "./icons";
import { PROJECT_ENTRY_LABELS } from "./projectEntryActions";
import type { OpenProject } from "./workspaceState";
import "./ProjectSwitcher.css";

export type ProjectSwitcherItem = {
  current: boolean;
  name: string;
  open: boolean;
  path: string;
};

export type ProjectSwitcherProps = {
  activeProjectPath: string | null;
  open: boolean;
  openProjects: OpenProject[];
  recentProjects: string[];
  onClose: () => void;
  onNewProject: () => void;
  onOpenProject: () => void;
  onSelectProject: (path: string) => void;
};

const projectKey = (path: string) => path.replace(/[\\/]+$/, "");
const projectName = (path: string) => projectKey(path).split(/[\\/]/).filter(Boolean).pop() ?? path;

export const projectSwitcherItems = (
  openProjects: OpenProject[], recentProjects: string[], activePath: string | null,
): ProjectSwitcherItem[] => {
  const activeKey = activePath ? projectKey(activePath) : null;
  const seen = new Set<string>();
  const append = (path: string, open: boolean, items: ProjectSwitcherItem[]) => {
    const key = projectKey(path.trim());
    if (!key || seen.has(key)) return;
    seen.add(key);
    items.push({ current: key === activeKey, name: projectName(path), open, path: key });
  };
  const items: ProjectSwitcherItem[] = [];
  openProjects.forEach((project) => append(project.path, true, items));
  recentProjects.forEach((path) => append(path, false, items));
  return items;
};

const ProjectOption = ({ active, item, onSelect }: {
  active: boolean; item: ProjectSwitcherItem; onSelect: (path: string) => void;
}) => (
  <button className={`project-switcher__option ${active ? "project-switcher__option--active" : ""}`} type="button" role="option" aria-selected={item.current} aria-label={`${item.current ? "Current project" : "Switch to project"} ${item.name}, ${item.path}`} title={item.path} onClick={() => onSelect(item.path)}>
    <AppIcon name="workspace" />
    <span className="project-switcher__copy"><strong>{item.name}</strong><small>{item.path}</small></span>
    {item.current ? <AppIcon name="check" label="Current" /> : item.open ? <span className="project-switcher__status">Open</span> : null}
  </button>
);

const ProjectSwitcherFooter = ({ onAction }: {
  onAction: (action: "new" | "open") => void;
}) => (
  <footer className="project-switcher__footer">
    <button type="button" onClick={() => onAction("new")}><AppIcon name="folderPlus" /><span>{PROJECT_ENTRY_LABELS.newProject}</span></button>
    <button type="button" onClick={() => onAction("open")}><AppIcon name="folderOpen" /><span>{PROJECT_ENTRY_LABELS.openProject}</span></button>
  </footer>
);

export function ProjectSwitcher(props: ProjectSwitcherProps) {
  const items = useMemo(() => projectSwitcherItems(props.openProjects, props.recentProjects, props.activeProjectPath), [props.activeProjectPath, props.openProjects, props.recentProjects]);
  const [query, setQuery] = useState("");
  const filtered = items.filter((item) => `${item.name} ${item.path}`.toLowerCase().includes(query.trim().toLowerCase()));
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!props.open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery(""); setActiveIndex(Math.max(0, items.findIndex((item) => item.current)));
    inputRef.current?.focus();
    return () => returnFocusRef.current?.focus();
  }, [props.open]);
  if (!props.open) return null;
  const select = (path: string) => { props.onClose(); props.onSelectProject(path); };
  const action = (kind: "new" | "open") => { props.onClose(); (kind === "new" ? props.onNewProject : props.onOpenProject)(); };
  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") { event.preventDefault(); props.onClose(); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => filtered.length ? (index + delta + filtered.length) % filtered.length : 0);
    }
    if (event.key === "Enter" && filtered[activeIndex]) { event.preventDefault(); select(filtered[activeIndex].path); }
  };
  return (
    <section className="project-switcher" role="dialog" aria-label="Switch project">
      <div className="project-switcher__search"><AppIcon name="search" /><input ref={inputRef} type="search" aria-label="Search projects" placeholder="Search projects" value={query} onKeyDown={keyDown} onChange={(event) => { setQuery(event.currentTarget.value); setActiveIndex(0); }} /></div>
      <div className="project-switcher__list" role="listbox" aria-label="Projects">
        {filtered.map((item, index) => <ProjectOption active={index === activeIndex} item={item} key={item.path} onSelect={select} />)}
        {filtered.length === 0 ? <p className="project-switcher__empty">No matching projects</p> : null}
      </div>
      <ProjectSwitcherFooter onAction={action} />
    </section>
  );
}
