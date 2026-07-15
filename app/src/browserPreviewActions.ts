import type { AppActionDecision, AppActionDescriptor } from "./appActions";
import { createAppAction } from "./appActions";
import { normalizeBrowserPreviewUrl, type BrowserPreviewRecords } from "./browserPreview";
import {
  resolveScopedSetting,
  setScopedSetting,
  type ScopedSettingsState,
} from "./scopedSettings";

type BrowserPreviewActionsState = {
  currentRoot: string | null;
  currentSessionId: string | null;
  projects: BrowserPreviewRecords;
  scopedSettings: ScopedSettingsState;
  sessions: BrowserPreviewRecords;
};

type BrowserPreviewActionsDependencies = {
  gateAction: (action: AppActionDescriptor) => Promise<AppActionDecision>;
  getState: () => BrowserPreviewActionsState;
  restoreLocation: (url: string) => void;
  saveStore: () => Promise<unknown>;
  setError: (message: string | null) => void;
  setLocation: (url: string) => void;
  setProjects: (records: BrowserPreviewRecords) => void;
  setScopedSettings: (settings: ScopedSettingsState) => void;
  setSessions: (records: BrowserPreviewRecords) => void;
  setStoreValue: (key: string, value: unknown) => Promise<unknown>;
};

const persistUrl = async (
  dependencies: BrowserPreviewActionsDependencies,
  root: string | null,
  sessionId: string | null,
  url: string,
) => {
  if (!root) return;
  const state = dependencies.getState();
  const projects = { ...state.projects, [root]: url };
  const sessions = sessionId
    ? { ...state.sessions, [`${root}\n${sessionId}`]: url }
    : state.sessions;
  let scopedSettings = setScopedSetting(
    state.scopedSettings, "project", "browserUrl", url, root, sessionId,
  );
  if (sessionId) {
    scopedSettings = setScopedSetting(scopedSettings, "chat", "browserUrl", url, root, sessionId);
  }
  dependencies.setProjects(projects);
  dependencies.setSessions(sessions);
  dependencies.setScopedSettings(scopedSettings);
  await dependencies.setStoreValue("browserPreviewByProject", projects);
  await dependencies.setStoreValue("browserPreviewBySession", sessions);
  await dependencies.setStoreValue("scopedSettings", scopedSettings);
  await dependencies.saveStore();
};

const restoreUrl = (
  dependencies: BrowserPreviewActionsDependencies,
  root: string | null,
  sessionId: string | null,
) => {
  const url = resolveScopedSetting(
    dependencies.getState().scopedSettings, "browserUrl", root, sessionId,
  ).value;
  dependencies.restoreLocation(url);
};

const navigate = async (dependencies: BrowserPreviewActionsDependencies, rawUrl: string) => {
  const normalized = normalizeBrowserPreviewUrl(rawUrl);
  if (!normalized) {
    dependencies.setError("Enter an http, https, or file URL.");
    return false;
  }
  const decision = await dependencies.gateAction(createAppAction({
    kind: "open-browser-preview",
    label: "Open browser preview",
    target: normalized,
    risk: "low",
    requestedBy: "user",
  }));
  if (decision !== "approved") return false;
  dependencies.setLocation(normalized);
  const state = dependencies.getState();
  await persistUrl(dependencies, state.currentRoot, state.currentSessionId, normalized);
  return true;
};

export const createBrowserPreviewActions = (dependencies: BrowserPreviewActionsDependencies) => ({
  navigate: (url: string) => navigate(dependencies, url),
  persistUrl: (root: string | null, sessionId: string | null, url: string) =>
    persistUrl(dependencies, root, sessionId, url),
  restoreUrl: (root: string | null, sessionId: string | null) =>
    restoreUrl(dependencies, root, sessionId),
});
