import { invoke } from "@tauri-apps/api/core";

type CreatedLocalProject = { path: string };

export const projectCreationCommands = {
  create: (parent: string, name: string) =>
    invoke<CreatedLocalProject>("create_local_project", { parent, name }),
  initializeGit: (path: string) => invoke<void>("initialize_project_git", { path }),
};
