import { removeProjectPaneContexts } from "./paneOwnership";
import { removeOpenProject, removeRecentProject, type ActiveSessionByProject, type OpenProject, type ProjectSessionsByProject } from "./workspaceState";

const withoutProject = <T>(records: Record<string, T>, path: string) => {
  const { [path]: _removed, ...remaining } = records;
  return remaining;
};

const withoutProjectSessions = <T>(records: Record<string, T>, path: string) =>
  Object.fromEntries(Object.entries(records).filter(([key]) => !key.startsWith(`${path}\n`))) as Record<string, T>;

export const applyWorkspaceCleanupRecord = <T>(
  target: { current: T },
  value: T,
  publish?: (value: T) => void,
) => {
  target.current = value;
  publish?.(value);
};

export const planMissingWorkspaceCleanup = <
  TProjectPanes,
  TActivePane,
  THarness,
  TConversation,
  TEditorSnapshot,
  TPaneLayout,
>(input: {
  path: string;
  recentProjects: string[];
  openProjects: OpenProject[];
  sessions: ProjectSessionsByProject;
  activeSessions: ActiveSessionByProject;
  projectPanes: Record<string, TProjectPanes>;
  activePanes: Record<string, TActivePane>;
  browserProjects: Record<string, string>;
  browserSessions: Record<string, string>;
  harnessRecords: Record<string, THarness>;
  conversations: Record<string, TConversation>;
  editorSnapshots: Record<string, TEditorSnapshot>;
  paneLayouts: Record<string, TPaneLayout>;
}) => ({
  recentProjects: removeRecentProject(input.recentProjects, input.path),
  openProjects: removeOpenProject(input.openProjects, input.path),
  sessions: withoutProject(input.sessions, input.path),
  activeSessions: withoutProject(input.activeSessions, input.path),
  projectPanes: removeProjectPaneContexts(input.projectPanes, input.path),
  activePanes: removeProjectPaneContexts(input.activePanes, input.path),
  browserProjects: withoutProject(input.browserProjects, input.path),
  browserSessions: withoutProjectSessions(input.browserSessions, input.path),
  harnessRecords: withoutProjectSessions(input.harnessRecords, input.path),
  conversations: withoutProjectSessions(input.conversations, input.path),
  editorSnapshots: withoutProjectSessions(input.editorSnapshots, input.path),
  paneLayouts: withoutProjectSessions(input.paneLayouts, input.path),
});
