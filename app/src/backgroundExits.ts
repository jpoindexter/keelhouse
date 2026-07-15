export type BackgroundExit = {
  paneId: string;
  projectPath: string;
  label: string;
  failed: boolean;
};

/* An exit counts as "background" only when it happens in a project other than
   the one the user is currently looking at — an exit in the focused project is
   already visible in the Run surface, so badging it would be noise. */
export const isBackgroundExit = (exitProjectPath: string, focusedProjectPath: string | null): boolean =>
  exitProjectPath !== focusedProjectPath;

export const addBackgroundExit = (
  current: BackgroundExit[],
  exit: BackgroundExit,
  cap = 50,
): BackgroundExit[] => [...current.filter((entry) => entry.paneId !== exit.paneId), exit].slice(-cap);

export const clearBackgroundExitsForProject = (
  current: BackgroundExit[],
  projectPath: string,
): BackgroundExit[] => current.filter((entry) => entry.projectPath !== projectPath);

export const backgroundExitCountForProject = (current: BackgroundExit[], projectPath: string): number =>
  current.filter((entry) => entry.projectPath === projectPath).length;

export const notificationBody = (exit: BackgroundExit): string =>
  `${exit.label} ${exit.failed ? "failed" : "finished"} in ${projectName(exit.projectPath)}`;

export const notifyBackgroundExit = async (exit: BackgroundExit): Promise<void> => {
  let granted = await isPermissionGranted();
  if (!granted) granted = (await requestPermission()) === "granted";
  if (granted) sendNotification({ title: "Keelhouse", body: notificationBody(exit) });
};

const projectName = (projectPath: string): string => {
  const parts = projectPath.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? projectPath;
};
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
