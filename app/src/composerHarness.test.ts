import { describe, expect, it } from "vitest";
import {
  composerPromptPayload,
  createComposerAttachment,
  defaultComposerHarnessState,
  normalizeComposerHarnessRecords,
  normalizeComposerHarnessState,
  removeComposerAttachment,
  upsertComposerAttachment,
} from "./composerHarness";

describe("composer harness", () => {
  it("normalizes persisted harness state", () => {
    expect(normalizeComposerHarnessState({
      approvalMode: "fullAccess",
      goal: " ship it ",
      selectedProfileId: "gemini",
      attachments: [
        { id: "a", kind: "file", label: "App.tsx", target: "/repo/App.tsx", createdAt: 10 },
        { id: "", kind: "file", label: "bad", target: "/bad", createdAt: 10 },
      ],
    })).toEqual({
      approvalMode: "fullAccess",
      goal: "ship it",
      selectedProfileId: "gemini",
      attachments: [{ id: "a", kind: "file", label: "App.tsx", target: "/repo/App.tsx", createdAt: 10 }],
    });
  });

  it("normalizes records by session key", () => {
    expect(normalizeComposerHarnessRecords({ " /repo\ns1 ": { approvalMode: "bad" } }, "codex")).toEqual({
      " /repo\ns1 ": defaultComposerHarnessState("codex"),
    });
  });

  it("upserts and removes attachments", () => {
    const first = createComposerAttachment({ kind: "file", label: "App.tsx", target: "/repo/App.tsx" }, 100);
    const second = createComposerAttachment({ kind: "browser", label: "Preview", target: "http://localhost:3000" }, 101);
    expect(upsertComposerAttachment([first], second)).toEqual([second, first]);
    expect(removeComposerAttachment([second, first], first.id)).toEqual([second]);
  });

  it("builds transparent prompt context only when harness context exists", () => {
    expect(composerPromptPayload("do it", defaultComposerHarnessState())).toBe("do it");
    expect(composerPromptPayload("do it", {
      approvalMode: "ask",
      goal: "Fix API",
      selectedProfileId: "codex",
      attachments: [createComposerAttachment({ kind: "file", label: "App.tsx", target: "/repo/App.tsx" }, 100)],
    })).toContain("Goal: Fix API\n\nAttachments:\n- file: App.tsx (/repo/App.tsx)\n\ndo it");
  });
});
