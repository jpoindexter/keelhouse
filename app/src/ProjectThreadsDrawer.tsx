import { useState, type MouseEvent } from "react";

import { backgroundExitCountForProject, type BackgroundExit } from "./backgroundExits";
import { chatProviderLabel } from "./chatConversationMutations";
import { AppIcon, type AppIconName } from "./icons";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { activeSessionsForRail, archivedSessionCount, sessionRecencyLabel } from "./workspaceState";
import type { OpenProject, ProjectRailStatus, ProjectSession, ProjectSessionsByProject } from "./workspaceState";

export type ProjectThreadsDrawerProps = {
  activeProjectPath: string | null;
  activeSessionId: string | null;
  backgroundExits: BackgroundExit[];
  expandedProjects: Record<string, boolean>;
  projects: OpenProject[];
  recentProjects: string[];
  sessionsByProject: ProjectSessionsByProject;
  showArchived: boolean;
  projectStatus: (project: OpenProject) => ProjectRailStatus;
  sessionStatus: (projectPath: string, session: ProjectSession) => ProjectRailStatus;
  onProjectContextMenu: (event: MouseEvent<HTMLButtonElement>, project: OpenProject) => void;
  onNewProject: () => void;
  onOpenProject: () => void;
  onSelectProject: (path: string) => void;
  onSelectSession: (path: string, sessionId: string) => void;
  onSessionContextMenu: (event: MouseEvent<HTMLButtonElement>, path: string, session: ProjectSession) => void;
  onToggleArchived: () => void;
  onToggleExpanded: (path: string) => void;
};

const basename = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? path;
const statusLabel = (status: ProjectRailStatus) => status === "running" ? "Running" : status === "attention" ? "Needs attention" : "Idle";
const statusIcon = (status: ProjectRailStatus): AppIconName => status === "running" ? "loading" : status === "attention" ? "error" : "idle";

function SessionRow({ active, path, session, status, onContextMenu, onSelect }: {
  active: boolean; path: string; session: ProjectSession; status: ProjectRailStatus;
  onContextMenu: ProjectThreadsDrawerProps["onSessionContextMenu"];
  onSelect: ProjectThreadsDrawerProps["onSelectSession"];
}) {
  const orchestration = session.orchestration;
  const title = `${session.title} · ${statusLabel(status)}${orchestration ? ` · Child ${orchestration.index + 1} of ${orchestration.count} · ${chatProviderLabel(orchestration.provider)} · ${orchestration.worktreeMode === "isolated" ? "isolated worktree" : "shared project"}${orchestration.returnedAt ? " · result returned" : ""}` : ""}${session.checkpointId ? " · Workspace checkpoint saved" : ""}`;
  return (
    <button className={`session-row ${active ? "session-row--active" : ""} session-row--${status}`} type="button" aria-current={active ? "page" : undefined} aria-label={`${active ? "Active chat" : "Switch to chat"} ${session.title}, ${statusLabel(status)}`} title={title} onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); if (!active) onSelect(path, session.id); } }} onContextMenu={(event) => onContextMenu(event, path, session)}>
      <span className="session-row__copy">
        {orchestration ? <AppIcon className="session-row__fork" name="agent" label={`Child ${orchestration.index + 1} of ${orchestration.count}`} /> : session.parentSessionId ? <AppIcon className="session-row__fork" name="git" label="Forked chat" /> : null}
        <span>{session.title}</span>
      </span>
      <span className="session-row__state">
        {session.pinnedAt ? <AppIcon className="session-row__pin" name="pin" label="Pinned chat" /> : null}
        <span className="session-row__time">{sessionRecencyLabel(session.updatedAt)}</span>
        <AppIcon name={statusIcon(status)} />
      </span>
    </button>
  );
}

