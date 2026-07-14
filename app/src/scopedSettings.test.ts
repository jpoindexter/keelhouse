import { describe, expect, it } from "vitest";

import {
  defaultScopedSettings,
  migrateLegacyScopedSettings,
  normalizeScopedSettings,
  resetScopedSetting,
  resolveScopedSetting,
  scopedSettingView,
  setScopedSetting,
} from "./scopedSettings";

describe("scoped settings", () => {
  it("resolves Global -> Project -> Chat and exposes the inheritance source", () => {
    const defaults = defaultScopedSettings("codex", "http://localhost:3000");
    const project = setScopedSetting(defaults, "project", "approvalMode", "approveSafe", "/repo", "chat-a");
    const chat = setScopedSetting(project, "chat", "approvalMode", "fullAccess", "/repo", "chat-a");

    expect(resolveScopedSetting(chat, "approvalMode", "/repo", "chat-a")).toEqual({
      value: "fullAccess",
      source: "chat",
      overridden: true,
    });
    expect(resolveScopedSetting(chat, "approvalMode", "/repo", "chat-b")).toEqual({
      value: "approveSafe",
      source: "project",
      overridden: true,
    });
    expect(scopedSettingView(project, "approvalMode", "/repo", "chat-a").chat).toEqual({
      value: "approveSafe",
      source: "project",
      overridden: false,
    });
  });

  it("resets overrides to their parent without leaving empty records", () => {
    const base = defaultScopedSettings();
    const project = setScopedSetting(base, "project", "agentProfileId", "gemini", "/repo", "chat-a");
    const chat = setScopedSetting(project, "chat", "agentProfileId", "claude", "/repo", "chat-a");
    const withoutChat = resetScopedSetting(chat, "chat", "agentProfileId", "/repo", "chat-a");
    const withoutProject = resetScopedSetting(withoutChat, "project", "agentProfileId", "/repo", "chat-a");

    expect(withoutChat.chats).toEqual({});
    expect(resolveScopedSetting(withoutChat, "agentProfileId", "/repo", "chat-a").value).toBe("gemini");
    expect(withoutProject.projects).toEqual({});
    expect(resolveScopedSetting(withoutProject, "agentProfileId", "/repo", "chat-a").value).toBe("codex");
  });

  it("migrates existing per-project browser and per-chat composer values", () => {
    const migrated = migrateLegacyScopedSettings({
      agentProfileId: "codex",
      browserUrl: "http://localhost:3000",
      browserProjects: { "/repo": "http://localhost:5173" },
      browserChats: { "/repo\nchat-a": "http://localhost:4173" },
      composerChats: {
        "/repo\nchat-a": { selectedProfileId: "gemini", approvalMode: "approveSafe" },
      },
    });

    expect(migrated.projects["/repo"]).toEqual({ browserUrl: "http://localhost:5173" });
    expect(migrated.chats["/repo\nchat-a"]).toEqual({
      browserUrl: "http://localhost:4173",
      approvalMode: "approveSafe",
    });
  });

  it("repairs legacy raw-terminal profiles that were stored as chat providers", () => {
    const normalized = normalizeScopedSettings({
      global: { agentProfileId: "shell", approvalMode: "ask", browserUrl: "http://localhost:3000" },
      projects: { "/repo": { agentProfileId: "gemini" } },
      chats: { "/repo\nchat-a": { agentProfileId: "shell" } },
    });

    expect(normalized.global.agentProfileId).toBe("codex");
    expect(normalized.projects).toEqual({});
    expect(normalized.chats).toEqual({});
  });

  it("preserves Claude as a structured provider at every scope", () => {
    const normalized = normalizeScopedSettings({
      global: { agentProfileId: "claude", approvalMode: "ask", browserUrl: "http://localhost:3000" },
      projects: { "/repo": { agentProfileId: "claude" } },
      chats: { "/repo\nchat-a": { agentProfileId: "claude" } },
    });

    expect(normalized.global.agentProfileId).toBe("claude");
    expect(resolveScopedSetting(normalized, "agentProfileId", "/repo", "chat-a").value).toBe("claude");
  });

  it("normalizes invalid persisted values without dropping valid overrides", () => {
    const normalized = normalizeScopedSettings({
      global: { agentProfileId: "", approvalMode: "unsafe", browserUrl: "" },
      projects: { "/repo": { approvalMode: "fullAccess", browserUrl: 42 } },
    }, defaultScopedSettings("codex", "http://localhost:3000"));

    expect(normalized.global).toEqual({
      agentProfileId: "codex",
      approvalMode: "ask",
      browserUrl: "http://localhost:3000",
    });
    expect(normalized.projects).toEqual({ "/repo": { approvalMode: "fullAccess" } });
  });
});
