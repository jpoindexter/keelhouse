import type { AgentApprovalMode } from "./agentSessionHandle";

export type SettingsScope = "global" | "project" | "chat";

export type ScopedSettingsValues = {
  agentProfileId: string;
  approvalMode: AgentApprovalMode;
  browserUrl: string;
};

export type ScopedSettingKey = keyof ScopedSettingsValues;

export type ScopedSettingsState = {
  version: 1;
  global: ScopedSettingsValues;
  projects: Record<string, Partial<ScopedSettingsValues>>;
  chats: Record<string, Partial<ScopedSettingsValues>>;
};

export type ScopedSettingResolution<T> = {
  value: T;
  source: SettingsScope;
  overridden: boolean;
};

export type ScopedSettingView<T> = {
  global: ScopedSettingResolution<T>;
  project: ScopedSettingResolution<T> | null;
  chat: ScopedSettingResolution<T> | null;
};

export const scopedChatKey = (projectPath: string, sessionId: string) => `${projectPath}\n${sessionId}`;

export const defaultScopedSettings = (
  agentProfileId = "codex",
  browserUrl = "http://localhost:3000",
): ScopedSettingsState => ({
  version: 1,
  global: {
    agentProfileId,
    approvalMode: "ask",
    browserUrl,
  },
  projects: {},
  chats: {},
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value != null && !Array.isArray(value);

const normalizeApprovalMode = (value: unknown, fallback: AgentApprovalMode): AgentApprovalMode =>
  value === "ask" || value === "approveSafe" || value === "fullAccess" ? value : fallback;

const normalizeUrl = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

const normalizeProfileId = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

const normalizePartialValues = (value: unknown): Partial<ScopedSettingsValues> => {
  if (!isRecord(value)) return {};
  const normalized: Partial<ScopedSettingsValues> = {};
  if (typeof value.agentProfileId === "string" && value.agentProfileId.trim()) {
    normalized.agentProfileId = value.agentProfileId.trim();
  }
  if (value.approvalMode === "ask" || value.approvalMode === "approveSafe" || value.approvalMode === "fullAccess") {
    normalized.approvalMode = value.approvalMode;
  }
  if (typeof value.browserUrl === "string" && value.browserUrl.trim()) {
    normalized.browserUrl = value.browserUrl.trim();
  }
  return normalized;
};

const normalizeOverrides = (value: unknown): Record<string, Partial<ScopedSettingsValues>> => {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key.trim().length > 0)
      .map(([key, entry]) => [key, normalizePartialValues(entry)] as const)
      .filter(([, entry]) => Object.keys(entry).length > 0),
  );
};

export const normalizeScopedSettings = (
  value: unknown,
  fallback = defaultScopedSettings(),
): ScopedSettingsState => {
  if (!isRecord(value)) return fallback;
  const global = isRecord(value.global) ? value.global : {};
  return {
    version: 1,
    global: {
      agentProfileId: normalizeProfileId(global.agentProfileId, fallback.global.agentProfileId),
      approvalMode: normalizeApprovalMode(global.approvalMode, fallback.global.approvalMode),
      browserUrl: normalizeUrl(global.browserUrl, fallback.global.browserUrl),
    },
    projects: normalizeOverrides(value.projects),
    chats: normalizeOverrides(value.chats),
  };
};

export const resolveScopedSetting = <K extends ScopedSettingKey>(
  state: ScopedSettingsState,
  key: K,
  projectPath: string | null,
  sessionId: string | null,
): ScopedSettingResolution<ScopedSettingsValues[K]> => {
  const globalValue = state.global[key];
  const projectValue = projectPath ? state.projects[projectPath]?.[key] : undefined;
  const chatValue = projectPath && sessionId ? state.chats[scopedChatKey(projectPath, sessionId)]?.[key] : undefined;
  if (chatValue !== undefined) return { value: chatValue as ScopedSettingsValues[K], source: "chat", overridden: true };
  if (projectValue !== undefined) return { value: projectValue as ScopedSettingsValues[K], source: "project", overridden: true };
  return { value: globalValue, source: "global", overridden: false };
};

