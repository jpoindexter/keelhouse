type WorkspaceCleanupStore = {
  delete: (key: string) => Promise<unknown>;
  save: () => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<unknown>;
};

type WorkspaceCleanupRecords = {
  activeSessions: unknown;
  browserProjects: unknown;
  browserSessions: unknown;
  editorSnapshots: unknown;
  harnessRecords: unknown;
  openProjects: unknown;
  paneLayouts: unknown;
  recentProjects: unknown;
  sessions: unknown;
};

type PersistMissingWorkspaceCleanupInput = {
  beforeDeleteFolder: () => void;
  cleanup: WorkspaceCleanupRecords;
  deleteProjectChats: (path: string) => Promise<unknown>;
  onDeleteError: (error: unknown) => void;
  path: string;
  store: WorkspaceCleanupStore | null;
};

export const persistMissingWorkspaceCleanup = async ({
  beforeDeleteFolder,
  cleanup,
  deleteProjectChats,
  onDeleteError,
  path,
  store,
}: PersistMissingWorkspaceCleanupInput) => {
  await store?.set("recentFolders", cleanup.recentProjects);
  await store?.set("openProjects", cleanup.openProjects);
  await store?.set("projectSessions", cleanup.sessions);
  await store?.set("activeSessionByProject", cleanup.activeSessions);
  await store?.set("browserPreviewByProject", cleanup.browserProjects);
  await store?.set("browserPreviewBySession", cleanup.browserSessions);
  await store?.set("composerHarnessBySession", cleanup.harnessRecords);
  await deleteProjectChats(path).catch(onDeleteError);
  await store?.set("sessionEditorSnapshots", cleanup.editorSnapshots);
  await store?.set("paneLayoutsBySession", cleanup.paneLayouts);
  beforeDeleteFolder();
  await store?.delete("folder");
  await store?.save();
};
