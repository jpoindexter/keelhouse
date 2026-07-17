export const PROJECT_ENTRY_LABELS = {
  newProject: "New Project…",
  newTask: "New Task",
  openProject: "Open Project…",
  switchProject: "Switch Project…",
} as const;

type ProjectEntryDependencies = {
  beginCreateProject?: () => Promise<unknown>;
  createTask: (projectPath: string) => Promise<unknown>;
  getActiveProject: () => string | null;
  openProjectEntry?: () => Promise<unknown>;
  openProjectPicker: () => Promise<unknown>;
  switchProjectPath: (projectPath: string) => Promise<unknown>;
};

export const createProjectEntryActions = (dependencies: ProjectEntryDependencies) => {
  let newTaskInFlight = false;
  const newTask = async () => {
    if (newTaskInFlight) return false;
    newTaskInFlight = true;
    try {
      const projectPath = dependencies.getActiveProject();
      if (!projectPath) {
        await (dependencies.openProjectEntry ?? dependencies.openProjectPicker)();
        return false;
      }
      await dependencies.createTask(projectPath);
      return true;
    } finally {
      newTaskInFlight = false;
    }
  };
  return {
    chooseProject: () => (dependencies.openProjectEntry ?? dependencies.openProjectPicker)(),
    newProject: () => dependencies.beginCreateProject?.() ?? Promise.resolve(false),
    newTask,
    openProject: () => dependencies.openProjectPicker(),
    switchProject: (projectPath: string) => dependencies.switchProjectPath(projectPath),
  };
};