export const scopedSettingView = <K extends ScopedSettingKey>(
  state: ScopedSettingsState,
  key: K,
  projectPath: string | null,
  sessionId: string | null,
): ScopedSettingView<ScopedSettingsValues[K]> => {
  const global = { value: state.global[key], source: "global" as const, overridden: true };
  const projectOverride = projectPath ? state.projects[projectPath]?.[key] : undefined;
  const project = projectPath
    ? projectOverride !== undefined
      ? { value: projectOverride as ScopedSettingsValues[K], source: "project" as const, overridden: true }
      : { value: global.value, source: "global" as const, overridden: false }
    : null;
  const chatOverride = projectPath && sessionId
    ? state.chats[scopedChatKey(projectPath, sessionId)]?.[key]
    : undefined;
  const chat = projectPath && sessionId
    ? chatOverride !== undefined
      ? { value: chatOverride as ScopedSettingsValues[K], source: "chat" as const, overridden: true }
      : { value: project?.value ?? global.value, source: project?.source ?? "global", overridden: false }
    : null;
  return { global, project, chat };
};

export const setScopedSetting = <K extends ScopedSettingKey>(
  state: ScopedSettingsState,
  scope: SettingsScope,
  key: K,
  value: ScopedSettingsValues[K],
  projectPath: string | null,
  sessionId: string | null,
): ScopedSettingsState => {
  if (scope === "global") return { ...state, global: { ...state.global, [key]: value } };
  if (!projectPath) return state;
  if (scope === "project") {
    return {
      ...state,
      projects: { ...state.projects, [projectPath]: { ...state.projects[projectPath], [key]: value } },
    };
  }
  if (!sessionId) return state;
  const chatKey = scopedChatKey(projectPath, sessionId);
  return {
    ...state,
    chats: { ...state.chats, [chatKey]: { ...state.chats[chatKey], [key]: value } },
  };
};

const removeEmptyOverride = (
  records: Record<string, Partial<ScopedSettingsValues>>,
  recordKey: string,
  settingKey: ScopedSettingKey,
) => {
  const nextEntry = { ...records[recordKey] };
  delete nextEntry[settingKey];
  if (Object.keys(nextEntry).length === 0) {
    const { [recordKey]: _removed, ...rest } = records;
    return rest;
  }
  return { ...records, [recordKey]: nextEntry };
};

export const resetScopedSetting = (
  state: ScopedSettingsState,
  scope: Exclude<SettingsScope, "global">,
  key: ScopedSettingKey,
  projectPath: string | null,
  sessionId: string | null,
): ScopedSettingsState => {
  if (!projectPath) return state;
  if (scope === "project") {
    return { ...state, projects: removeEmptyOverride(state.projects, projectPath, key) };
  }
  if (!sessionId) return state;
  return { ...state, chats: removeEmptyOverride(state.chats, scopedChatKey(projectPath, sessionId), key) };
};

type LegacyComposerValue = { selectedProfileId?: unknown; approvalMode?: unknown };

export const migrateLegacyScopedSettings = (input: {
  agentProfileId: string;
  browserUrl: string;
  browserProjects?: Record<string, string>;
  browserChats?: Record<string, string>;
  composerChats?: Record<string, LegacyComposerValue>;
}): ScopedSettingsState => {
  const state = defaultScopedSettings(input.agentProfileId, input.browserUrl);
  const projects = Object.fromEntries(
    Object.entries(input.browserProjects ?? {})
      .filter(([, url]) => typeof url === "string" && url.trim())
      .map(([key, url]) => [key, { browserUrl: url.trim() }]),
  );
  const chatKeys = new Set([
    ...Object.keys(input.browserChats ?? {}),
    ...Object.keys(input.composerChats ?? {}),
  ]);
  const chats = Object.fromEntries([...chatKeys].flatMap((key) => {
    const browserUrl = input.browserChats?.[key];
    const composer = input.composerChats?.[key];
    const override: Partial<ScopedSettingsValues> = {};
    if (browserUrl?.trim()) override.browserUrl = browserUrl.trim();
    if (composer) {
      const profile = normalizeProfileId(composer.selectedProfileId, "");
      if (profile) override.agentProfileId = profile;
      if (composer.approvalMode === "ask" || composer.approvalMode === "approveSafe" || composer.approvalMode === "fullAccess") {
        override.approvalMode = composer.approvalMode;
      }
    }
    return Object.keys(override).length > 0 ? [[key, override] as const] : [];
  }));
  return { ...state, projects, chats };
};
