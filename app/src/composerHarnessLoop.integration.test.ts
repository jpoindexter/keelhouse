// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { deriveActiveChatState } from "./activeChatState";
import { defaultScopedSettings } from "./scopedSettings";
import { useComposerLocalState } from "./useComposerLocalState";
import type { LaunchProfile } from "./launchProfiles";
import type { ProjectSession } from "./workspaceState";

// Integration guard for the black-screen mount crash: exercises the REAL
// deriveActiveChatState -> useComposerLocalState flow with a restored session
// that has no stored composer harness. deriveActiveChatState hands back a fresh
// default harness (new history array) every render, which previously drove
// useComposerLocalState into an infinite setState loop ("Maximum update depth").
const profile: LaunchProfile = {
  id: "codex", label: "Codex", command: "codex", args: [], useLoginShell: false,
};
const session = { id: "chat" } as ProjectSession;

const deriveUnstoredSessionChat = () =>
  deriveActiveChatState({
    activeSessionByProject: { "/repo": "chat" },
    chatConversations: {},
    composerHarnessBySession: {}, // no stored harness for the active session key
    launchProfileId: "codex",
    projectSessions: { "/repo": [session] },
    resolveLaunchProfile: () => profile,
    scopedSettings: defaultScopedSettings(),
    workspacePath: "/repo",
  });

describe("composer harness sync integration", () => {
  it("does not loop when a restored session has no stored harness", () => {
    const chat = deriveUnstoredSessionChat();
    expect(chat.activeComposerHarnessKey).toBe("/repo\nchat");

    expect(() =>
      renderHook(() => {
        const derived = deriveUnstoredSessionChat();
        return useComposerLocalState({
          activeHarness: derived.activeComposerHarness,
          activeKey: derived.activeComposerHarnessKey,
          getDefaultProfileId: () => "codex",
          getRecords: () => ({}),
          persistRecords: vi.fn(async () => {}),
        });
      }),
    ).not.toThrow();
  });
});