function SessionList({ path, props }: { path: string; props: ProjectThreadsDrawerProps }) {
  const allSessions = props.sessionsByProject[path] ?? [];
  const sessions = activeSessionsForRail(allSessions, props.showArchived);
  const expanded = props.expandedProjects[path] ?? false;
  const visible = expanded ? sessions : sessions.slice(0, 3);
  const hiddenCount = Math.max(0, sessions.length - visible.length);
  return (
    <div className="session-list" aria-label={`${basename(path)} chats`}>
      {visible.map((session) => <SessionRow key={session.id} active={path === props.activeProjectPath && session.id === props.activeSessionId} path={path} session={session} status={props.sessionStatus(path, session)} onContextMenu={props.onSessionContextMenu} onSelect={props.onSelectSession} />)}
      {sessions.length > 3 ? (
        <button className="session-row session-row--more" type="button" aria-expanded={expanded} aria-label={expanded ? `Show fewer chats in ${basename(path)}` : `Show ${hiddenCount} more chats in ${basename(path)}`} onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); props.onToggleExpanded(path); } }}>
          <span>{expanded ? "Show fewer" : `Show more (${hiddenCount})`}</span>
        </button>
      ) : null}
      {archivedSessionCount(allSessions) > 0 ? (
        <button className="session-row session-row--more" type="button" aria-pressed={props.showArchived} onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); props.onToggleArchived(); } }}>
          <span>{props.showArchived ? "Hide archived" : `Show archived (${archivedSessionCount(allSessions)})`}</span>
        </button>
      ) : null}
    </div>
  );
}

function ProjectGroup({ project, props }: { project: OpenProject; props: ProjectThreadsDrawerProps }) {
  const status = props.projectStatus(project);
  const active = project.path === props.activeProjectPath;
  const backgroundCount = backgroundExitCountForProject(props.backgroundExits, project.path);
  return (
    <div className="project-group">
      <button className={`project-row ${active ? "project-row--active" : ""} project-row--${status}`} type="button" aria-current={active ? "page" : undefined} aria-label={`${active ? "Active project" : "Switch to project"} ${basename(project.path)}, ${statusLabel(status)}`} title={project.path} onPointerDown={(event) => { if (event.button === 0) { event.preventDefault(); if (!active) props.onSelectProject(project.path); } }} onContextMenu={(event) => props.onProjectContextMenu(event, project)}>
        <span className="project-row__copy"><span className="project-row__name"><AppIcon name="workspace" /><span>{basename(project.path)}</span></span></span>
        {backgroundCount > 0 && !active ? <span className="project-row__badge" aria-label={`${backgroundCount} background exits`}>{backgroundCount}</span> : <span className="project-row__state" aria-hidden="true" />}
      </button>
      <SessionList path={project.path} props={props} />
    </div>
  );
}

export function ProjectThreadsDrawer(props: ProjectThreadsDrawerProps) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const activeName = props.activeProjectPath ? basename(props.activeProjectPath) : "Choose project";
  return (
    <div className="project-rail-shell">
      <div className="project-picker">
        <button className="project-picker__trigger" type="button" aria-label="Switch project" aria-expanded={switcherOpen} onClick={() => setSwitcherOpen((open) => !open)}><AppIcon name="workspace" /><span>{activeName}</span><AppIcon name="chevronDown" /></button>
        <ProjectSwitcher activeProjectPath={props.activeProjectPath} open={switcherOpen} openProjects={props.projects} recentProjects={props.recentProjects} onClose={() => setSwitcherOpen(false)} onNewProject={props.onNewProject} onOpenProject={props.onOpenProject} onSelectProject={props.onSelectProject} />
      </div>
      {props.projects.length === 0 ? <div className="rail-status">Open or create a project to start a chat</div> : (
        <nav className="project-rail" aria-label="Open projects">
          <div className="project-rail__heading">Today</div>
          {props.projects.map((project) => <ProjectGroup key={project.path} project={project} props={props} />)}
        </nav>
      )}
    </div>
  );
}
